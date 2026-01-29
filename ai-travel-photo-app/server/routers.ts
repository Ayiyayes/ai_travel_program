import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import * as coze from "./coze";
import { storagePut, storageGet } from "./storage";
import { processTemplateImage } from "./imageProcessing";
import { nanoid } from "nanoid";
import * as sms from "./sms";
import * as fs from "fs";
import * as path from "path";
import { ENV } from "./_core/env";
import { notifyPhotoStatus } from "./websocket";

// 将相对路径图片转换为公网可访问的 URL

function toWebpUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.endsWith('.webp')) return url;
  const match = url.match(/\.(jpe?g|png)(\?.*)?$/i);
  if (!match) return undefined;
  return url.replace(/\.(jpe?g|png)(\?.*)?$/i, '.webp$2');
}

async function ensurePublicUrl(relativeUrl: string): Promise<string> {
  // 如果已经是完整的 http/https URL，直接返回
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }



  // 如果是本地存储模式，添加本地服务器前缀（仅用于开发）
  if (ENV.storageType === 'local') {
    return `http://localhost:3000${relativeUrl}`;
  }

  // 云存储模式：检查是否已经是 COS URL
  const cosUrlPrefix = `https://${ENV.cosBucket}.cos.${ENV.cosRegion}.myqcloud.com/`;
  if (relativeUrl.startsWith(cosUrlPrefix)) {
    return relativeUrl;
  }

  // 需要将本地文件上传到 COS
  const localPath = path.join(process.cwd(), 'dist', 'public', relativeUrl.replace(/^\//, ''));

  if (!fs.existsSync(localPath)) {
    console.error('[ensurePublicUrl] 本地文件不存在:', localPath);
    throw new Error(`文件不存在: ${relativeUrl}`);
  }

  // 读取本地文件并上传到 COS
  const buffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';

  // 使用原始路径作为 COS key（去掉开头的 /）
  const cosKey = relativeUrl.replace(/^\/+/, '');
  const { url } = await storagePut(cosKey, buffer, contentType);

  console.log('[ensurePublicUrl] 已上传到 COS:', { from: relativeUrl, to: url });
  return url;
}

export const appRouter = router({
  system: systemRouter,
  
  // 地图服务路由
  map: router({
    // 使用腾讯地图 API 查询景点经纬度
    searchLocation: protectedProcedure
      .input(z.object({
        keyword: z.string(),
        city: z.string(),
      }))
      .mutation(async ({ input }) => {
        const apiKey = process.env.TENCENT_MAP_API_KEY;

        // 调试日志：检查 API Key
        console.log('[Tencent Map] API Key exists:', !!apiKey);
        console.log('[Tencent Map] API Key value:', apiKey);

        if (!apiKey) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '腾讯地图 API Key 未配置' });
        }

        const keyword = encodeURIComponent(input.keyword);
        const city = encodeURIComponent(input.city);
        const url = `https://apis.map.qq.com/ws/place/v1/search?keyword=${keyword}&boundary=region(${city},0)&key=${apiKey}`;

        // 调试日志：打印请求信息
        console.log('[Tencent Map] Request URL:', url);
        console.log('[Tencent Map] Keyword:', input.keyword);
        console.log('[Tencent Map] City:', input.city);

        try {
          const response = await fetch(url);
          const data = await response.json();

          // 调试日志：打印完整响应
          console.log('[Tencent Map] Response status:', data.status);
          console.log('[Tencent Map] Response message:', data.message);
          console.log('[Tencent Map] Response data:', JSON.stringify(data, null, 2));

          if (data.status !== 0 || !data.data || data.data.length === 0) {
            console.log('[Tencent Map] Search failed - status:', data.status, 'message:', data.message);
            return { success: false, message: `未找到该景点的经纬度 (API返回: ${data.message || '无数据'})` };
          }

          // 返回第一个结果
          const firstResult = data.data[0];
          console.log('[Tencent Map] Success - found location:', firstResult.title);
          return {
            success: true,
            location: {
              lat: firstResult.location.lat,
              lng: firstResult.location.lng,
            },
            title: firstResult.title,
            address: firstResult.address,
          };
        } catch (error) {
          console.error('[Tencent Map] API error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '查询经纬度失败' });
        }
      }),
  }),
  
  // 认证路由
  auth: router({
    me: publicProcedure.query(async (opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      
      // 检查用户是否为新用户（根据是否有照片记录判断）
      const isNew = await db.isNewUser(user.id);
      
      return {
        ...user,
        isNewUser: isNew, // 新增字段：是否为新用户
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // 用户路由
  user: router({
    // 获取当前用户信息
    profile: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return user;
    }),

    // 更新用户资料
    updateProfile: protectedProcedure
      .input(z.object({
        gender: z.string().optional(),
        userType: z.string().optional(),
        faceType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),

    // 获取用户积分
    points: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return { points: user?.points || 0 };
    }),

    // 获取用户类型（新用户/老用户）
    userType: protectedProcedure.query(async ({ ctx }) => {
      const userType = await db.getUserType(ctx.user.id);
      return { userType };
    }),


  }),

  // 模板路由
  template: router({
    // 获取模板列表
    list: publicProcedure
      .input(z.object({
        city: z.string().optional(),
        scenicSpot: z.string().optional(),
        groupType: z.string().optional(),
        photoType: z.enum(['single', 'group']).optional(),
        displayOnly: z.boolean().optional(), // 前端默认只展示窄脸和通用模板
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(50).optional(),
      }).optional())
      .query(async ({ input }) => {
        // 前端默认只返回展示模板（窄脸和通用），排除宽脸模板
        const templates = await db.getTemplates({ ...input, status: 'active', displayOnly: input?.displayOnly !== false });
        return templates.map((tpl) => ({
          ...tpl,
          imageWebpUrl: toWebpUrl(tpl.imageUrl),
          thumbnailWebpUrl: toWebpUrl(tpl.thumbnailUrl),
        }));
      }),

    // 获取单个模板
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const template = await db.getTemplateById(input.id);
        if (!template) return template;
        return {
          ...template,
          imageWebpUrl: toWebpUrl(template.imageUrl),
          thumbnailWebpUrl: toWebpUrl(template.thumbnailUrl),
        };
      }),

    // 获取模板版本号（用于前端缓存判断）
    version: publicProcedure
      .query(async () => {
        const version = await db.getTemplateVersion();
        return { version };
      }),

    // 获取城市列表
    cities: publicProcedure.query(async () => {
      return db.getDistinctCities();
    }),

    // 获取景区列表
    scenicSpots: publicProcedure
      .input(z.object({ city: z.string() }))
      .query(async ({ input }) => {
        return db.getScenicSpotsByCity(input.city);
      }),

    // 获取人群类型列表（返回完整信息，包含code和displayName）
    groupTypes: publicProcedure
      .input(z.object({
        photoType: z.enum(['single', 'group']).optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getActiveGroupTypes(input?.photoType);
      }),

    // 获取城市列表（P8付费模板页使用）- 只返回城市名称数组
    getCities: publicProcedure
      .query(async () => {
        const cities = await db.getActiveCities();
        // 只返回城市名称字符串数组，供小程序前端使用
        return cities.map(c => c.name);
      }),

    // 获取所有已存在的模板ID（用于生成新模板ID时去重）
    getAllIds: publicProcedure
      .query(async () => {
        return db.getAllTemplateIds();
      }),

    // 记录模板曝光
    recordView: publicProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(async ({ input }) => {
        await db.recordTemplateView(input.templateId);
        return { success: true };
      }),

    // 记录模板选择/点击
    recordSelect: publicProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(async ({ input }) => {
        await db.recordTemplateSelect(input.templateId);
        return { success: true };
      }),

    // 获取全国通用模板(单人照) - 用于首页展示
    getNationalTemplates: publicProcedure
      .input(z.object({
        photoType: z.enum(['single', 'group']).optional(),
      }).optional())
      .query(async ({ input }) => {
        const dbInstance = await db.getDb();
        if (!dbInstance) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库连接失败' });

        const { eq, and } = await import('drizzle-orm');
        const { templates } = await import('../drizzle/schema');

        const conditions = [
          eq(templates.isNational, true),
          eq(templates.status, 'active' as const),
        ];

        if (input?.photoType) {
          conditions.push(eq(templates.photoType, input.photoType));
        }

        const result = await dbInstance
          .select()
          .from(templates)
          .where(and(...conditions))
          .orderBy(templates.sortOrder);

        return result;
      }),

    // 获取推荐模板(按用户位置) - 用于结果页推荐
    getRecommendedByLocation: publicProcedure
      .input(z.object({
        latitude: z.number(),
        longitude: z.number(),
        photoType: z.enum(['single', 'group']).optional(),
      }))
      .query(async ({ input }) => {
        const dbInstance = await db.getDb();
        if (!dbInstance) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库连接失败' });

        // 获取所有景点
        const allSpots = await db.getAllSpots();

        if (!allSpots || allSpots.length === 0) {
          // 如果没有景点,返回全国通用模板
          const nationalTemplates = await db.getTemplates({
            status: 'active',
            isNational: true,
            photoType: input.photoType,
          });
          return {
            city: '全国通用',
            scenicSpot: '全国通用',
            latitude: input.latitude,
            longitude: input.longitude,
            distance: 0,
            nearestSpotTemplates: [],
            nationalTemplates,
          };
        }

        // 计算距离并找到最近的景点
        const distances = allSpots.map(spot => ({
          ...spot,
          distance: Math.sqrt(
            Math.pow((Number(spot.latitude) || 0) - input.latitude, 2) +
            Math.pow((Number(spot.longitude) || 0) - input.longitude, 2)
          ),
        }));

        const nearest = distances.sort((a, b) => a.distance - b.distance)[0];

        // 获取最近景点的模板
        const nearestSpotTemplates = await db.getTemplates({
          scenicSpot: nearest.name,
          status: 'active',
          photoType: input.photoType,
        });

        // 获取全国通用模板作为补充
        const nationalTemplates = await db.getTemplates({
          status: 'active',
          isNational: true,
          photoType: input.photoType,
        });

        // 获取城市信息
        const cityInfo = await db.getCityById(nearest.cityId);

        return {
          city: cityInfo?.name || '未知城市',
          scenicSpot: nearest.name,
          latitude: nearest.latitude,
          longitude: nearest.longitude,
          distance: nearest.distance,
          nearestSpotTemplates,
          nationalTemplates,
        };
      }),

    // 获取推荐模板(按城市) - 用于未授权位置时的推荐
    getRecommendedByCity: publicProcedure
      .input(z.object({
        city: z.string(),
        photoType: z.enum(['single', 'group']).optional(),
      }))
      .query(async ({ input }) => {
        // 获取该城市的所有模板
        const cityTemplates = await db.getTemplates({
          city: input.city,
          status: 'active',
          photoType: input.photoType,
        });

        // 获取全国通用模板
        const nationalTemplates = await db.getTemplates({
          status: 'active',
          isNational: true,
          photoType: input.photoType,
        });

        return {
          city: input.city,
          cityTemplates,
          nationalTemplates,
        };
      }),

    // 获取模板统计数据（管理员）
    stats: adminProcedure
      .input(z.object({
        city: z.string().optional(),
        scenicSpot: z.string().optional(),
        groupType: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getTemplateStats(input);
      }),

    // 获取模板排行榜（管理员）
    ranking: adminProcedure
      .input(z.object({
        type: z.enum(['hot', 'potential']),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return db.getTemplateRanking(input.type, input.limit);
      }),

    // 获取指定分组的最大排序值
    getMaxSortOrder: adminProcedure
      .input(z.object({
        city: z.string(),
        scenicSpot: z.string(),
        groupType: z.string(),
      }))
      .query(async ({ input }) => {
        const maxSort = await db.getMaxSortOrder(input.city, input.scenicSpot, input.groupType);
        return { maxSortOrder: maxSort };
      }),

    // 批量更新模板排序
    updateSortOrders: adminProcedure
      .input(z.array(z.object({
        id: z.number(),
        sortOrder: z.number(),
      })))
      .mutation(async ({ input }) => {
        await db.updateTemplateSortOrders(input);
        await db.bumpTemplateVersion();
        return { success: true };
      }),

    // 管理员：创建模板
    create: adminProcedure
      .input(z.object({
        templateId: z.string(),
        name: z.string(),
        imageUrl: z.string(),
        thumbnailUrl: z.string().optional(),
        city: z.string(),
        scenicSpot: z.string(),
        groupType: z.string(),
        photoType: z.enum(['single', 'group']).default('single'),
        faceType: z.enum(['wide', 'narrow', 'both']).default('both'),
        price: z.number().default(0),
        isFree: z.boolean().default(false),
        prompt: z.string().optional(),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        const payload = { ...input, thumbnailUrl: input.thumbnailUrl || input.imageUrl };
        await db.createTemplate(payload);
        await db.bumpTemplateVersion();
        return { success: true };
      }),

    // 管理员：更新模板
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        imageUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        city: z.string().optional(),
        scenicSpot: z.string().optional(),
        groupType: z.string().optional(),
        photoType: z.enum(['single', 'group']).optional(),
        faceType: z.enum(['wide', 'narrow', 'both']).optional(),
        price: z.number().optional(),
        isFree: z.boolean().optional(),
        status: z.enum(['active', 'inactive']).optional(),
        prompt: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        if (data.imageUrl && !data.thumbnailUrl) {
          data.thumbnailUrl = data.imageUrl;
        }
        await db.updateTemplate(id, data);
        await db.bumpTemplateVersion();
        return { success: true };
      }),

    // 管理员：删除模板（并重新计算排序）
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTemplateAndRecalculateSort(input.id);
        await db.bumpTemplateVersion();
        return { success: true };
      }),

    // 管理员：切换模板状态
    toggleStatus: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const newStatus = await db.toggleTemplateStatus(input.id);
        await db.bumpTemplateVersion();
        return { success: true, status: newStatus };
      }),

    // 管理员：批量导入模板
    batchImport: adminProcedure
      .input(z.array(z.object({
        templateId: z.string(),
        name: z.string(),
        imageUrl: z.string(),
        thumbnailUrl: z.string().optional(),
        city: z.string(), // 逗号分隔的城市列表
        scenicSpot: z.string(), // 逗号分隔的景点列表
        groupType: z.string(),
        photoType: z.enum(['single', 'group']).default('single'),
        faceType: z.enum(['wide', 'narrow', 'both']).default('both'),
        isNational: z.boolean().default(false), // 是否全国通用
        templateGroupId: z.string().optional(), // 模板分组ID，用于宽脸/窄脸关联
        price: z.number().default(0),
        isFree: z.boolean().default(false),
        prompt: z.string().optional(),
        // 遮盖功能
        hasMaskRegions: z.boolean().default(false),
        maskRegions: z.array(z.object({
          id: z.string(),
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
          label: z.string().optional(),
        })).optional(),
        maskedImageUrl: z.string().optional(),
        regionCacheUrl: z.string().optional(),
      })))
      .mutation(async ({ input }) => {
        let successCount = 0;
        let failCount = 0;
        
        // 按城市+景点+人群类型分组，计算每个分组的排序值
        const groupMaxSortOrders = new Map<string, number>();
        
        for (const template of input) {
          try {
            const groupKey = `${template.city}|${template.scenicSpot}|${template.groupType}`;
            
            // 获取该分组的当前最大排序值
            let currentMaxSort = groupMaxSortOrders.get(groupKey);
            if (currentMaxSort === undefined) {
              // 第一次遇到该分组，从数据库获取最大值
              currentMaxSort = await db.getMaxSortOrder(template.city, template.scenicSpot, template.groupType);
            }
            
            // 新模板的排序值 = 当前最大值 + 1
            const newSortOrder = currentMaxSort + 1;
            groupMaxSortOrders.set(groupKey, newSortOrder);
            
            await db.createTemplate({
              ...template,
              thumbnailUrl: template.thumbnailUrl || template.imageUrl,
              sortOrder: newSortOrder,
              isNational: template.isNational || false,
              hasMaskRegions: template.hasMaskRegions || false,
              maskRegions: template.maskRegions ? JSON.stringify(template.maskRegions) : null,
              maskedImageUrl: template.maskedImageUrl || null,
              regionCacheUrl: template.regionCacheUrl || null,
            });
            successCount++;
          } catch (e) {
            console.error('创建模板失败:', e);
            failCount++;
          }
        }
        if (successCount > 0) {
          await db.bumpTemplateVersion();
        }
        return { successCount, failCount };
      }),

    // 管理员：保存图片缓存
    saveImageCache: adminProcedure
      .input(z.object({
        images: z.array(z.object({
          fileName: z.string(),
          previewUrl: z.string(),
          s3Key: z.string().optional(),
          city: z.string(),
          spot: z.string(),
          groupType: z.string(),
          faceType: z.enum(['wide', 'narrow', 'both']),
          price: z.number(),
          templateId: z.string(),
          prompt: z.string().optional(),
          order: z.number(),
          batchName: z.string().optional(),
          batchId: z.string().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        // 使用批量保存函数（内部会先清除旧缓存）
        await db.saveImageCacheBatch(ctx.user.id, input.images.map(img => ({
          fileName: img.fileName,
          previewUrl: img.previewUrl,
          s3Key: img.s3Key || '',
          city: img.city,
          spot: img.spot,
          groupType: img.groupType,
          faceType: img.faceType,
          price: img.price,
          templateId: img.templateId,
          prompt: img.prompt || '',
          order: img.order,
          batchName: img.batchName || '',
          batchId: img.batchId || '',
        })));
        return { success: true, count: input.images.length };
      }),

    // 管理员：获取图片缓存
    getImageCache: adminProcedure
      .query(async ({ ctx }) => {
        return db.getImageCache(ctx.user.id);
      }),

    // 管理员：清除图片缓存
    clearImageCache: adminProcedure
      .mutation(async ({ ctx }) => {
        await db.clearImageCache(ctx.user.id);
        return { success: true };
      }),

    // 管理员：上传缓存图片到 S3
    uploadCacheImage: adminProcedure
      .input(z.object({
        imageBase64: z.string(),
        fileName: z.string(),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.imageBase64, 'base64');
        const processed = await processTemplateImage(buffer);
        const baseKey = `template-cache/${ctx.user.id}/${nanoid()}`;

        const jpgKey = `${baseKey}.jpg`;
        const thumbKey = `${baseKey}_thumb.jpg`;
        const webpKey = `${baseKey}.webp`;
        const thumbWebpKey = `${baseKey}_thumb.webp`;

        const { url: jpgUrl, key: jpgFileKey } = await storagePut(jpgKey, processed.mainJpeg, 'image/jpeg');
        const { url: thumbUrl, key: thumbFileKey } = await storagePut(thumbKey, processed.thumbnailJpeg, 'image/jpeg');
        const { url: webpUrl, key: webpFileKey } = await storagePut(webpKey, processed.mainWebp, 'image/webp');
        const { url: thumbWebpUrl, key: thumbWebpFileKey } = await storagePut(thumbWebpKey, processed.thumbnailWebp, 'image/webp');

        return {
          url: jpgUrl,
          fileKey: jpgFileKey,
          thumbnailUrl: thumbUrl,
          thumbnailKey: thumbFileKey,
          webpUrl,
          webpKey: webpFileKey,
          thumbnailWebpUrl: thumbWebpUrl,
          thumbnailWebpKey: thumbWebpFileKey,
        };
      }),

    batchUpdate: adminProcedure
      .input(z.object({
        ids: z.array(z.number()),
        data: z.object({
          city: z.string().optional(),
          scenicSpot: z.string().optional(),
          groupType: z.string().optional(),
          faceType: z.enum(['wide', 'narrow', 'both']).optional(),
          price: z.number().optional(),
          status: z.enum(['active', 'inactive']).optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const count = await db.batchUpdateTemplates(input.ids, input.data);
        if (count > 0) {
          await db.bumpTemplateVersion();
        }
        return { success: true, count };
      }),

    // 管理员：批量删除模板
    batchDelete: adminProcedure
      .input(z.object({
        ids: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        const count = await db.batchDeleteTemplates(input.ids);
        if (count > 0) {
          await db.bumpTemplateVersion();
        }
        return { success: true, count };
      }),
  }),

  // 照片生成路由
  photo: router({
    // 公开上传自拍照（小程序使用，不需要登录）
    uploadSelfiePublic: publicProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.imageBase64, 'base64');
        const fileKey = `selfies/anonymous/${nanoid()}.jpg`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return { url, fileKey };
      }),

    // 公开换脸接口（小程序使用，不需要登录）
    createSinglePublic: publicProcedure
      .input(z.object({
        selfieUrl: z.string(),
        templateId: z.number(),
        detectedFaceType: z.string().optional(), // 用户脸型，如 "宽脸"、"窄脸"
        userOpenId: z.string().optional(), // 可选的用户标识
      }))
      .mutation(async ({ input }) => {
        let template = await db.getTemplateById(input.templateId);
        if (!template) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '模板不存在' });
        }

        // 脸型模板匹配逻辑
        // 只有这五种人群类型需要区分宽窄脸
        const faceTypeGroups = ['girl_young', 'woman_mature', 'woman_elder', 'man_young', 'man_elder'];
        const needFaceTypeMatch = faceTypeGroups.includes(template.groupType || '');

        if (needFaceTypeMatch && input.detectedFaceType) {
          const targetFaceType = coze.convertFaceTypeToDb(input.detectedFaceType);
          if (targetFaceType && targetFaceType !== template.faceType) {
            const matchingTemplate = await db.findMatchingTemplate({
              originalTemplateId: template.id,
              targetFaceType,
            });
            if (matchingTemplate) {
              console.log(`[photo.createSinglePublic] 匹配到${input.detectedFaceType}模板:`, matchingTemplate.id);
              template = matchingTemplate;
            } else {
              // P2: 降级策略日志 - 未找到匹配的脸型模板时，使用原模板
              console.warn(`[photo.createSinglePublic] 降级: 未找到${input.detectedFaceType}(${targetFaceType})模板，使用原模板 (id=${template.id}, faceType=${template.faceType})`);
            }
          }
        }

        // 获取用户ID
        let userId = 0;
        if (input.userOpenId) {
          const user = await db.getUserByOpenId(input.userOpenId);
          if (user) userId = user.id;
        }

        // 创建照片记录
        const photoId = await db.generatePhotoId();
        await db.createUserPhoto({
          photoId,
          userId,
          templateId: template.id,
          selfieUrl: input.selfieUrl,
          photoType: 'single',
          status: 'pending',
          detectedFaceType: input.detectedFaceType || null,
        });

        const photo = await db.getUserPhotoByPhotoId(photoId);
        if (!photo) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

        // 调用 Coze 换脸（同步模式）
        try {
          const rawTemplateImageUrl = template.hasMaskRegions && template.maskedImageUrl
            ? template.maskedImageUrl
            : template.imageUrl;

          // 确保所有图片 URL 都是公网可访问的
          const [publicSelfieUrl, publicTemplateUrl] = await Promise.all([
            ensurePublicUrl(input.selfieUrl),
            ensurePublicUrl(rawTemplateImageUrl),
          ]);

          console.log('[photo.createSinglePublic] 开始换脸:', {
            templateId: template.id,
            selfieUrl: publicSelfieUrl,
            templateImageUrl: publicTemplateUrl,
          });

          const { executeId, resultUrls } = await coze.faceSwapSingle({
            userImageUrl: publicSelfieUrl,
            templateImageUrls: [publicTemplateUrl],
          });

          console.log('[photo.createSinglePublic] Coze 返回结果:', { executeId, resultUrls });

          if (resultUrls && resultUrls.length > 0 && resultUrls[0]) {
            let finalResultUrl = resultUrls[0];
            console.log('[photo.createSinglePublic] Coze返回原始URL:', finalResultUrl);

            // 下载 Coze 返回的图片并上传到 COS（Coze 返回短链接，小程序无法直接加载）
            try {
              const { downloadImage, restoreRegions } = await import('./imageMask');

              // 如果模板有遮盖区域，需要还原
              if (template.hasMaskRegions && template.regionCacheUrl) {
                const [swappedBuffer, regionCacheBuffer] = await Promise.all([
                  downloadImage(resultUrls[0]),
                  downloadImage(template.regionCacheUrl),
                ]);
                const restoredBuffer = await restoreRegions(swappedBuffer, regionCacheBuffer);
                const fileKey = `photos/${photoId}_restored_${Date.now()}.jpg`;
                const { url } = await storagePut(fileKey, restoredBuffer, 'image/jpeg');
                finalResultUrl = url;
                console.log('[photo.createSinglePublic] 遮盖还原后上传到COS:', finalResultUrl);
              } else {
                // 无遮盖区域，直接下载并上传到 COS
                const imageBuffer = await downloadImage(resultUrls[0]);
                const fileKey = `photos/${photoId}_${Date.now()}.jpg`;
                const { url } = await storagePut(fileKey, imageBuffer, 'image/jpeg');
                finalResultUrl = url;
                console.log('[photo.createSinglePublic] 上传到COS:', finalResultUrl);
              }
            } catch (uploadError: any) {
              console.error('[photo.createSinglePublic] 上传COS失败，使用原始URL:', uploadError.message);
              // 上传失败时仍使用原始 URL，让前端尝试处理
            }

            console.log('[photo.createSinglePublic] 更新数据库状态为completed');
            await db.updateUserPhotoStatus(photo.id, {
              status: 'completed',
              workflowRunId: executeId,
              resultUrl: finalResultUrl,
              progress: 100,
            });

            // 发送 WebSocket 通知
            if (input.userOpenId) {
              notifyPhotoStatus(input.userOpenId, photoId, 'completed', [finalResultUrl]);
            }

            console.log('[photo.createSinglePublic] 返回成功结果:', { photoId, status: 'completed', resultUrl: finalResultUrl });
            return { photoId, status: 'completed', resultUrl: finalResultUrl };
          } else {
            await db.updateUserPhotoStatus(photo.id, {
              status: 'failed',
              workflowRunId: executeId,
              errorMessage: '换脸未生成结果图片',
            });

            // 发送 WebSocket 失败通知
            if (input.userOpenId) {
              notifyPhotoStatus(input.userOpenId, photoId, 'failed');
            }

            return { photoId, status: 'failed', error: '换脸未生成结果图片' };
          }
        } catch (error: any) {
          console.error('[photo.createSinglePublic] 换脸失败:', error);
          await db.updateUserPhotoStatus(photo.id, {
            status: 'failed',
            errorMessage: error.message,
          });

          // 发送 WebSocket 失败通知
          if (input.userOpenId) {
            notifyPhotoStatus(input.userOpenId, photoId, 'failed');
          }

          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),

    // 公开查询照片状态（小程序使用）
    getStatusPublic: publicProcedure
      .input(z.object({ photoId: z.string() }))
      .query(async ({ input }) => {
        const photo = await db.getUserPhotoByPhotoId(input.photoId);
        if (!photo) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '照片不存在' });
        }
        return {
          photoId: photo.photoId,
          status: photo.status,
          resultUrl: photo.resultUrl,
          progress: photo.progress,
        };
      }),

    // 公开获取照片详情（P9 分享页使用）
    getByIdPublic: publicProcedure
      .input(z.object({ photoId: z.string() }))
      .query(async ({ input }) => {
        const photo = await db.getUserPhotoByPhotoId(input.photoId);
        if (!photo) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '照片不存在或已删除' });
        }

        // 返回照片详情，包括结果图片数组
        return {
          id: photo.id,
          photoId: photo.photoId,
          templateId: photo.templateId,
          userId: photo.userId,
          selfieUrl: photo.selfieUrl,
          resultUrl: photo.resultUrl,
          resultUrls: photo.resultUrl ? [photo.resultUrl] : [], // 兼容多图格式
          status: photo.status,
          progress: photo.progress,
          errorMessage: photo.errorMessage,
          createdAt: photo.createdAt,
        };
      }),

    // 上传自拍照
    uploadSelfie: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string().default('image/jpeg'),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.imageBase64, 'base64');
        const fileKey = `selfies/${ctx.user.id}/${nanoid()}.jpg`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // Update user's lastSelfieUrl and lastSelfieTime
        await db.updateUser(ctx.user.id, {
          lastSelfieUrl: url,
          lastSelfieTime: new Date(),
        });

        return { url, fileKey };
      }),

    // AI 用户判别（同步模式，直接返回结果）
    analyzeUser: protectedProcedure
      .input(z.object({
        selfieUrl: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // 调用 Coze 用户判别 API（同步模式）
          const result = await coze.analyzeUserFace({
            userImageUrl: input.selfieUrl,
          });

          if (!result.success) {
            return { 
              success: false, 
              error: result.errorMessage || '分析失败' 
            };
          }

          // 更新用户资料
          await db.updateUserProfile(ctx.user.id, {
            gender: result.gender,
            userType: result.userType,
            faceType: result.faceType,
          });

          return {
            success: true,
            executeId: result.executeId,
            faceType: result.faceType,      // "宽脸" | "窄脸"
            gender: result.gender,          // "男" | "女"
            userType: result.userType,      // "少女" | "熟女" 等
            description: result.description,
            package: result.package,
          };
        } catch (error: any) {
          console.error('[photo.analyzeUser] Error:', error);
          return { success: false, error: error.message };
        }
      }),

    // 创建单人换脸任务
    createSingle: protectedProcedure
      .input(z.object({
        selfieUrl: z.string(),
        templateId: z.number(),
        channelId: z.number().optional(),
        salesId: z.number().optional(),
        detectedFaceType: z.string().optional(), // 用户判别的脸型："宽脸" | "窄脸"
      }))
      .mutation(async ({ ctx, input }) => {
        let template = await db.getTemplateById(input.templateId);
        if (!template) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '模板不存在' });
        }

        // 检查用户积分
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });

        if (!template.isFree && user.points < template.price) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '积分不足' });
        }

        // 脸型模板匹配逻辑
        // 只有这五种人群类型需要区分宽窄脸
        const faceTypeGroups = ['girl_young', 'woman_mature', 'woman_elder', 'man_young', 'man_elder'];
        const needFaceTypeMatch = faceTypeGroups.includes(template.groupType || '');
        
        if (needFaceTypeMatch && input.detectedFaceType) {
          // 将中文脸型转换为数据库存储的英文值
          const targetFaceType = coze.convertFaceTypeToDb(input.detectedFaceType);
          
          if (targetFaceType && targetFaceType !== template.faceType) {
            // 查找匹配的脸型模板
            const matchingTemplate = await db.findMatchingTemplate({
              originalTemplateId: template.id,
              targetFaceType,
            });
            
            if (matchingTemplate) {
              console.log(`[photo.createSingle] 匹配到${input.detectedFaceType}模板:`, matchingTemplate.id, matchingTemplate.name);
              template = matchingTemplate;
            } else {
              // P2: 降级策略日志 - 未找到匹配的脸型模板时，使用原模板
              console.warn(`[photo.createSingle] 降级: 未找到${input.detectedFaceType}(${targetFaceType})模板，使用原模板 (id=${template.id}, name=${template.name}, faceType=${template.faceType})`);
            }
          }
        }

        // 创建照片记录（使用匹配后的模板ID）
        const photoId = await db.generatePhotoId();
        await db.createUserPhoto({
          photoId,
          userId: ctx.user.id,
          templateId: template.id, // 使用匹配后的模板ID
          selfieUrl: input.selfieUrl,
          photoType: 'single',
          status: 'pending',
          detectedFaceType: input.detectedFaceType || null, // 保存用户脸型
        });

        const photo = await db.getUserPhotoByPhotoId(photoId);
        if (!photo) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

        // 扣除积分
        if (!template.isFree) {
          await db.updateUserPoints(ctx.user.id, -template.price, `生成照片消费`, undefined);
        }

        // 创建订单记录（关联渠道和推广员）
        const orderNo = `P${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        await db.createOrder({
          orderNo,
          userId: ctx.user.id,
          channelId: input.channelId || user.channelId || null,
          salesId: input.salesId || user.salesId || null,
          orderType: 'single_photo',
          orderAmount: template.isFree ? 0 : template.price * 100, // 积分转换为分
          pointsUsed: template.isFree ? 0 : template.price,
          orderStatus: 'paid', // 积分支付直接完成
          paymentMethod: 'points',
          paymentTime: new Date(),
          photoCount: 1,
          scenicSpot: template.scenicSpot,
        });

        // 调用 Coze 换脸（同步模式，直接返回结果）
        try {
          // 确定使用的模板图片URL（如果有遮盖版则使用遮盖版）
          const templateImageUrl = template.hasMaskRegions && template.maskedImageUrl 
            ? template.maskedImageUrl 
            : template.imageUrl;
          
          console.log('[photo.createSingle] 使用模板:', {
            templateId: template.id,
            hasMaskRegions: template.hasMaskRegions,
            usingMaskedImage: !!template.maskedImageUrl,
            templateImageUrl,
          });

          const { executeId, resultUrls } = await coze.faceSwapSingle({
            userImageUrl: input.selfieUrl,
            templateImageUrls: [templateImageUrl],
          });

          // 单人换脸是同步返回的，直接更新为完成状态
          if (resultUrls && resultUrls.length > 0 && resultUrls[0]) {
            let finalResultUrl = resultUrls[0];
            
            // 如果模板有遮盖区域，需要还原雕塑区域
            if (template.hasMaskRegions && template.regionCacheUrl) {
              try {
                console.log('[photo.createSingle] 开始还原遮盖区域...');
                const { downloadImage, restoreRegions } = await import('./imageMask');
                const { storagePut } = await import('./storage');
                
                // 下载换脸结果和区域缓存
                const [swappedBuffer, regionCacheBuffer] = await Promise.all([
                  downloadImage(resultUrls[0]),
                  downloadImage(template.regionCacheUrl),
                ]);
                
                // 还原遮盖区域
                const restoredBuffer = await restoreRegions(swappedBuffer, regionCacheBuffer);
                
                // 上传还原后的图片
                const fileKey = `photos/${photoId}_restored_${Date.now()}.jpg`;
                const { url } = await storagePut(fileKey, restoredBuffer, 'image/jpeg');
                finalResultUrl = url;
                
                console.log('[photo.createSingle] 遮盖区域还原完成:', finalResultUrl);
              } catch (restoreError: any) {
                console.error('[photo.createSingle] 还原遮盖区域失败:', restoreError.message);
                // 还原失败时使用原始换脸结果
              }
            }
            
            await db.updateUserPhotoStatus(photo.id, {
              status: 'completed',
              workflowRunId: executeId,
              resultUrl: finalResultUrl,
              progress: 100,
            });
          } else {
            await db.updateUserPhotoStatus(photo.id, {
              status: 'failed',
              workflowRunId: executeId,
              errorMessage: '换脸未生成结果图片',
            });
          }

          return { photoId, executeId, resultUrls };
        } catch (error: any) {
          await db.updateUserPhotoStatus(photo.id, {
            status: 'failed',
            errorMessage: error.message,
          });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),

    // 查询照片生成状态
    getStatus: protectedProcedure
      .input(z.object({ photoId: z.string() }))
      .query(async ({ ctx, input }) => {
        const photo = await db.getUserPhotoByPhotoId(input.photoId);
        if (!photo || photo.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '照片不存在' });
        }

        // 如果正在处理中，查询 Coze 状态
        if (photo.status === 'processing' && photo.workflowRunId) {
          try {
            const result = await coze.getWorkflowResult(photo.workflowRunId);
            
            if (result.status === 'completed') {
              const swapResult = coze.parseFaceSwapResult(result.output);
              if (swapResult.success && swapResult.resultUrls?.[0]) {
                await db.updateUserPhotoStatus(photo.id, {
                  status: 'completed',
                  resultUrl: swapResult.resultUrls[0],
                  progress: 100,
                });
                return {
                  ...photo,
                  status: 'completed' as const,
                  resultUrl: swapResult.resultUrls[0],
                  progress: 100,
                };
              }
            } else if (result.status === 'failed') {
              await db.updateUserPhotoStatus(photo.id, {
                status: 'failed',
                errorMessage: result.error,
              });
              return {
                ...photo,
                status: 'failed' as const,
                errorMessage: result.error,
              };
            }
          } catch (e) {
            // 忽略查询错误，返回当前状态
          }
        }

        return photo;
      }),

    // 获取用户照片列表
    list: protectedProcedure
      .input(z.object({
        status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const photos = await db.getUserPhotosByUserId(ctx.user.id);
        if (input?.status) {
          return photos.filter(p => p.status === input.status);
        }
        return photos;
      }),

    // 获取单张照片详情
    getDetail: protectedProcedure
      .input(z.object({ photoId: z.string() }))
      .query(async ({ ctx, input }) => {
        const photo = await db.getUserPhotoByPhotoId(input.photoId);
        if (!photo || photo.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '照片不存在' });
        }
        
        const template = await db.getTemplateById(photo.templateId);
        return { photo, template };
      }),

    // 批量获取照片详情
    getByIds: protectedProcedure
      .input(z.object({ photoIds: z.array(z.string()) }))
      .query(async ({ ctx, input }) => {
        const photos = await Promise.all(
          input.photoIds.map(async (photoId) => {
            const photo = await db.getUserPhotoByPhotoId(photoId);
            if (!photo || photo.userId !== ctx.user.id) {
              return null;
            }
            return {
              photoId: photo.photoId,
              resultUrl: photo.resultUrl,
              status: photo.status,
            };
          })
        );
        
        return photos.filter(p => p !== null);
      }),

    // 分享照片
    share: protectedProcedure
      .input(z.object({ photoId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const photo = await db.getUserPhotoByPhotoId(input.photoId);
        if (!photo || photo.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '照片不存在' });
        }
        // 增加分享计数
        // TODO: 实现分享逻辑
        return { success: true };
      }),
  }),

  // 合照邀请路由
  invitation: router({
    // 创建合照邀请
    create: protectedProcedure
      .input(z.object({
        templateId: z.number(),
        selfieUrl: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const template = await db.getTemplateById(input.templateId);
        if (!template || template.photoType !== 'group') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '模板不支持合照' });
        }

        const invitationCode = await db.generateInvitationCode();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24小时有效

        await db.createPhotoInvitation({
          invitationCode,
          initiatorId: ctx.user.id,
          templateId: input.templateId,
          initiatorSelfieUrl: input.selfieUrl,
          expiresAt,
        });

        return { invitationCode };
      }),

    // 获取邀请详情
    getByCode: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        const invitation = await db.getPhotoInvitationByCode(input.code);
        if (!invitation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '邀请不存在' });
        }
        
        if (new Date(invitation.expiresAt) < new Date()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '邀请已过期' });
        }

        const template = await db.getTemplateById(invitation.templateId);
        return { invitation, template };
      }),

    // 接受邀请
    accept: protectedProcedure
      .input(z.object({
        code: z.string(),
        selfieUrl: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const invitation = await db.getPhotoInvitationByCode(input.code);
        if (!invitation) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '邀请不存在' });
        }

        if (invitation.status !== 'pending') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '邀请状态无效' });
        }

        if (new Date(invitation.expiresAt) < new Date()) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '邀请已过期' });
        }

        // 更新邀请
        await db.updatePhotoInvitation(invitation.id, {
          partnerId: ctx.user.id,
          partnerSelfieUrl: input.selfieUrl,
          status: 'accepted',
        });

        // 创建合照任务
        const template = await db.getTemplateById(invitation.templateId);
        if (!template) throw new TRPCError({ code: 'NOT_FOUND' });

        const photoId = await db.generatePhotoId();
        await db.createUserPhoto({
          photoId,
          userId: invitation.initiatorId,
          templateId: invitation.templateId,
          selfieUrl: invitation.initiatorSelfieUrl,
          selfie2Url: input.selfieUrl,
          photoType: 'group',
          invitationId: invitation.id,
          status: 'pending',
        });

        const photo = await db.getUserPhotoByPhotoId(photoId);
        if (!photo) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

        // 调用双人换脸（同步模式，直接返回结果）
        try {
          const { executeId, resultUrls } = await coze.faceSwapCouple({
            user1ImageUrl: invitation.initiatorSelfieUrl,
            user2ImageUrl: input.selfieUrl,
            templateImageUrls: [template.imageUrl],
          });

          // 双人换脸是同步返回的，直接更新为完成状态
          if (resultUrls && resultUrls.length > 0) {
            await db.updateUserPhotoStatus(photo.id, {
              status: 'completed',
              workflowRunId: executeId,
              resultUrl: resultUrls[0], // 使用第一张结果图
            });
          } else {
            await db.updateUserPhotoStatus(photo.id, {
              status: 'failed',
              workflowRunId: executeId,
              errorMessage: '换脸未生成结果图片',
            });
          }

          await db.updatePhotoInvitation(invitation.id, { status: 'completed' });

          return { photoId, executeId, resultUrls };
        } catch (error: any) {
          await db.updateUserPhotoStatus(photo.id, {
            status: 'failed',
            errorMessage: error.message,
          });
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
        }
      }),
  }),

  // 渠道管理路由
  channel: router({
    // 获取渠道列表
    list: adminProcedure
      .input(z.object({
        channelType: z.string().optional(),
        status: z.string().optional(),
        searchTerm: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getChannels(input);
      }),

    // 获取单个渠道
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getChannelById(input.id);
      }),

    // 创建渠道
    create: adminProcedure
      .input(z.object({
        channelName: z.string().min(1),
        channelType: z.enum(['institution', 'individual']),
        cities: z.array(z.string()).min(1),
        scenicSpots: z.array(z.string()).min(1),
        cooperationStartDate: z.date(),
        cooperationDays: z.number().default(360),
        commissionRate: z.number().min(5).max(80).default(50),
        institutionRetentionRate: z.number().min(0).max(100).optional(),
        salesCommissionRate: z.number().min(0).max(100).optional(),
        newUserPoints: z.number().default(10),
        promotionActivity: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const channelCode = await db.generateChannelCode(input.channelType);
        
        const cooperationEndDate = new Date(input.cooperationStartDate);
        cooperationEndDate.setDate(cooperationEndDate.getDate() + input.cooperationDays);
        
        await db.createChannel({
          channelCode,
          channelName: input.channelName,
          channelType: input.channelType,
          contactPerson: input.channelName, // 使用渠道名称作为默认联系人
          cities: JSON.stringify(input.cities),
          scenicSpots: JSON.stringify(input.scenicSpots),
          cooperationStartDate: input.cooperationStartDate,
          cooperationDays: input.cooperationDays,
          cooperationEndDate,
          commissionRate: input.commissionRate,
          institutionRetentionRate: input.institutionRetentionRate,
          salesCommissionRate: input.salesCommissionRate,
          newUserPoints: input.newUserPoints,
          promotionActivity: input.promotionActivity,
          loginAccount: channelCode,
          loginPassword: '123456',
        });

        const channel = await db.getChannelByCode(channelCode);
        if (!channel) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

        // 为每个城市/景区组合生成推广码
        const { generateAllPlatformCodes } = await import('./qrcode');
        
        for (const city of input.cities) {
          for (const scenic of input.scenicSpots) {
            const promoCode = `${channelCode}-${city.substring(0, 2)}-${scenic.substring(0, 2)}-${nanoid(4)}`.toUpperCase();
            const promotionLink = `/app?channel=${channelCode}&city=${encodeURIComponent(city)}&scenic=${encodeURIComponent(scenic)}`;
            
            // 生成微信和抖音小程序二维码
            let wechatLink = '';
            let wechatQrCodeUrl = '';
            let douyinLink = '';
            let douyinQrCodeUrl = '';
            
            try {
              const qrCodes = await generateAllPlatformCodes({
                channelCode,
                city,
                scenicSpot: scenic,
              });
              wechatLink = qrCodes.wechatLink;
              wechatQrCodeUrl = qrCodes.wechatQrCodeUrl;
              douyinLink = qrCodes.douyinLink;
              douyinQrCodeUrl = qrCodes.douyinQrCodeUrl;
            } catch (err) {
              console.error('生成二维码失败:', err);
            }
            
            await db.createPromotionCode({
              channelId: channel.id,
              promoCode,
              city,
              scenicSpot: scenic,
              promotionLink,
              wechatLink,
              wechatQrCodeUrl,
              douyinLink,
              douyinQrCodeUrl,
              status: 'active',
            });
          }
        }

        // 创建渠道用户账号
        await db.createChannelUser({
          username: channelCode,
          role: input.channelType === 'institution' ? 'institution_channel' : 'individual_channel',
          channelId: channel.id,
        });

        // 为个人渠道创建默认销售
        if (input.channelType === 'individual') {
          const salesCode = await db.generateSalesCode(channelCode);
          await db.createSales({
            channelId: channel.id,
            salesCode,
            salesName: input.channelName, // 使用渠道名称作为销售名称
            status: 'active',
            commissionRate: 100,
            loginAccount: salesCode,
            loginPassword: '123456',
          });
        }

        // 发送渠道新建通知短信
        if (sms.isSmsConfigured()) {
          try {
            await sms.sendChannelNotification('create', input.channelName);
          } catch (err) {
            console.error('发送渠道新建通知失败:', err);
          }
        }

        return { success: true, channelId: channel.id, channelCode };
      }),

    // 更新渠道
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        channelName: z.string().optional(),
        contactPerson: z.string().optional(),
        contactPhone: z.string().optional(),
        status: z.enum(['active', 'inactive', 'expired']).optional(),
        commissionRate: z.number().optional(),
        newUserPoints: z.number().optional(),
        promotionActivity: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateChannel(id, data);
        return { success: true };
      }),

    // 删除渠道
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        // 先获取渠道信息用于发送通知
        const channel = await db.getChannelById(input.id);
        const channelName = channel?.channelName || '未知渠道';
        
        await db.deleteChannel(input.id);
        
        // 发送渠道删除通知短信
        if (sms.isSmsConfigured()) {
          try {
            await sms.sendChannelNotification('delete', channelName);
          } catch (err) {
            console.error('发送渠道删除通知失败:', err);
          }
        }
        
        return { success: true };
      }),

    // 切换渠道状态
    toggleStatus: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const newStatus = await db.toggleChannelStatus(input.id);
        return { success: true, status: newStatus };
      }),

    // 获取推广码列表
    promotionCodes: adminProcedure
      .input(z.object({ channelId: z.number() }))
      .query(async ({ input }) => {
        return db.getPromotionCodesByChannelId(input.channelId);
      }),

    // 重新生成推广码二维码
    regenerateQRCode: adminProcedure
      .input(z.object({ promotionCodeId: z.number() }))
      .mutation(async ({ input }) => {
        const promoCode = await db.getPromotionCodeById(input.promotionCodeId);
        if (!promoCode) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '推广码不存在' });
        }

        const channel = await db.getChannelById(promoCode.channelId);
        if (!channel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '渠道不存在' });
        }

        const { generateAllPlatformCodes } = await import('./qrcode');
        
        try {
          const qrCodes = await generateAllPlatformCodes({
            channelCode: channel.channelCode,
            city: promoCode.city,
            scenicSpot: promoCode.scenicSpot,
          });

          await db.updatePromotionCodeQRCodes(input.promotionCodeId, {
            wechatLink: qrCodes.wechatLink,
            wechatQrCodeUrl: qrCodes.wechatQrCodeUrl,
            douyinLink: qrCodes.douyinLink,
            douyinQrCodeUrl: qrCodes.douyinQrCodeUrl,
          });

          return { 
            success: true, 
            wechatQrCodeUrl: qrCodes.wechatQrCodeUrl,
            douyinQrCodeUrl: qrCodes.douyinQrCodeUrl,
          };
        } catch (error) {
          console.error('生成二维码失败:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '生成二维码失败' });
        }
      }),

    // 获取销售人员列表
    salesList: adminProcedure
      .input(z.object({ channelId: z.number() }))
      .query(async ({ input }) => {
        return db.getSalesByChannelId(input.channelId);
      }),

    // 创建销售人员
    createSales: adminProcedure
      .input(z.object({
        channelId: z.number(),
        salesName: z.string().min(1),
        commissionRate: z.number().min(0).max(100),
        city: z.string().optional(),
        scenicSpot: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const channel = await db.getChannelById(input.channelId);
        if (!channel) throw new TRPCError({ code: 'NOT_FOUND' });

        const salesCode = await db.generateSalesCode(channel.channelCode);
        
        await db.createSales({
          channelId: input.channelId,
          salesCode,
          salesName: input.salesName,
          commissionRate: input.commissionRate,
          city: input.city,
          scenicSpot: input.scenicSpot,
          loginAccount: salesCode,
          loginPassword: '123456',
        });

        await db.createChannelUser({
          username: salesCode,
          role: 'sales',
          channelId: input.channelId,
        });

        return { success: true, salesCode };
      }),

    // 获取统计数据
    stats: adminProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getChannelStats(input?.startDate, input?.endDate);
      }),

    // 获取排行榜
    ranking: adminProcedure
      .input(z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getChannelRanking(input?.startDate, input?.endDate);
      }),
  }),

  // 订单路由
  order: router({
    // 获取用户订单列表
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrdersByUserId(ctx.user.id);
    }),

    // 获取订单详情
    getById: protectedProcedure
      .input(z.object({ orderNo: z.string() }))
      .query(async ({ ctx, input }) => {
        const order = await db.getOrderByOrderNo(input.orderNo);
        if (!order || order.userId !== ctx.user.id) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }
        return order;
      }),

  }),

  // 管理员仪表盘
  admin: router({
    // 获取仪表盘统计
    dashboard: adminProcedure.query(async () => {
      const stats = await db.getChannelStats();
      return stats;
    }),

    // 获取所有模板（包括未激活）
    allTemplates: adminProcedure
      .input(z.object({
        city: z.string().optional(),
        scenicSpot: z.string().optional(),
        status: z.enum(['active', 'inactive']).optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getTemplates(input);
      }),
    
    // 根据模板ID列表获取模板信息
    getTemplatesByIds: adminProcedure
      .input(z.object({ templateIds: z.array(z.string()) }))
      .query(async ({ input }) => {
        const templates = await db.getTemplatesByTemplateIds(input.templateIds);
        return templates.map(t => ({
          templateId: t.templateId,
          imageUrl: t.imageUrl,
        }));
      }),

    // 获取订单列表（管理员）
    orders: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        channelId: z.number().optional(),
        searchTerm: z.string().optional(),
        city: z.string().optional(),
        scenicSpot: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        sortBy: z.enum(['createdAt', 'orderAmount']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const filters = input ? {
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        } : undefined;
        return db.getAllOrders(filters);
      }),

    // 获取订单详情
    orderDetail: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return db.getOrderDetail(input.orderId);
      }),

    // 更新订单状态
    updateOrderStatus: adminProcedure
      .input(z.object({
        orderId: z.number(),
        status: z.enum(['pending', 'paid', 'completed', 'failed']),
      }))
      .mutation(async ({ input }) => {
        await db.updateOrderStatus(input.orderId, input.status);
        return { success: true };
      }),

    // 导出订单
    exportOrders: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        channelId: z.number().optional(),
        searchTerm: z.string().optional(),
        city: z.string().optional(),
        scenicSpot: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        fields: z.array(z.string()).optional(),
      }).optional())
      .query(async ({ input }) => {
        const filters = input ? {
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        } : undefined;
        return db.exportOrders(filters);
      }),

    // 获取订单统计
    orderStats: adminProcedure.query(async () => {
      return db.getOrderStats();
    }),

    // 获取用户列表（管理员）
    users: adminProcedure
      .input(z.object({
        searchTerm: z.string().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllUsers(input);
      }),

    // 获取用户统计
    userStats: adminProcedure.query(async () => {
      return db.getUserStats();
    }),

    // ==================== 城市管理 ====================
    
    // 获取所有城市
    cities: adminProcedure.query(async () => {
      return db.getAllCities();
    }),

    // 获取城市和景点列表（用于筛选和下拉选择）
    citySpots: adminProcedure.query(async () => {
      const cities = await db.getAllCities();
      const spots = await db.getAllSpots();
      // 返回所有城市和景点，不过滤 isActive 状态
      return cities.map((city: any) => ({
        city: city.name,
        spots: spots.filter((s: any) => s.cityId === city.id).map((s: any) => ({
          id: s.id,
          name: s.name
        }))
      }));
    }),

    // 创建城市
    createCity: adminProcedure
      .input(z.object({
        name: z.string().min(1, '城市名称不能为空'),
        pinyin: z.string().min(1, '拼音不能为空'),
      }))
      .mutation(async ({ input }) => {
        await db.createCity(input);
        return { success: true };
      }),

    // 更新城市
    updateCity: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        pinyin: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCity(id, data);
        return { success: true };
      }),

    // 删除城市
    deleteCity: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await db.deleteCity(input.id);
          return { success: true };
        } catch (error: any) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message });
        }
      }),

    // ==================== 景点管理 ====================
    
    // 获取所有景点
    spots: adminProcedure
      .input(z.object({ cityId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllSpots(input?.cityId);
      }),

    // 创建景点
    createSpot: adminProcedure
      .input(z.object({
        name: z.string().min(1, '景点名称不能为空'),
        cityId: z.number(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createSpot(input);
        return { success: true };
      }),

    // 更新景点
    updateSpot: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        cityId: z.number().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateSpot(id, data);
        return { success: true };
      }),

    // 删除景点
    deleteSpot: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSpot(input.id);
        return { success: true };
      }),

    // ==================== 分享配置 ====================
    
    // 获取所有分享配置
    shareConfigs: adminProcedure.query(async () => {
      return db.getAllShareConfigs();
    }),

    // 保存分享配置
    saveShareConfig: adminProcedure
      .input(z.object({
        pageCode: z.string(),
        pageName: z.string(),
        title: z.string().optional(),
        coverUrl: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertShareConfig(input);
        return { success: true };
      }),

    // ==================== 系统配置 ====================
    
    // 获取所有系统配置
    systemConfigs: adminProcedure.query(async () => {
      return db.getAllSystemConfigs();
    }),

    // 获取单个系统配置
    getSystemConfig: adminProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return db.getSystemConfig(input.key);
      }),

    // 保存系统配置
    saveSystemConfig: adminProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.setSystemConfig(input.key, input.value, input.description);
        return { success: true };
      }),

    // 删除系统配置
    deleteSystemConfig: adminProcedure
      .input(z.object({ key: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteSystemConfig(input.key);
        return { success: true };
      }),

    // 测试API连接
    testApiConnection: adminProcedure
      .input(z.object({
        configKey: z.string(),
        configValue: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { configKey, configValue } = input;
        
        if (!configValue) {
          return { success: false, message: '配置值不能为空' };
        }
        
        try {
          // 测试腾讯地图API
          if (configKey === 'TENCENT_MAP_API_KEY') {
            const keyword = encodeURIComponent('西湖');
            const city = encodeURIComponent('杭州');
            const url = `https://apis.map.qq.com/ws/place/v1/search?keyword=${keyword}&boundary=region(${city},0)&key=${configValue}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status === 0) {
              return { success: true, message: '腾讯地图API连接成功' };
            } else {
              return { success: false, message: `连接失败: ${data.message || '未知错误'}` };
            }
          }
          
          // 测试Coze API Key
          if (configKey === 'COZE_API_KEY') {
            // 简单验证API Key格式
            if (!configValue.startsWith('pat_') && !configValue.startsWith('sat_')) {
              return { success: false, message: 'API Key格式不正确，应以pat_或sat_开头' };
            }
            // 尝试调用Coze API验证
            const response = await fetch('https://api.coze.cn/v1/workflow/run', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${configValue}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                workflow_id: 'test',
                parameters: {},
              }),
            });
            const data = await response.json();
            // 如果返回的错误不是认证错误，说明API Key有效
            if (data.code === 4100) {
              return { success: false, message: 'API Key无效或已过期' };
            }
            return { success: true, message: 'Coze API Key验证通过' };
          }
          
          // 测试Coze工作流ID
          if (configKey.startsWith('COZE_') && configKey.endsWith('_WORKFLOW_ID')) {
            // 验证工作流ID格式（纯数字）
            if (!/^\d+$/.test(configValue)) {
              return { success: false, message: '工作流ID格式不正确，应为纯数字' };
            }
            // 获取Coze API Key进行测试
            const cozeApiKey = await db.getSystemConfig('COZE_API_KEY');
            if (!cozeApiKey) {
              return { success: false, message: '请先配置Coze API Key' };
            }
            // 尝试调用工作流（会失败，但可以验证工作流是否存在）
            const response = await fetch('https://api.coze.cn/v1/workflow/run', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${cozeApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                workflow_id: configValue,
                parameters: {},
              }),
            });
            const data = await response.json();
            // 检查错误类型
            if (data.code === 4000 && data.msg?.includes('workflow not found')) {
              return { success: false, message: '工作流ID不存在' };
            }
            if (data.code === 4100) {
              return { success: false, message: 'API Key无效，请先配置正确的Coze API Key' };
            }
            // 其他错误（如参数缺失）说明工作流存在
            return { success: true, message: '工作流ID验证通过' };
          }
          
          return { success: true, message: '配置已保存' };
        } catch (error: any) {
          console.error('[API Test] Error:', error);
          return { success: false, message: `测试失败: ${error.message}` };
        }
      }),

    // 上传IP形象图片
    uploadIpImage: adminProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string().default('image/jpeg'),
        fileName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.imageBase64, 'base64');
        const ext = input.mimeType === 'image/png' ? 'png' : 'jpg';
        const fileKey = `ip-images/${nanoid()}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return { url, fileKey };
      }),

    // ==================== 人群类型管理 ====================
    
    // 获取所有人群类型
    groupTypes: adminProcedure.query(async () => {
      return db.getAllGroupTypes();
    }),

    // 创建人群类型
    createGroupType: adminProcedure
      .input(z.object({
        code: z.string().min(1, '代码不能为空'),
        displayName: z.string().min(1, '显示名称不能为空'),
        photoType: z.enum(['single', 'group']).default('single'),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        // 验证显示名称长度
        const maxLength = input.photoType === 'single' ? 4 : 7;
        if (input.displayName.length > maxLength) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `${input.photoType === 'single' ? '单人照' : '合照'}类型名称不能超过${maxLength}个字` 
          });
        }
        await db.createGroupType(input);
        return { success: true };
      }),

    // 更新人群类型（允许更新显示名称、启用状态和排序）
    updateGroupType: adminProcedure
      .input(z.object({
        id: z.number(),
        displayName: z.string().max(6, '显示名称不能超过6个字符').optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().min(1).max(7).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, displayName, isActive, sortOrder } = input;
        
        // 如果要更新排序，需要自动调整其他项的排序以避免冲突
        if (sortOrder !== undefined) {
          await db.updateGroupTypeSortOrder(id, sortOrder);
        }
        
        // 更新其他字段
        const updateData: { displayName?: string; isActive?: boolean } = {};
        if (displayName !== undefined) updateData.displayName = displayName;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (Object.keys(updateData).length > 0) {
          await db.updateGroupType(id, updateData);
        }
        
        return { success: true };
      }),

    // 删除人群类型（禁用，类型为固定的19种）
    // deleteGroupType: 已禁用，人群类型为固定的19种，不允许删除
  }),

  // 渠道门户数据路由
  channelPortal: router({
    // 获取渠道统计数据
    stats: publicProcedure
      .input(z.object({ channelId: z.number() }))
      .query(async ({ input }) => {
        return db.getChannelPortalStats(input.channelId);
      }),

    // 获取仪表盘统计数据（增强版）
    dashboardStats: publicProcedure
      .input(z.object({ 
        token: z.string().optional(),
        channelId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        // 从 token 中解析 channelId，或直接使用传入的 channelId
        let channelId = input.channelId;
        if (!channelId && input.token) {
          // 从 token 中提取用户 ID
          const match = input.token.match(/channel_(\d+)_/);
          if (match) {
            const userId = parseInt(match[1]);
            const user = await db.getChannelUserById(userId);
            if (user) {
              channelId = user.channelId || undefined;
            }
          }
        }
        
        if (!channelId) {
          return {
            stats: {
              scanCount: 0,
              newUsers: 0,
              orderCount: 0,
              orderAmount: 0,
              commissionAmount: 0,
              conversionRate: 0,
              todayScanCount: 0,
              todayNewUsers: 0,
              todayOrderCount: 0,
              todayOrderAmount: 0,
            }
          };
        }
        
        const basicStats = await db.getChannelPortalStats(channelId);
        // TODO: 添加更多统计数据
        return {
          stats: {
            scanCount: 0,
            newUsers: basicStats.totalUsers,
            orderCount: basicStats.totalOrders,
            orderAmount: basicStats.totalSales,
            commissionAmount: basicStats.totalCommission,
            conversionRate: basicStats.totalUsers > 0 ? (basicStats.totalOrders / basicStats.totalUsers * 100) : 0,
            todayScanCount: 0,
            todayNewUsers: 0,
            todayOrderCount: 0,
            todayOrderAmount: 0,
          }
        };
      }),

    // 获取订单趋势数据
    orderTrend: publicProcedure
      .input(z.object({ 
        channelId: z.number(),
        days: z.number().default(7),
      }))
      .query(async ({ input }) => {
        return db.getChannelOrderTrend(input.channelId, input.days);
      }),

    // 获取推广码列表
    promoCodes: publicProcedure
      .input(z.object({ channelId: z.number() }))
      .query(async ({ input }) => {
        return db.getPromotionCodesByChannelId(input.channelId);
      }),

    // 获取最近订单
    recentOrders: publicProcedure
      .input(z.object({ channelId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return db.getChannelRecentOrders(input.channelId, input.limit);
      }),

    // 获取渠道信息
    channelInfo: publicProcedure
      .input(z.object({
        token: z.string().optional(),
        channelId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        // 从 token 中解析 channelId，或直接使用传入的 channelId
        let channelId = input.channelId;
        if (!channelId && input.token) {
          // 从 token 中提取用户 ID
          const match = input.token.match(/channel_(\d+)_/);
          if (match) {
            const userId = parseInt(match[1]);
            const user = await db.getChannelUserById(userId);
            if (user) {
              channelId = user.channelId || undefined;
            }
          }
        }
        if (!channelId) {
          return null;
        }
        return db.getChannelById(channelId);
      }),

    // 获取销售人员列表
    salesList: publicProcedure
      .input(z.object({ channelId: z.number() }))
      .query(async ({ input }) => {
        const salesStats = await db.getChannelSalesStats(input.channelId);
        return salesStats.map((s: any) => ({
          id: s.id,
          name: s.salesName,
          username: s.loginAccount,
          isActive: s.status === 'active',
          orderCount: s.totalOrders,
          totalSales: s.totalSalesAmount,
          totalCommission: s.totalCommission,
          createdAt: s.createdAt,
        }));
      }),

    // 添加销售人员
    addSales: publicProcedure
      .input(z.object({
        channelId: z.number(),
        name: z.string(),
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        // 检查用户名是否已存在
        const existingUser = await db.getChannelUserByUsername(input.username);
        if (existingUser) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该用户名已存在' });
        }
        
        // 生成销售员编码
        const salesCode = `S${Date.now().toString(36).toUpperCase()}`;
        
        // 创建销售人员
        await db.createSales({
          channelId: input.channelId,
          salesCode,
          salesName: input.name,
          loginAccount: input.username,
          loginPassword: input.password,
          status: 'active',
        });
        
        // 获取刚创建的销售员
        const salesList = await db.getSalesByChannelId(input.channelId);
        const newSales = salesList.find((s: any) => s.salesCode === salesCode);
        
        if (newSales) {
          // 创建渠道用户账号
          await db.createChannelUser({
            channelId: input.channelId,
            salesId: newSales.id,
            username: input.username,
            role: 'sales',
          });
        }
        
        return newSales;
      }),

    // 添加销售人员（包含城市景点配置）
    addSalesWithScenics: publicProcedure
      .input(z.object({
        channelId: z.number(),
        name: z.string(),
        username: z.string(),
        password: z.string(),
        scenics: z.array(z.object({
          city: z.string(),
          scenicSpot: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        // 检查用户名是否已存在
        const existingUser = await db.getChannelUserByUsername(input.username);
        if (existingUser) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '该用户名已存在' });
        }
        
        // 获取渠道信息
        const channel = await db.getChannelById(input.channelId);
        if (!channel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '渠道不存在' });
        }
        
        // 验证城市景点是否在渠道允许范围内
        const channelCities = JSON.parse(channel.cities || '[]');
        const channelSpots = JSON.parse(channel.scenicSpots || '[]');
        
        for (const scenic of input.scenics) {
          if (!channelCities.includes(scenic.city)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `城市 ${scenic.city} 不在渠道允许范围内` });
          }
          if (!channelSpots.includes(scenic.scenicSpot)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `景点 ${scenic.scenicSpot} 不在渠道允许范围内` });
          }
        }
        
        // 生成销售员编码
        const salesCode = `S${Date.now().toString(36).toUpperCase()}`;
        
        // 创建销售人员
        await db.createSales({
          channelId: input.channelId,
          salesCode,
          salesName: input.name,
          loginAccount: input.username,
          loginPassword: input.password,
          status: 'active',
          assignedScenics: JSON.stringify(input.scenics),
        });
        
        // 获取刚创建的销售员
        const salesList = await db.getSalesByChannelId(input.channelId);
        const newSales = salesList.find((s: any) => s.salesCode === salesCode);
        
        if (!newSales) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '创建推广员失败' });
        }
        
        // 创建渠道用户账号
        await db.createChannelUser({
          channelId: input.channelId,
          salesId: newSales.id,
          username: input.username,
          role: 'sales',
        });
        
        // 为每个城市景点组合生成推广码
        const { generateAllPlatformCodes } = await import('./qrcode');
        let codesCount = 0;
        
        for (const scenic of input.scenics) {
          const promoCode = await db.generateSalesPromoCode(
            channel.channelCode,
            salesCode,
            scenic.city,
            scenic.scenicSpot
          );
          
          // 生成微信和抖音二维码
          let wechatLink = '';
          let wechatQrCodeUrl = '';
          let douyinLink = '';
          let douyinQrCodeUrl = '';
          
          try {
            const qrCodes = await generateAllPlatformCodes({
              channelCode: channel.channelCode,
              salesCode: salesCode,
              city: scenic.city,
              scenicSpot: scenic.scenicSpot,
            });
            wechatLink = qrCodes.wechatLink;
            wechatQrCodeUrl = qrCodes.wechatQrCodeUrl;
            douyinLink = qrCodes.douyinLink;
            douyinQrCodeUrl = qrCodes.douyinQrCodeUrl;
          } catch (err) {
            console.error('生成推广员二维码失败:', err);
          }
          
          // 保存推广码
          await db.createSalesPromotionCode({
            salesId: newSales.id,
            channelId: input.channelId,
            city: scenic.city,
            scenicSpot: scenic.scenicSpot,
            promoCode,
            wechatLink,
            wechatQrCodeUrl,
            douyinLink,
            douyinQrCodeUrl,
          });
          
          codesCount++;
        }
        
        return { salesId: newSales.id, codesCount };
      }),

    // 推广员数据总览统计
    salesDashboardStats: publicProcedure
      .input(z.object({ salesId: z.number() }))
      .query(async ({ input }) => {
        const stats = await db.getSalesStats(input.salesId);
        if (!stats) {
          return {
            todayScan: 0,
            totalScan: 0,
            todayUsers: 0,
            totalUsers: 0,
            todayOrders: 0,
            totalOrders: 0,
            todaySales: 0,
            totalSales: 0,
            totalCommission: 0,
            pendingCommission: 0,
            settledCommission: 0,
            conversionRate: '0.0',
            paidUsers: 0,
          };
        }
        return {
          todayScan: stats.todayScans,
          totalScan: stats.totalScans,
          todayUsers: stats.todayScans,
          totalUsers: stats.totalScans,
          todayOrders: stats.todayOrders,
          totalOrders: stats.totalOrders,
          todaySales: stats.todaySalesAmount,
          totalSales: stats.totalSalesAmount,
          totalCommission: stats.totalCommission,
          pendingCommission: stats.pendingCommission,
          settledCommission: stats.settledCommission,
          conversionRate: stats.conversionRate,
          paidUsers: stats.totalOrders,
        };
      }),

    // 推广员订单查询
    salesOrders: publicProcedure
      .input(z.object({
        salesId: z.number(),
        page: z.number().default(1),
        pageSize: z.number().default(10),
        status: z.string().optional(),
        search: z.string().optional(),
        city: z.string().optional(),
        scenicSpot: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        sortBy: z.enum(['createdAt', 'orderAmount']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
      }))
      .query(async ({ input }) => {
        const result = await db.getOrdersBySalesId(input.salesId, input.page, input.pageSize, {
          status: input.status,
          search: input.search,
          city: input.city,
          scenicSpot: input.scenicSpot,
          startDate: input.startDate,
          endDate: input.endDate,
          sortBy: input.sortBy,
          sortOrder: input.sortOrder,
        });
        return {
          orders: result.orders.map((order: any) => ({
            id: order.id,
            orderNo: order.orderNo,
            orderType: order.orderType,
            orderAmount: order.orderAmount,
            orderStatus: order.orderStatus,
            paymentTime: order.paymentTime,
            createdAt: order.createdAt,
            city: order.city,
            scenicSpot: order.scenicSpot,
            faceType: order.faceType,
            templateIds: order.templateIds,
            resultImages: order.resultImages,
            selfieUrl: order.selfieUrl,
            commissionAmount: order.commissionAmount,
          })),
          total: result.total,
        };
      }),

    // 推广员推广码列表
    salesPromoCodes: publicProcedure
      .input(z.object({ salesId: z.number() }))
      .query(async ({ input }) => {
        const promoCodes = await db.getSalesPromotionCodesBySalesId(input.salesId);
        return promoCodes.map((code: any) => ({
          id: code.id,
          city: code.city,
          scenicSpot: code.scenicSpot,
          promoCode: code.promoCode,
          wechatLink: code.wechatLink,
          wechatQrCodeUrl: code.wechatQrCodeUrl,
          douyinLink: code.douyinLink,
          douyinQrCodeUrl: code.douyinQrCodeUrl,
          status: code.status,
          scanCount: code.scanCount,
          orderCount: code.orderCount,
          createdAt: code.createdAt,
        }));
      }),

    // 推广员信息查询
    salesInfo: publicProcedure
      .input(z.object({ salesId: z.number() }))
      .query(async ({ input }) => {
        const salesData = await db.getSalesById(input.salesId);
        if (!salesData) return null;
        
        const channel = salesData.channelId ? await db.getChannelById(salesData.channelId) : null;
        
        return {
          salesName: salesData.salesName,
          salesCode: salesData.salesCode,
          channelCode: channel?.channelCode || '',
          channelName: channel?.channelName || '-',
          status: salesData.status,
          commissionRate: channel?.commissionRate || 0,
          createdAt: salesData.createdAt,
        };
      }),

    // 配置推广员城市景点并生成二维码
    configureSalesScenics: publicProcedure
      .input(z.object({
        salesId: z.number(),
        channelId: z.number(),
        scenics: z.array(z.object({
          city: z.string(),
          scenicSpot: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        // 获取推广员信息
        const salesData = await db.getSalesById(input.salesId);
        if (!salesData) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '推广员不存在' });
        }
        
        // 获取渠道信息
        const channel = await db.getChannelById(input.channelId);
        if (!channel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '渠道不存在' });
        }
        
        // 验证城市景点是否在渠道允许范围内
        const channelCities = JSON.parse(channel.cities || '[]');
        const channelSpots = JSON.parse(channel.scenicSpots || '[]');
        
        for (const scenic of input.scenics) {
          if (!channelCities.includes(scenic.city)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `城市 ${scenic.city} 不在渠道允许范围内` });
          }
          if (!channelSpots.includes(scenic.scenicSpot)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: `景点 ${scenic.scenicSpot} 不在渠道允许范围内` });
          }
        }
        
        // 删除旧的推广码
        await db.deleteSalesPromotionCodesBySalesId(input.salesId);
        
        // 为每个城市景点组合生成新的推广码
        const { generateAllPlatformCodes } = await import('./qrcode');
        const createdCodes = [];
        
        for (const scenic of input.scenics) {
          const promoCode = await db.generateSalesPromoCode(
            channel.channelCode,
            salesData.salesCode,
            scenic.city,
            scenic.scenicSpot
          );
          
          // 生成微信和抖音二维码
          let wechatLink = '';
          let wechatQrCodeUrl = '';
          let douyinLink = '';
          let douyinQrCodeUrl = '';
          
          try {
            const qrCodes = await generateAllPlatformCodes({
              channelCode: channel.channelCode,
              salesCode: salesData.salesCode,
              city: scenic.city,
              scenicSpot: scenic.scenicSpot,
            });
            wechatLink = qrCodes.wechatLink;
            wechatQrCodeUrl = qrCodes.wechatQrCodeUrl;
            douyinLink = qrCodes.douyinLink;
            douyinQrCodeUrl = qrCodes.douyinQrCodeUrl;
          } catch (err) {
            console.error('生成推广员二维码失败:', err);
          }
          
          // 保存推广码
          await db.createSalesPromotionCode({
            salesId: input.salesId,
            channelId: input.channelId,
            city: scenic.city,
            scenicSpot: scenic.scenicSpot,
            promoCode,
            wechatLink,
            wechatQrCodeUrl,
            douyinLink,
            douyinQrCodeUrl,
          });
          
          createdCodes.push({
            city: scenic.city,
            scenicSpot: scenic.scenicSpot,
            promoCode,
            wechatQrCodeUrl,
            douyinQrCodeUrl,
          });
        }
        
        // 更新推广员的分配景点信息
        await db.updateSales(input.salesId, {
          assignedScenics: JSON.stringify(input.scenics),
        });
        
        return { success: true, codes: createdCodes };
      }),

    // 获取推广员已分配的城市景点
    getSalesScenics: publicProcedure
      .input(z.object({ salesId: z.number() }))
      .query(async ({ input }) => {
        const salesData = await db.getSalesById(input.salesId);
        if (!salesData) {
          return { scenics: [] };
        }
        
        const assignedScenics = salesData.assignedScenics 
          ? JSON.parse(salesData.assignedScenics) 
          : [];
        
        return { scenics: assignedScenics };
      }),

    // 切换销售人员状态
    toggleSalesStatus: publicProcedure
      .input(z.object({
        salesId: z.number(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        
        const { sales } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        
        await database.update(sales)
          .set({ status: input.isActive ? 'active' : 'inactive' })
          .where(eq(sales.id, input.salesId));
        
        return { success: true };
      }),

    // 获取订单列表（分页）
    orders: publicProcedure
      .input(z.object({
        token: z.string().optional(),
        channelId: z.number().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
        status: z.string().optional(),
        search: z.string().optional(),
        city: z.string().optional(),
        scenicSpot: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        salesId: z.number().optional(),
        sortBy: z.enum(['createdAt', 'orderAmount']).default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      }))
      .query(async ({ input }) => {
        let channelId = input.channelId;
        if (!channelId && input.token) {
          const match = input.token.match(/channel_(\d+)_/);
          if (match) {
            const userId = parseInt(match[1]);
            const user = await db.getChannelUserById(userId);
            if (user) {
              channelId = user.channelId || undefined;
            }
          }
        }
        
        if (!channelId) {
          return { orders: [], total: 0 };
        }
        
        // 查询渠道订单
        const result = await db.getChannelOrders({
          channelId,
          page: input.page,
          pageSize: input.pageSize,
          status: input.status,
          search: input.search,
          city: input.city,
          scenicSpot: input.scenicSpot,
          startDate: input.startDate,
          endDate: input.endDate,
          salesId: input.salesId,
          sortBy: input.sortBy,
          sortOrder: input.sortOrder,
        });
        
        return {
          orders: result.orders.map((order: any) => ({
            id: order.id,
            orderNo: order.orderNo,
            orderType: order.orderType,
            orderAmount: order.orderAmount,
            pointsUsed: order.pointsUsed,
            commissionAmount: order.commissionAmount,
            orderStatus: order.orderStatus,
            paymentMethod: order.paymentMethod,
            paymentTime: order.paymentTime,
            photoCount: order.photoCount,
            city: order.city,
            scenicSpot: order.scenicSpot,
            faceType: order.faceType,
            selfieUrl: order.selfieUrl,
            templateIds: order.templateIds,
            resultUrls: order.resultUrls,
            errorCode: order.errorCode,
            errorMessage: order.errorMessage,
            thirdPartyOrderNo: order.thirdPartyOrderNo,
            createdAt: order.createdAt,
            userId: order.userId,
            userOpenId: order.userOpenId,
            userName: order.userName || '未知用户',
            userAvatar: order.userAvatar,
            salesId: order.salesId,
          })),
          total: result.total,
        };
      }),
  }),

  // 渠道认证路由
  channelAuth: router({
    // 统一登录（支持超管、渠道商和推广员）
    login: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        // 检查是否是超级管理员登录
        if (input.username === '18673105881') {
          // 从系统配置获取超管密码，如果没有则使用默认密码
          const superAdminPassword = await db.getSystemConfig('super_admin_password') || '123456';
          if (input.password !== superAdminPassword) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: '账号或密码错误' });
          }
          const token = `admin_superadmin_${Date.now()}`;
          return {
            token,
            user: {
              id: 0,
              username: '18673105881',
              role: 'superadmin' as const,
              channelId: null,
              salesId: null,
              channelName: null,
              channelCode: null,
              channelType: null,
              salesName: null,
              salesCode: null,
              mustChangePassword: false,
            },
          };
        }
        
        const user = await db.getChannelUserByUsername(input.username);
        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '账号或密码错误' });
        }
        
        // 验证密码（简化版，实际应该使用 bcrypt）
        if (user.password !== input.password) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '账号或密码错误' });
        }
        
        if (user.status !== 'enabled') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '账号已被禁用' });
        }
        
        // 更新最后登录时间
        await db.updateChannelUserLastLogin(user.id);
        
        // 获取渠道信息
        let channel = null;
        let channelType = null;
        if (user.channelId) {
          channel = await db.getChannelById(user.channelId);
          channelType = channel?.channelType;
        }
        
        // 获取推广员信息（如果是推广员角色）
        let salesInfo = null;
        if (user.role === 'sales' && user.salesId) {
          salesInfo = await db.getSalesById(user.salesId);
        }
        
        // 生成简单的 token（实际应该使用 JWT）
        const token = `channel_${user.id}_${Date.now()}`;
        
        return {
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            channelId: user.channelId,
            salesId: user.salesId,
            channelName: channel?.channelName,
            channelCode: channel?.channelCode,
            channelType: channelType,
            salesName: salesInfo?.salesName,
            salesCode: salesInfo?.salesCode,
            mustChangePassword: user.mustChangePassword,
          },
        };
      }),

    // 修改密码
    changePassword: publicProcedure
      .input(z.object({
        userId: z.number(),
        oldPassword: z.string().min(1),
        newPassword: z.string().min(6, '新密码至少6位'),
      }))
      .mutation(async ({ input }) => {
        const user = await db.getChannelUserById(input.userId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
        }
        
        if (user.password !== input.oldPassword) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '原密码错误' });
        }
        
        await db.updateChannelUserPassword(user.id, input.newPassword);
        return { success: true };
      }),

    // 获取当前渠道用户信息
    me: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getChannelUserById(input.userId);
        if (!user) return null;
        
        let channel = null;
        if (user.channelId) {
          channel = await db.getChannelById(user.channelId);
        }
        
        return {
          id: user.id,
          username: user.username,
          role: user.role,
          channelId: user.channelId,
          channelName: channel?.channelName,
          mustChangePassword: user.mustChangePassword,
        };
      }),

    // 发送超管密码修改验证码
    sendPasswordVerifyCode: publicProcedure
      .mutation(async () => {
        const phone = sms.getSuperAdminPhone();
        
        // 检查短信服务是否已配置
        if (!sms.isSmsConfigured()) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '短信服务未配置，请联系管理员' });
        }
        
        const result = await sms.sendVerificationCode(phone, 'change_password');
        if (!result.success) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.message });
        }
        
        return { success: true, message: '验证码已发送' };
      }),

    // 超级管理员修改密码（需要验证码）
    changeSuperAdminPassword: publicProcedure
      .input(z.object({
        oldPassword: z.string().min(1),
        newPassword: z.string().min(6, '新密码至少6位'),
        verifyCode: z.string().min(6, '请输入6位验证码'),
      }))
      .mutation(async ({ input }) => {
        const phone = sms.getSuperAdminPhone();
        
        // 验证验证码
        const verifyResult = sms.verifyCode(phone, input.verifyCode, 'change_password');
        if (!verifyResult.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: verifyResult.message });
        }
        
        // 从系统配置获取当前超管密码，如果没有则使用默认密码
        const currentPassword = await db.getSystemConfig('super_admin_password') || '123456';
        
        if (input.oldPassword !== currentPassword) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '原密码错误' });
        }
        
        // 保存新密码到系统配置
        await db.setSystemConfig('super_admin_password', input.newPassword, '超级管理员密码');
        
        return { success: true };
      }),

    // 检查短信服务是否已配置
    checkSmsConfigured: publicProcedure
      .query(() => {
        return { configured: sms.isSmsConfigured() };
      }),
  }),

  // 用户扫码跟踪相关API
  promotion: router({
    // 根据推广码获取推广员和渠道信息
    getPromoInfo: publicProcedure
      .input(z.object({ promoCode: z.string() }))
      .query(async ({ input }) => {
        const info = await db.getSalesInfoByPromoCode(input.promoCode);
        if (!info) return null;
        return {
          salesId: info.salesId,
          channelId: info.channelId,
          city: info.city,
          scenicSpot: info.scenicSpot,
          type: info.type,
        };
      }),

    // 用户扫码后绑定推广员和渠道
    bindUserToSales: publicProcedure
      .input(z.object({
        userOpenId: z.string(),
        // 支持两种方式：1. 完整推广码 2. URL参数
        promoCode: z.string().optional(),
        channelCode: z.string().optional(),
        salesCode: z.string().optional(),
        city: z.string().optional(),
        scenicSpot: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        let info = null;
        
        // 方式1：通过完整推广码查找
        if (input.promoCode) {
          info = await db.getSalesInfoByPromoCode(input.promoCode);
        }
        
        // 方式2：通过URL参数查找（渠道码+推广员码）
        if (!info && input.channelCode && input.salesCode) {
          info = await db.getSalesInfoByUrlParams({
            channelCode: input.channelCode,
            salesCode: input.salesCode,
            city: input.city,
            scenicSpot: input.scenicSpot,
          });
        }
        
        if (!info) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '推广码不存在' });
        }
        
        // 更新用户的推广员和渠道关联
        if (info.salesId) {
          await db.updateUserSalesChannel(input.userOpenId, info.salesId, info.channelId);
        }
        
        return {
          success: true,
          salesId: info.salesId,
          channelId: info.channelId,
        };
      }),
  // 快速生成（使用上次自拍照）
  quickGenerate: router({
    // 快速生成初始化
    init: protectedProcedure
      .input(z.object({
        templateIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });

        // Check if user has lastSelfieUrl
        if (!user.lastSelfieUrl) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '请先拍照' });
        }

        // Calculate total points needed
        let totalPointsNeeded = 0;
        const templates = [];
        for (const templateId of input.templateIds) {
          const template = await db.getTemplateById(templateId);
          if (!template) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `模板 ${templateId} 不存在` });
          }
          templates.push(template);
          if (!template.isFree) {
            totalPointsNeeded += template.price;
          }
        }

        // Check if user has enough points
        if (user.points < totalPointsNeeded) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '积分不足' });
        }

        // Create order and photo records
        const orderNo = `P${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const photoIds: string[] = [];
        const startTime = Date.now();
        const estimatedDuration = input.templateIds.length * 5000; // 每张5秒

        for (const template of templates) {
          const photoId = await db.generatePhotoId();
          photoIds.push(photoId);

          await db.createUserPhoto({
            photoId,
            userId: ctx.user.id,
            templateId: template.id,
            selfieUrl: user.lastSelfieUrl,
            photoType: 'single',
            status: 'processing',
            detectedFaceType: user.faceType || null,
          });

          // Deduct points
          if (!template.isFree) {
            await db.updateUserPoints(ctx.user.id, -template.price, '生成照片消耗', undefined);
          }
        }

        // Create order record
        await db.createOrder({
          orderNo,
          userId: ctx.user.id,
          channelId: user.channelId || null,
          salesId: user.salesId || null,
          orderType: input.templateIds.length > 1 ? 'batch_photo' : 'single_photo',
          orderAmount: totalPointsNeeded * 100,
          pointsUsed: totalPointsNeeded,
          orderStatus: 'paid',
          paymentMethod: 'points',
          paymentTime: new Date(),
          photoCount: input.templateIds.length,
          templateIds: JSON.stringify(input.templateIds),
        });

        // Async execute face swap tasks
        (async () => {
          try {
            for (let i = 0; i < templates.length; i++) {
              const template = templates[i];
              const photoId = photoIds[i];
              const photo = await db.getUserPhotoByPhotoId(photoId);
              if (!photo) continue;

              try {
                const templateImageUrl = template.hasMaskRegions && template.maskedImageUrl 
                  ? template.maskedImageUrl 
                  : template.imageUrl;

                const { executeId, resultUrls } = await coze.faceSwapSingle({
                  userImageUrl: user.lastSelfieUrl!,
                  templateImageUrls: [templateImageUrl],
                });

                if (resultUrls && resultUrls.length > 0 && resultUrls[0]) {
                  let finalResultUrl = resultUrls[0];

                  // If template has mask regions, need to restore
                  if (template.hasMaskRegions && template.regionCacheUrl) {
                    try {
                      const { downloadImage, restoreRegions } = await import('./imageMask');
                      const { storagePut: storagePutFunc } = await import('./storage');

                      const [swappedBuffer, regionCacheBuffer] = await Promise.all([
                        downloadImage(resultUrls[0]),
                        downloadImage(template.regionCacheUrl),
                      ]);

                      const restoredBuffer = await restoreRegions(swappedBuffer, regionCacheBuffer);
                      const fileKey = `photos/${photoId}_restored_${Date.now()}.jpg`;
                      const { url } = await storagePutFunc(fileKey, restoredBuffer, 'image/jpeg');
                      finalResultUrl = url;
                    } catch (restoreError: any) {
                      console.error('[quickGenerate] 还原遮盖区域失败:', restoreError.message);
                    }
                  }

                  await db.updateUserPhotoStatus(photo.id, {
                    status: 'completed',
                    workflowRunId: executeId,
                    resultUrl: finalResultUrl,
                    progress: 100,
                  });
                } else {
                  await db.updateUserPhotoStatus(photo.id, {
                    status: 'failed',
                    workflowRunId: executeId,
                    errorMessage: '换脸未生成结果图片',
                  });
                }
              } catch (error: any) {
                await db.updateUserPhotoStatus(photo.id, {
                  status: 'failed',
                  errorMessage: error.message,
                });
              }
            }
          } catch (error) {
            console.error('[quickGenerate] 异步生成失败:', error);
          }
        })();

        return {
          orderNo,
          photoIds,
          totalPhotos: input.templateIds.length,
          estimatedDuration,
          startTime,
        };
      }),

    // Query generation progress
    progress: protectedProcedure
      .input(z.object({
        photoIds: z.array(z.string()),
      }))
      .query(async ({ ctx, input }) => {
        const photos = [];
        for (const photoId of input.photoIds) {
          const photo = await db.getUserPhotoByPhotoId(photoId);
          if (photo && photo.userId === ctx.user.id) {
            photos.push(photo);
          }
        }

        const completedCount = photos.filter(p => p.status === 'completed').length;
        const failedCount = photos.filter(p => p.status === 'failed').length;
        const processingCount = photos.filter(p => p.status === 'processing').length;

        const totalPhotos = input.photoIds.length;
        const currentPhoto = completedCount + 1; // Current photo being generated
        const estimatedRemaining = Math.max(0, (totalPhotos - completedCount) * 5000); // 5 seconds per photo

        return {
          totalPhotos,
          completedPhotos: completedCount,
          failedPhotos: failedCount,
          processingPhotos: processingCount,
          currentPhoto: Math.min(currentPhoto, totalPhotos),
          estimatedRemaining,
          photos,
        };
      }),
  }),

  }),

  // 快速生成（使用上次自拍照）
  quickGenerate: router({
    // 快速生成初始化
    init: protectedProcedure
      .input(z.object({
        templateIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });

        // Check if user has lastSelfieUrl
        if (!user.lastSelfieUrl) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '请先拍照' });
        }

        // Calculate total points needed
        let totalPointsNeeded = 0;
        const templates = [];
        for (const templateId of input.templateIds) {
          const template = await db.getTemplateById(templateId);
          if (!template) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `模板 ${templateId} 不存在` });
          }
          templates.push(template);
          if (!template.isFree) {
            totalPointsNeeded += template.price;
          }
        }

        // Check if user has enough points
        if (user.points < totalPointsNeeded) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '积分不足' });
        }

        // Create order and photo records
        const orderNo = `P${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const photoIds: string[] = [];
        const startTime = Date.now();
        const estimatedDuration = input.templateIds.length * 5000; // 每张5秒

        for (const template of templates) {
          const photoId = await db.generatePhotoId();
          photoIds.push(photoId);

          await db.createUserPhoto({
            photoId,
            userId: ctx.user.id,
            templateId: template.id,
            selfieUrl: user.lastSelfieUrl,
            photoType: 'single',
            status: 'processing',
            detectedFaceType: user.faceType || null,
          });

          // Deduct points
          if (!template.isFree) {
            await db.updateUserPoints(ctx.user.id, -template.price, '生成照片消耗', undefined);
          }
        }

        // Create order record
        await db.createOrder({
          orderNo,
          userId: ctx.user.id,
          channelId: user.channelId || null,
          salesId: user.salesId || null,
          orderType: input.templateIds.length > 1 ? 'batch_photo' : 'single_photo',
          orderAmount: totalPointsNeeded * 100,
          pointsUsed: totalPointsNeeded,
          orderStatus: 'paid',
          paymentMethod: 'points',
          paymentTime: new Date(),
          photoCount: input.templateIds.length,
          templateIds: JSON.stringify(input.templateIds),
        });

        // Async execute face swap tasks
        (async () => {
          try {
            for (let i = 0; i < templates.length; i++) {
              const template = templates[i];
              const photoId = photoIds[i];
              const photo = await db.getUserPhotoByPhotoId(photoId);
              if (!photo) continue;

              try {
                const templateImageUrl = template.hasMaskRegions && template.maskedImageUrl 
                  ? template.maskedImageUrl 
                  : template.imageUrl;

                const { executeId, resultUrls } = await coze.faceSwapSingle({
                  userImageUrl: user.lastSelfieUrl!,
                  templateImageUrls: [templateImageUrl],
                });

                if (resultUrls && resultUrls.length > 0 && resultUrls[0]) {
                  let finalResultUrl = resultUrls[0];

                  // If template has mask regions, need to restore
                  if (template.hasMaskRegions && template.regionCacheUrl) {
                    try {
                      const { downloadImage, restoreRegions } = await import('./imageMask');
                      const { storagePut: storagePutFunc } = await import('./storage');

                      const [swappedBuffer, regionCacheBuffer] = await Promise.all([
                        downloadImage(resultUrls[0]),
                        downloadImage(template.regionCacheUrl),
                      ]);

                      const restoredBuffer = await restoreRegions(swappedBuffer, regionCacheBuffer);
                      const fileKey = `photos/${photoId}_restored_${Date.now()}.jpg`;
                      const { url } = await storagePutFunc(fileKey, restoredBuffer, 'image/jpeg');
                      finalResultUrl = url;
                    } catch (restoreError: any) {
                      console.error('[quickGenerate] 还原遮盖区域失败:', restoreError.message);
                    }
                  }

                  await db.updateUserPhotoStatus(photo.id, {
                    status: 'completed',
                    workflowRunId: executeId,
                    resultUrl: finalResultUrl,
                    progress: 100,
                  });
                } else {
                  await db.updateUserPhotoStatus(photo.id, {
                    status: 'failed',
                    workflowRunId: executeId,
                    errorMessage: '换脸未生成结果图片',
                  });
                }
              } catch (error: any) {
                await db.updateUserPhotoStatus(photo.id, {
                  status: 'failed',
                  errorMessage: error.message,
                });
              }
            }
          } catch (error) {
            console.error('[quickGenerate] 异步生成失败:', error);
          }
        })();

        return {
          orderNo,
          photoIds,
          totalPhotos: input.templateIds.length,
          estimatedDuration,
          startTime,
        };
      }),

    // Query generation progress
    progress: protectedProcedure
      .input(z.object({
        photoIds: z.array(z.string()),
      }))
      .query(async ({ ctx, input }) => {
        const photos = [];
        for (const photoId of input.photoIds) {
          const photo = await db.getUserPhotoByPhotoId(photoId);
          if (photo && photo.userId === ctx.user.id) {
            photos.push(photo);
          }
        }

        const completedCount = photos.filter(p => p.status === 'completed').length;
        const failedCount = photos.filter(p => p.status === 'failed').length;
        const processingCount = photos.filter(p => p.status === 'processing').length;

        const totalPhotos = input.photoIds.length;
        const currentPhoto = completedCount + 1; // Current photo being generated
        const estimatedRemaining = Math.max(0, (totalPhotos - completedCount) * 5000); // 5 seconds per photo

        return {
          totalPhotos,
          completedPhotos: completedCount,
          failedPhotos: failedCount,
          processingPhotos: processingCount,
          currentPhoto: Math.min(currentPhoto, totalPhotos),
          estimatedRemaining,
          photos,
        };
      }),
  }),

  // 小程序专用API（公开，基于 userOpenId 识别用户）
  mp: router({
    // 获取用户状态（用于P0欢迎页判断）
    getUserStatus: publicProcedure
      .input(z.object({
        userOpenId: z.string(),
      }))
      .query(async ({ input }) => {
        // 查找或创建用户
        let user = await db.getUserByOpenId(input.userOpenId);

        if (!user) {
          // 新用户，自动创建
          user = await db.createUser({
            openId: input.userOpenId,
            loginMethod: 'miniprogram',
            role: 'user',
            points: 10, // 默认赠送10积分
            initialFreeCredits: 10,
            hasUsedFreeCredits: false,
          });
        }

        return {
          userId: user.id,
          hasUsedFreeCredits: user.hasUsedFreeCredits,
          points: user.points,
          initialFreeCredits: user.initialFreeCredits,
          faceType: user.faceType,
          userType: user.userType,
          gender: user.gender,
          lastSelfieUrl: user.lastSelfieUrl,
        };
      }),

    // 获取未完成订单（用于P0恢复生成流程）
    getPendingOrder: publicProcedure
      .input(z.object({
        userOpenId: z.string(),
      }))
      .query(async ({ input }) => {
        const user = await db.getUserByOpenId(input.userOpenId);
        if (!user) return null;

        // 查找状态为 processing 的照片
        const pendingPhotos = await db.getUserPendingPhotos(user.id);
        if (!pendingPhotos || pendingPhotos.length === 0) return null;

        // 返回第一个未完成的
        const photo = pendingPhotos[0];
        return {
          photoId: photo.photoId,
          templateId: photo.templateId,
          status: 'generating',
          progress: photo.progress || 0,
        };
      }),

    // 标记用户已使用免费积分
    markFreeCreditsUsed: publicProcedure
      .input(z.object({
        userOpenId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByOpenId(input.userOpenId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
        }

        if (!user.hasUsedFreeCredits) {
          await db.updateUserHasUsedFreeCredits(user.id, true);
        }

        return { success: true };
      }),

    // 保存用户自拍照
    saveSelfie: publicProcedure
      .input(z.object({
        userOpenId: z.string(),
        selfieUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByOpenId(input.userOpenId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
        }

        await db.updateUserLastSelfie(user.id, input.selfieUrl);
        return { success: true };
      }),

    // 保存用户脸型分析结果
    saveFaceAnalysis: publicProcedure
      .input(z.object({
        userOpenId: z.string(),
        faceType: z.string(),
        gender: z.string().optional(),
        userType: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByOpenId(input.userOpenId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
        }

        await db.updateUserProfile(user.id, {
          faceType: input.faceType,
          gender: input.gender,
          userType: input.userType,
        });

        return { success: true };
      }),

    // 获取用户照片列表（用于P10我的照片页）
    getMyPhotos: publicProcedure
      .input(z.object({
        userOpenId: z.string(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }))
      .query(async ({ input }) => {
        const user = await db.getUserByOpenId(input.userOpenId);
        if (!user) return { list: [], total: 0 };

        const { list, total } = await db.getUserPhotosPaginated(user.id, input.page, input.pageSize);
        return { list, total };
      }),

    // 删除照片（用于P10我的照片页）
    deletePhoto: publicProcedure
      .input(z.object({
        photoId: z.string(),
        userOpenId: z.string(),
      }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByOpenId(input.userOpenId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
        }

        // 查找照片
        const photo = await db.getUserPhotoByPhotoId(input.photoId);
        if (!photo) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '照片不存在' });
        }

        // 验证照片所有权
        if (photo.userId !== user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: '无权删除此照片' });
        }

        // 软删除照片（标记为已删除，不实际删除数据）
        await db.deleteUserPhoto(photo.id);

        return { success: true };
      }),

    // AI 脸型分析（公开接口，小程序使用）
    analyzeFace: publicProcedure
      .input(z.object({
        selfieUrl: z.string(),
        userOpenId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // 调用 Coze 用户判别 API
          const result = await coze.analyzeUserFace({
            userImageUrl: input.selfieUrl,
          });

          if (!result.success) {
            return {
              success: false,
              error: result.errorMessage || '分析失败',
            };
          }

          // 如果提供了 userOpenId，更新用户资料
          if (input.userOpenId) {
            const user = await db.getUserByOpenId(input.userOpenId);
            if (user) {
              await db.updateUserProfile(user.id, {
                gender: result.gender,
                userType: result.userType,
                faceType: result.faceType,
              });
            }
          }

          return {
            success: true,
            faceType: result.faceType,      // "宽脸" | "窄脸"
            gender: result.gender,          // "男" | "女"
            userType: result.userType,      // "少女" | "熟女" 等
            description: result.description,
          };
        } catch (error: any) {
          console.error('[mp.analyzeFace] Error:', error);
          return { success: false, error: error.message };
        }
      }),

    // 创建微信支付订单
    createPayment: publicProcedure
      .input(z.object({
        userOpenId: z.string(),
        productType: z.enum(['credits', 'template']), // 积分充值或模板购买
        productId: z.number().optional(), // 模板ID（如果是模板购买）
        amount: z.number(), // 金额（分）
        quantity: z.number().default(1), // 数量（积分充值时表示积分数）
      }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByOpenId(input.userOpenId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
        }

        // 生成订单号
        const orderNo = `WX${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        // 构建商品描述
        let description = '';
        if (input.productType === 'credits') {
          description = `AI旅拍-${input.quantity}积分充值`;
        } else {
          const template = input.productId ? await db.getTemplateById(input.productId) : null;
          description = template ? `AI旅拍-${template.name}` : 'AI旅拍-模板购买';
        }

        try {
          // 动态导入微信支付模块
          const wechatpay = await import('./wechatpay');
          const result = await wechatpay.createJsapiOrder({
            openId: input.userOpenId,
            outTradeNo: orderNo,
            totalAmount: input.amount,
            description,
          });

          if (!result.success) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error || '创建支付订单失败' });
          }

          // 记录待支付订单（可选）
          // await db.createPendingPayment({ orderNo, userId: user.id, amount: input.amount, productType: input.productType, ... });

          return {
            success: true,
            orderNo,
            payParams: result.payParams,
          };
        } catch (error: any) {
          console.error('[mp.createPayment] Error:', error);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message || '支付创建失败' });
        }
      }),

    // 查询支付结果
    queryPayment: publicProcedure
      .input(z.object({
        orderNo: z.string(),
      }))
      .query(async ({ input }) => {
        try {
          const wechatpay = await import('./wechatpay');
          const result = await wechatpay.queryOrder(input.orderNo);

          return {
            success: result.success,
            tradeState: result.tradeState, // SUCCESS, NOTPAY, CLOSED, etc.
            transactionId: result.transactionId,
            error: result.error,
          };
        } catch (error: any) {
          console.error('[mp.queryPayment] Error:', error);
          return { success: false, error: error.message };
        }
      }),
  }),

  // 系统配置路由（用于获取IP形象等）
  config: router({
    // 获取IP形象配置
    getIPImage: publicProcedure.query(async () => {
      const imageUrl = await db.getSystemConfig('IP_IMAGE_URL');
      return { imageUrl: imageUrl || null };
    }),

    // 获取分享配置
    getShareConfig: publicProcedure
      .input(z.object({ pageCode: z.string() }))
      .query(async ({ input }) => {
        const config = await db.getShareConfigByPageCode(input.pageCode);
        return config;
      }),
  }),

  // 公开API（无需登录）
  public: router({
    // 获取订单结果图（用于分享页面）
    orderResults: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
        }
        return {
          resultUrls: order.resultUrls,
          orderNo: order.orderNo,
        };
      }),
    
    // 获取订单模板信息（用于模板展示页面）
    orderTemplates: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
        }
        
        const templateIds: string[] = order.templateIds ? JSON.parse(order.templateIds) : [];
        const templates = await db.getTemplatesByTemplateIds(templateIds);
        
        return {
          selfieUrl: order.selfieUrl,
          templates: templates.map(t => ({
            templateId: t.templateId,
            imageUrl: t.imageUrl,
          })),
        };
      }),
    
    // 获取系统配置（公开API，用于前端获取IP形象等配置）
    getConfig: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const value = await db.getSystemConfig(input.key);
        return { key: input.key, value: value || null };
      }),
  }),
});

export type AppRouter = typeof appRouter;
