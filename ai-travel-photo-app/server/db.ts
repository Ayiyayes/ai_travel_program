import { eq, and, desc, asc, sql, like, or, gte, lte, inArray, isNull, isNotNull, gt, lt, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { 
  InsertUser, users, 
  templates, InsertTemplate, Template,
  channels, InsertChannel, Channel,
  promotionCodes, InsertPromotionCode, PromotionCode,
  sales, InsertSales, Sales,
  salesPromotionCodes, InsertSalesPromotionCode, SalesPromotionCode,
  orders, InsertOrder, Order,
  userPhotos, InsertUserPhoto, UserPhoto,
  photoInvitations, InsertPhotoInvitation, PhotoInvitation,
  channelUsers, InsertChannelUser, ChannelUser,
  pointsRecords, InsertPointsRecord, PointsRecord,
  systemConfigs, InsertSystemConfig, SystemConfig,
  cities, InsertCity, City,
  spots, InsertSpot, Spot,
  shareConfigs, InsertShareConfig, ShareConfig,
  groupTypes, InsertGroupType, GroupType,
  imageCache, InsertImageCache, ImageCache
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = mysql.createPool(process.env.DATABASE_URL);
      await pool.query("SELECT 1");
      _db = drizzle(pool) as unknown as ReturnType<typeof drizzle>;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== 用户相关 ====================
export async function upsertUser(user: InsertUser & { channelId?: number | null }): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // 检查用户是否已存在
    const existingUser = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    const isNewUser = existingUser.length === 0;

    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "avatar", "gender", "userType", "faceType"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    // 新用户赠送积分逻辑
    if (isNewUser) {
      // 获取渠道配置的新用户积分，默认10积分
      let newUserPoints = 10;
      if (user.channelId) {
        const channel = await db.select().from(channels).where(eq(channels.id, user.channelId)).limit(1);
        if (channel.length > 0 && channel[0].newUserPoints !== null) {
          // 渠道配置的积分上限100
          newUserPoints = Math.min(channel[0].newUserPoints, 100);
        }
        values.channelId = user.channelId;
      }
      
      // 设置新用户积分
      values.points = newUserPoints;
      values.initialFreeCredits = newUserPoints;
      values.hasUsedFreeCredits = false;
      
      console.log(`[Database] New user ${user.openId} registered with ${newUserPoints} free credits`);
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// 检查用户是否有完成的订单（用于判断新老用户）
export async function hasUserCompletedOrder(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(and(
      eq(orders.userId, userId),
      eq(orders.orderStatus, 'completed')
    ))
    .limit(1);
  return (result[0]?.count || 0) > 0;
}

export async function updateUserPoints(userId: number, pointsDelta: number, description: string, orderId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  
  const newBalance = user.points + pointsDelta;
  if (newBalance < 0) throw new Error("Insufficient points");
  
  // 更新积分，如果是首次消耗积分则同时更新 hasUsedFreeCredits
  const updateData: { points: number; hasUsedFreeCredits?: boolean } = { points: newBalance };
  
  // 如果是消耗积分（pointsDelta < 0）且用户还未消耗过赠送积分，则标记为已消耗
  if (pointsDelta < 0 && !user.hasUsedFreeCredits) {
    updateData.hasUsedFreeCredits = true;
    console.log(`[Database] User ${userId} has used free credits for the first time`);
  }
  
  await db.update(users).set(updateData).where(eq(users.id, userId));
  
  await db.insert(pointsRecords).values({
    userId,
    type: pointsDelta > 0 ? 'earn' : 'spend',
    amount: pointsDelta,
    balance: newBalance,
    description,
    relatedOrderId: orderId,
  });
  
  return newBalance;
}

export async function updateUserProfile(userId: number, data: { gender?: string; userType?: string; faceType?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function updateUser(userId: number, data: Record<string, any>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ==================== 模板相关 ====================
export async function getTemplates(filters?: {
  city?: string;
  scenicSpot?: string;
  groupType?: string;
  photoType?: 'single' | 'group';
  status?: 'active' | 'inactive';
  faceType?: 'wide' | 'narrow' | 'both';
  displayOnly?: boolean;
  isNational?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(templates);
  const conditions = [];

  if (filters?.city) conditions.push(eq(templates.city, filters.city));
  if (filters?.scenicSpot) conditions.push(eq(templates.scenicSpot, filters.scenicSpot));
  if (filters?.groupType) conditions.push(eq(templates.groupType, filters.groupType));
  if (filters?.photoType) conditions.push(eq(templates.photoType, filters.photoType));
  if (filters?.status) conditions.push(eq(templates.status, filters.status));
  if (filters?.faceType) conditions.push(eq(templates.faceType, filters.faceType));
  if (filters?.isNational !== undefined) conditions.push(eq(templates.isNational, filters.isNational));
  
  // 展示模板过滤：只返回窄脸和通用模板（排除宽脸模板）
  if (filters?.displayOnly) {
    conditions.push(
      or(
        eq(templates.faceType, 'narrow'),
        eq(templates.faceType, 'both')
      )
    );
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  query = query.orderBy(asc(templates.sortOrder), desc(templates.createdAt));

  if (filters?.page && filters?.pageSize) {
    const pageSize = Math.max(1, Math.min(filters.pageSize, 50));
    const page = Math.max(1, filters.page);
    query = query.limit(pageSize).offset((page - 1) * pageSize) as typeof query;
  }

  return query;
}

// 根据脸型查找匹配的模板
export async function findMatchingTemplate(params: {
  originalTemplateId: number;
  targetFaceType: 'wide' | 'narrow';
}): Promise<Template | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  // 获取原模板信息
  const originalTemplate = await getTemplateById(params.originalTemplateId);
  if (!originalTemplate) return undefined;
  
  // 如果原模板是通用类型，直接返回原模板
  if (originalTemplate.faceType === 'both') {
    return originalTemplate;
  }
  
  // 如果原模板已经是目标脸型，直接返回
  if (originalTemplate.faceType === params.targetFaceType) {
    return originalTemplate;
  }
  
  // 优先通过 templateGroupId 查找关联模板
  if (originalTemplate.templateGroupId) {
    const groupResult = await db.select().from(templates).where(
      and(
        eq(templates.templateGroupId, originalTemplate.templateGroupId),
        eq(templates.faceType, params.targetFaceType),
        eq(templates.status, 'active')
      )
    ).limit(1);
    
    if (groupResult.length > 0) {
      console.log(`[Template] Found matching ${params.targetFaceType} template by groupId:`, groupResult[0].id, groupResult[0].templateGroupId);
      return groupResult[0];
    }
  }
  
  // 降级：通过同城市、同景点、同人群类型查找（兼容旧数据）
  const result = await db.select().from(templates).where(
    and(
      eq(templates.city, originalTemplate.city),
      eq(templates.scenicSpot, originalTemplate.scenicSpot),
      eq(templates.groupType, originalTemplate.groupType),
      eq(templates.faceType, params.targetFaceType),
      eq(templates.status, 'active')
    )
  ).limit(1);
  
  if (result.length > 0) {
    console.log(`[Template] Found matching ${params.targetFaceType} template:`, result[0].id, result[0].name);
    return result[0];
  }
  
  // 找不到匹配的模板，返回 undefined（调用方决定是否降级）
  console.log(`[Template] No matching ${params.targetFaceType} template found for:`, originalTemplate.name);
  return undefined;
}

export async function getTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTemplateByTemplateId(templateId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(templates).where(eq(templates.templateId, templateId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTemplatesByTemplateIds(templateIds: string[]) {
  const db = await getDb();
  if (!db) return [];
  if (templateIds.length === 0) return [];
  const result = await db.select().from(templates).where(inArray(templates.templateId, templateIds));
  return result;
}

export async function getAllTemplateIds(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ templateId: templates.templateId }).from(templates);
  return result.map(r => r.templateId);
}

export async function createTemplate(data: InsertTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(templates).values(data);
  return result;
}

export async function updateTemplate(id: number, data: Partial<InsertTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(templates).set(data).where(eq(templates.id, id));
}

export async function deleteTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(templates).where(eq(templates.id, id));
}

export async function toggleTemplateStatus(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 先获取当前状态
  const result = await db.select({ status: templates.status }).from(templates).where(eq(templates.id, id)).limit(1);
  if (result.length === 0) throw new Error("Template not found");
  
  const currentStatus = result[0].status;
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  
  await db.update(templates).set({ status: newStatus }).where(eq(templates.id, id));
  return newStatus;
}

// 批量更新模板
export async function batchUpdateTemplates(ids: number[], data: Partial<InsertTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (ids.length === 0) return 0;
  
  // 过滤掉空值
  const updateData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== '') {
      updateData[key] = value;
    }
  }
  
  if (Object.keys(updateData).length === 0) return 0;
  
  await db.update(templates).set(updateData).where(inArray(templates.id, ids));
  return ids.length;
}

// 批量删除模板
export async function batchDeleteTemplates(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (ids.length === 0) return 0;
  
  await db.delete(templates).where(inArray(templates.id, ids));
  return ids.length;
}

export async function getDistinctCities() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ city: templates.city }).from(templates).where(eq(templates.status, 'active'));
  return result.map(r => r.city);
}

export async function getScenicSpotsByCity(city: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ scenicSpot: templates.scenicSpot })
    .from(templates)
    .where(and(eq(templates.city, city), eq(templates.status, 'active')));
  return result.map(r => r.scenicSpot);
}

export async function getGroupTypes() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ groupType: templates.groupType }).from(templates).where(eq(templates.status, 'active'));
  return result.map(r => r.groupType);
}

// ==================== 渠道相关 ====================
export async function generateChannelCode(type: 'institution' | 'individual') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const prefix = type === 'institution' ? 'JG' : 'GR';
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(channels)
    .where(eq(channels.channelType, type));
  const count = result[0]?.count || 0;
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function getChannels(filters?: {
  channelType?: string;
  status?: string;
  city?: string;
  scenicSpot?: string;
  searchTerm?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(channels);
  const conditions = [];
  
  if (filters?.channelType) conditions.push(eq(channels.channelType, filters.channelType as any));
  if (filters?.status) conditions.push(eq(channels.status, filters.status as any));
  if (filters?.searchTerm) {
    conditions.push(or(
      like(channels.channelCode, `%${filters.searchTerm}%`),
      like(channels.channelName, `%${filters.searchTerm}%`),
      like(channels.contactPerson, `%${filters.searchTerm}%`)
    ));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  return query.orderBy(desc(channels.createdAt));
}

export async function getChannelById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getChannelByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(channels).where(eq(channels.channelCode, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createChannel(data: InsertChannel) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(channels).values(data);
}

export async function updateChannel(id: number, data: Partial<InsertChannel>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(channels).set(data).where(eq(channels.id, id));
}

export async function deleteChannel(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 删除关联的推广码
  await db.delete(promotionCodes).where(eq(promotionCodes.channelId, id));
  // 删除关联的销售人员
  await db.delete(sales).where(eq(sales.channelId, id));
  // 删除关联的渠道用户
  await db.delete(channelUsers).where(eq(channelUsers.channelId, id));
  // 删除渠道
  await db.delete(channels).where(eq(channels.id, id));
}

export async function toggleChannelStatus(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 先获取当前状态
  const result = await db.select({ status: channels.status }).from(channels).where(eq(channels.id, id)).limit(1);
  if (result.length === 0) throw new Error("Channel not found");
  
  const currentStatus = result[0].status;
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  
  await db.update(channels).set({ status: newStatus }).where(eq(channels.id, id));
  return newStatus;
}

// ==================== 推广码相关 ====================
export async function createPromotionCode(data: InsertPromotionCode) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(promotionCodes).values(data);
}

export async function getPromotionCodesByChannelId(channelId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promotionCodes).where(eq(promotionCodes.channelId, channelId));
}

export async function getPromotionCodeByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(promotionCodes).where(eq(promotionCodes.promoCode, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function incrementPromotionCodeScan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(promotionCodes)
    .set({ scanCount: sql`${promotionCodes.scanCount} + 1` })
    .where(eq(promotionCodes.id, id));
}

export async function updatePromotionCodeQRCodes(id: number, data: {
  wechatLink?: string;
  wechatQrCodeUrl?: string;
  douyinLink?: string;
  douyinQrCodeUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(promotionCodes)
    .set(data)
    .where(eq(promotionCodes.id, id));
}

export async function getPromotionCodeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(promotionCodes).where(eq(promotionCodes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== 销售人员相关 ====================
export async function generateSalesCode(channelCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const channel = await getChannelByCode(channelCode);
  if (!channel) throw new Error("Channel not found");
  
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(sales)
    .where(eq(sales.channelId, channel.id));
  const count = result[0]?.count || 0;
  return `${channelCode}-S${String(count + 1).padStart(3, '0')}`;
}

export async function getSalesByChannelId(channelId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sales).where(eq(sales.channelId, channelId));
}

export async function createSales(data: InsertSales) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(sales).values(data);
}

export async function getSalesById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateSales(id: number, data: Partial<InsertSales>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sales).set(data).where(eq(sales.id, id));
}

// ==================== 推广员推广码相关 ====================
export async function createSalesPromotionCode(data: InsertSalesPromotionCode) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(salesPromotionCodes).values(data);
}

export async function getSalesPromotionCodesBySalesId(salesId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(salesPromotionCodes).where(eq(salesPromotionCodes.salesId, salesId));
}

export async function getSalesPromotionCodeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(salesPromotionCodes).where(eq(salesPromotionCodes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteSalesPromotionCode(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(salesPromotionCodes).where(eq(salesPromotionCodes.id, id));
}

export async function deleteSalesPromotionCodesBySalesId(salesId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(salesPromotionCodes).where(eq(salesPromotionCodes.salesId, salesId));
}

export async function generateSalesPromoCode(channelCode: string, salesCode: string, city: string, scenicSpot: string) {
  const cityShort = city.substring(0, 2);
  const spotShort = scenicSpot.substring(0, 2);
  return `${channelCode}-${salesCode}-${cityShort}${spotShort}-${nanoid(4)}`.toUpperCase();
}

// ==================== 订单相关 ====================
export async function generateOrderNo() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid(6).toUpperCase();
  return `ORD${timestamp}${random}`;
}

export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(orders).values(data);
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrderByOrderNo(orderNo: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrdersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function updateOrderStatus(id: number, status: 'pending' | 'paid' | 'completed' | 'failed') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = { orderStatus: status, updatedAt: new Date() };
  if (status === 'paid') updateData.paymentTime = new Date();
  await db.update(orders).set(updateData).where(eq(orders.id, id));
  return true;
}

// ==================== 用户照片相关 ====================
export async function generatePhotoId() {
  return `PH${Date.now().toString(36).toUpperCase()}${nanoid(6).toUpperCase()}`;
}

export async function createUserPhoto(data: InsertUserPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(userPhotos).values(data);
}

export async function getUserPhotoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userPhotos).where(eq(userPhotos.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserPhotoByPhotoId(photoId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userPhotos).where(eq(userPhotos.photoId, photoId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserPhotosByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userPhotos).where(eq(userPhotos.userId, userId)).orderBy(desc(userPhotos.createdAt));
}

export async function updateUserPhotoStatus(id: number, data: {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  resultUrl?: string;
  thumbnailUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  workflowRunId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = { ...data };
  if (data.status === 'completed') updateData.completedAt = new Date();
  await db.update(userPhotos).set(updateData).where(eq(userPhotos.id, id));
}

export async function deleteUserPhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 软删除：标记为已删除状态
  await db.update(userPhotos).set({
    status: 'deleted' as any,
    deletedAt: new Date()
  }).where(eq(userPhotos.id, id));
}

// ==================== 合照邀请相关 ====================
export async function generateInvitationCode() {
  return nanoid(8).toUpperCase();
}

export async function createPhotoInvitation(data: InsertPhotoInvitation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(photoInvitations).values(data);
}

export async function getPhotoInvitationByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(photoInvitations).where(eq(photoInvitations.invitationCode, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePhotoInvitation(id: number, data: Partial<InsertPhotoInvitation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(photoInvitations).set(data).where(eq(photoInvitations.id, id));
}

// ==================== 渠道用户相关 ====================
export async function createChannelUser(data: { username: string; role: 'institution_channel' | 'individual_channel' | 'sales'; channelId?: number; salesId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(channelUsers).values({
    ...data,
    password: '123456', // 默认密码
  });
}

export async function getChannelUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  // 首先尝试用户名直接匹配
  let result = await db.select().from(channelUsers).where(eq(channelUsers.username, username)).limit(1);
  if (result.length > 0) return result[0];
  
  // 尝试通过渠道名称查找
  const channelByName = await db.select().from(channels).where(eq(channels.channelName, username)).limit(1);
  if (channelByName.length > 0) {
    result = await db.select().from(channelUsers).where(
      and(
        eq(channelUsers.channelId, channelByName[0].id),
        or(eq(channelUsers.role, 'institution_channel'), eq(channelUsers.role, 'individual_channel'))
      )
    ).limit(1);
    if (result.length > 0) return result[0];
  }
  
  // 尝试通过渠道编码查找
  const channelByCode = await db.select().from(channels).where(eq(channels.channelCode, username)).limit(1);
  if (channelByCode.length > 0) {
    result = await db.select().from(channelUsers).where(
      and(
        eq(channelUsers.channelId, channelByCode[0].id),
        or(eq(channelUsers.role, 'institution_channel'), eq(channelUsers.role, 'individual_channel'))
      )
    ).limit(1);
    if (result.length > 0) return result[0];
  }
  
  // 尝试通过推广员名称查找
  const salesByName = await db.select().from(sales).where(eq(sales.salesName, username)).limit(1);
  if (salesByName.length > 0) {
    result = await db.select().from(channelUsers).where(
      and(
        eq(channelUsers.salesId, salesByName[0].id),
        eq(channelUsers.role, 'sales')
      )
    ).limit(1);
    if (result.length > 0) return result[0];
  }
  
  // 尝试通过推广员编码查找
  const salesByCode = await db.select().from(sales).where(eq(sales.salesCode, username)).limit(1);
  if (salesByCode.length > 0) {
    result = await db.select().from(channelUsers).where(
      and(
        eq(channelUsers.salesId, salesByCode[0].id),
        eq(channelUsers.role, 'sales')
      )
    ).limit(1);
    if (result.length > 0) return result[0];
  }
  
  return undefined;
}

export async function getChannelUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(channelUsers).where(eq(channelUsers.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateChannelUserLastLogin(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(channelUsers).set({ lastLoginTime: new Date() }).where(eq(channelUsers.id, id));
}

export async function updateChannelUserPassword(id: number, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(channelUsers).set({ password, mustChangePassword: false }).where(eq(channelUsers.id, id));
}

// ==================== 系统配置相关 ====================
export async function getSystemConfig(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, key)).limit(1);
  return result.length > 0 ? result[0].configValue : undefined;
}

export async function setSystemConfig(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, key)).limit(1);
  if (existing.length > 0) {
    await db.update(systemConfigs).set({ configValue: value, description }).where(eq(systemConfigs.configKey, key));
  } else {
    await db.insert(systemConfigs).values({ configKey: key, configValue: value, description });
  }
}


const TEMPLATE_VERSION_KEY = "template_version";

export async function getTemplateVersion(): Promise<number> {
  const rawValue = await getSystemConfig(TEMPLATE_VERSION_KEY);
  const parsed = rawValue ? Number(rawValue) : NaN;

  if (!Number.isFinite(parsed) || parsed < 1) {
    const initialVersion = 1;
    await setSystemConfig(TEMPLATE_VERSION_KEY, String(initialVersion), "Template list version");
    return initialVersion;
  }

  return parsed;
}

export async function bumpTemplateVersion(): Promise<number> {
  const current = await getTemplateVersion();
  const next = current + 1;
  await setSystemConfig(TEMPLATE_VERSION_KEY, String(next), "Template list version");
  return next;
}

// ==================== 渠道门户相关 ====================
export async function getChannelPortalStats(channelId: number) {
  const db = await getDb();
  if (!db) return { totalUsers: 0, totalOrders: 0, totalSales: 0, totalCommission: 0 };
  
  // 获取渠道信息
  const channel = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  const commissionRate = channel.length > 0 ? (channel[0].commissionRate || 20) : 20;
  
  // 获取该渠道的推广码
  const promoCodeList = await db.select().from(promotionCodes).where(eq(promotionCodes.channelId, channelId));
  const promoCodeIds = promoCodeList.map(p => p.id);
  
  if (promoCodeIds.length === 0) {
    return { totalUsers: 0, totalOrders: 0, totalSales: 0, totalCommission: 0 };
  }
  
  // 统计用户数（通过推广码注册的用户）
  const userStats = await db.select({ count: sql<number>`COUNT(DISTINCT ${users.id})` })
    .from(users)
    .where(inArray(users.promotionCodeId, promoCodeIds));
  
  // 统计订单数和销售额
  const orderStats = await db.select({ 
    count: sql<number>`COUNT(*)`,
    sales: sql<number>`COALESCE(SUM(${orders.orderAmount}), 0)`
  })
    .from(orders)
    .where(and(
      inArray(orders.promotionCodeId, promoCodeIds),
      eq(orders.orderStatus, 'completed')
    ));
  
  const totalSales = Number(orderStats[0]?.sales || 0);
  const totalCommission = Math.round(totalSales * commissionRate / 100);
  
  return {
    totalUsers: Number(userStats[0]?.count || 0),
    totalOrders: Number(orderStats[0]?.count || 0),
    totalSales,
    totalCommission,
  };
}

export async function getChannelRecentOrders(channelId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  // 获取该渠道的推广码
  const promoCodeList = await db.select().from(promotionCodes).where(eq(promotionCodes.channelId, channelId));
  const promoCodeIds = promoCodeList.map(p => p.id);
  
  if (promoCodeIds.length === 0) return [];
  
  // 获取渠道佣金率
  const channel = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  const commissionRate = channel.length > 0 ? (channel[0].commissionRate || 20) : 20;
  
  // 查询订单
  const orderList = await db.select({
    id: orders.id,
    orderNo: orders.orderNo,
    amount: orders.orderAmount,
    status: orders.orderStatus,
    createdAt: orders.createdAt,
    userId: orders.userId,
  })
    .from(orders)
    .where(inArray(orders.promotionCodeId, promoCodeIds))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  
  // 获取用户信息
  const result = await Promise.all(orderList.map(async (order) => {
    const user = await db.select({ name: users.name }).from(users).where(eq(users.id, order.userId)).limit(1);
    return {
      ...order,
      userName: user.length > 0 ? (user[0].name || '未知用户') : '未知用户',
      commission: Math.round(Number(order.amount) * commissionRate / 100),
    };
  }));
  
  return result;
}

// ==================== 统计相关 ====================
export async function getChannelStats(startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return { totalChannels: 0, activeChannels: 0, totalOrders: 0, totalRevenue: 0, totalCommission: 0, newChannelsThisMonth: 0 };
  
  const totalChannels = await db.select({ count: sql<number>`COUNT(*)` }).from(channels);
  const activeChannels = await db.select({ count: sql<number>`COUNT(*)` }).from(channels).where(eq(channels.status, 'active'));
  
  // 本月新增渠道
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const newChannelsThisMonth = await db.select({ count: sql<number>`COUNT(*)` })
    .from(channels)
    .where(gte(channels.createdAt, monthStart));
  
  const conditions = [eq(orders.orderStatus, 'completed')];
  if (startDate && endDate) {
    conditions.push(gte(orders.createdAt, startDate));
    conditions.push(lte(orders.createdAt, endDate));
  }
  
  const orderStats = await db.select({ 
    count: sql<number>`COUNT(*)`,
    revenue: sql<number>`COALESCE(SUM(${orders.orderAmount}), 0)`,
    commission: sql<number>`COALESCE(SUM(${orders.commissionAmount}), 0)`
  }).from(orders).where(and(...conditions));
  
  return {
    totalChannels: totalChannels[0]?.count || 0,
    activeChannels: activeChannels[0]?.count || 0,
    totalOrders: orderStats[0]?.count || 0,
    totalRevenue: orderStats[0]?.revenue || 0,
    totalCommission: orderStats[0]?.commission || 0,
    newChannelsThisMonth: newChannelsThisMonth[0]?.count || 0,
  };
}

export async function getChannelRanking(startDate?: Date, endDate?: Date, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(orders.orderStatus, 'completed')];
  if (startDate && endDate) {
    conditions.push(gte(orders.createdAt, startDate));
    conditions.push(lte(orders.createdAt, endDate));
  }
  
  // 查询订单统计
  const orderStats = await db.select({
    channelId: orders.channelId,
    orderCount: sql<number>`COUNT(*)`,
    totalRevenue: sql<number>`COALESCE(SUM(${orders.orderAmount}), 0)`,
    totalCommission: sql<number>`COALESCE(SUM(${orders.commissionAmount}), 0)`,
  })
  .from(orders)
  .where(and(...conditions))
  .groupBy(orders.channelId)
  .orderBy(desc(sql`totalRevenue`))
  .limit(limit);
  
  // 获取渠道信息
  const channelIds = orderStats.map(s => s.channelId).filter(Boolean) as number[];
  if (channelIds.length === 0) return [];
  
  const channelList = await db.select({
    id: channels.id,
    channelName: channels.channelName,
    channelCode: channels.channelCode,
    channelType: channels.channelType,
  }).from(channels).where(inArray(channels.id, channelIds));
  
  const channelMap = new Map(channelList.map(c => [c.id, c]));
  
  return orderStats.map(stat => ({
    ...stat,
    channel: channelMap.get(stat.channelId as number) || null,
  }));
}


// ==================== 订单管理（管理员） ====================
export async function getAllOrders(filters?: {
  status?: string;
  channelId?: number;
  searchTerm?: string;
  city?: string;
  scenicSpot?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'createdAt' | 'orderAmount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };
  
  const conditions: any[] = [];
  
  // 状态筛选
  if (filters?.status && filters.status !== 'all') {
    conditions.push(eq(orders.orderStatus, filters.status as any));
  }
  // 渠道筛选
  if (filters?.channelId) {
    conditions.push(eq(orders.channelId, filters.channelId));
  }
  // 城市筛选
  if (filters?.city) {
    conditions.push(eq(orders.city, filters.city));
  }
  // 景点筛选
  if (filters?.scenicSpot) {
    conditions.push(eq(orders.scenicSpot, filters.scenicSpot));
  }
  // 时间范围筛选
  if (filters?.startDate) {
    conditions.push(gte(orders.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(orders.createdAt, filters.endDate));
  }
  // 搜索（订单ID、用户ID、第三方订单号）
  if (filters?.searchTerm) {
    conditions.push(
      or(
        like(orders.orderNo, `%${filters.searchTerm}%`),
        like(sql`CAST(${orders.userId} AS CHAR)`, `%${filters.searchTerm}%`),
        like(orders.thirdPartyOrderNo, `%${filters.searchTerm}%`)
      )
    );
  }
  
  // 排序
  const sortColumn = filters?.sortBy === 'orderAmount' ? orders.orderAmount : orders.createdAt;
  const orderDirection = filters?.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
  
  // 分页
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  // 查询总数
  const countResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  const total = countResult[0]?.count || 0;
  
  // 查询订单列表（关联用户和渠道信息）
  const result = await db.select({
    id: orders.id,
    orderNo: orders.orderNo,
    userId: orders.userId,
    channelId: orders.channelId,
    salesId: orders.salesId,
    orderType: orders.orderType,
    orderAmount: orders.orderAmount,
    pointsUsed: orders.pointsUsed,
    commissionAmount: orders.commissionAmount,
    orderStatus: orders.orderStatus,
    paymentMethod: orders.paymentMethod,
    paymentTime: orders.paymentTime,
    thirdPartyOrderNo: orders.thirdPartyOrderNo,
    city: orders.city,
    scenicSpot: orders.scenicSpot,
    faceType: orders.faceType,
    selfieUrl: orders.selfieUrl,
    templateIds: orders.templateIds,
    resultUrls: orders.resultUrls,
    photoCount: orders.photoCount,
    errorCode: orders.errorCode,
    errorMessage: orders.errorMessage,
    createdAt: orders.createdAt,
    updatedAt: orders.updatedAt,
    // 用户信息
    userName: users.name,
    userOpenId: users.openId,
    userAvatar: users.avatar,
    // 渠道信息
    channelName: channels.channelName,
    channelCode: channels.channelCode,
  })
  .from(orders)
  .leftJoin(users, eq(orders.userId, users.id))
  .leftJoin(channels, eq(orders.channelId, channels.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(orderDirection)
  .limit(pageSize)
  .offset(offset);
  
  return { orders: result, total };
}

// 获取单个订单详情
export async function getOrderDetail(orderId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({
    id: orders.id,
    orderNo: orders.orderNo,
    userId: orders.userId,
    channelId: orders.channelId,
    salesId: orders.salesId,
    orderType: orders.orderType,
    orderAmount: orders.orderAmount,
    pointsUsed: orders.pointsUsed,
    commissionAmount: orders.commissionAmount,
    orderStatus: orders.orderStatus,
    paymentMethod: orders.paymentMethod,
    paymentTime: orders.paymentTime,
    thirdPartyOrderNo: orders.thirdPartyOrderNo,
    city: orders.city,
    scenicSpot: orders.scenicSpot,
    faceType: orders.faceType,
    selfieUrl: orders.selfieUrl,
    templateIds: orders.templateIds,
    resultUrls: orders.resultUrls,
    photoCount: orders.photoCount,
    errorCode: orders.errorCode,
    errorMessage: orders.errorMessage,
    createdAt: orders.createdAt,
    updatedAt: orders.updatedAt,
    // 用户信息
    userName: users.name,
    userOpenId: users.openId,
    userAvatar: users.avatar,
    // 渠道信息
    channelName: channels.channelName,
    channelCode: channels.channelCode,
  })
  .from(orders)
  .leftJoin(users, eq(orders.userId, users.id))
  .leftJoin(channels, eq(orders.channelId, channels.id))
  .where(eq(orders.id, orderId))
  .limit(1);
  
  return result[0] || null;
}

// 导出订单数据（不分页）
export async function exportOrders(filters?: {
  status?: string;
  channelId?: number;
  searchTerm?: string;
  city?: string;
  scenicSpot?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [];
  
  if (filters?.status && filters.status !== 'all') {
    conditions.push(eq(orders.orderStatus, filters.status as any));
  }
  if (filters?.channelId) {
    conditions.push(eq(orders.channelId, filters.channelId));
  }
  if (filters?.city) {
    conditions.push(eq(orders.city, filters.city));
  }
  if (filters?.scenicSpot) {
    conditions.push(eq(orders.scenicSpot, filters.scenicSpot));
  }
  if (filters?.startDate) {
    conditions.push(gte(orders.createdAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(orders.createdAt, filters.endDate));
  }
  if (filters?.searchTerm) {
    conditions.push(
      or(
        like(orders.orderNo, `%${filters.searchTerm}%`),
        like(sql`CAST(${orders.userId} AS CHAR)`, `%${filters.searchTerm}%`),
        like(orders.thirdPartyOrderNo, `%${filters.searchTerm}%`)
      )
    );
  }
  
  const result = await db.select({
    id: orders.id,
    orderNo: orders.orderNo,
    userId: orders.userId,
    orderAmount: orders.orderAmount,
    pointsUsed: orders.pointsUsed,
    orderStatus: orders.orderStatus,
    paymentMethod: orders.paymentMethod,
    thirdPartyOrderNo: orders.thirdPartyOrderNo,
    city: orders.city,
    scenicSpot: orders.scenicSpot,
    faceType: orders.faceType,
    photoCount: orders.photoCount,
    errorCode: orders.errorCode,
    errorMessage: orders.errorMessage,
    createdAt: orders.createdAt,
    userName: users.name,
    userOpenId: users.openId,
    channelName: channels.channelName,
    channelCode: channels.channelCode,
  })
  .from(orders)
  .leftJoin(users, eq(orders.userId, users.id))
  .leftJoin(channels, eq(orders.channelId, channels.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(orders.createdAt));
  
  return result;
}

export async function getOrderStats() {
  const db = await getDb();
  if (!db) return { totalOrders: 0, totalRevenue: 0, todayOrders: 0, todayRevenue: 0 };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const totalStats = await db.select({ 
    count: sql<number>`COUNT(*)`,
    revenue: sql<number>`COALESCE(SUM(${orders.orderAmount}), 0)`
  }).from(orders).where(eq(orders.orderStatus, 'completed'));
  
  const todayStats = await db.select({ 
    count: sql<number>`COUNT(*)`,
    revenue: sql<number>`COALESCE(SUM(${orders.orderAmount}), 0)`
  }).from(orders).where(
    and(
      eq(orders.orderStatus, 'completed'),
      gte(orders.createdAt, today)
    )
  );
  
  return {
    totalOrders: totalStats[0]?.count || 0,
    totalRevenue: totalStats[0]?.revenue || 0,
    todayOrders: todayStats[0]?.count || 0,
    todayRevenue: todayStats[0]?.revenue || 0,
  };
}

// ==================== 用户管理（管理员） ====================
export async function getAllUsers(filters?: { searchTerm?: string; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [];
  
  if (filters?.searchTerm) {
    conditions.push(
      or(
        like(users.name, `%${filters.searchTerm}%`),
        like(users.email, `%${filters.searchTerm}%`),
        like(users.openId, `%${filters.searchTerm}%`)
      )
    );
  }
  
  const result = await db.select({
    id: users.id,
    openId: users.openId,
    name: users.name,
    email: users.email,
    avatar: users.avatar,
    gender: users.gender,
    userType: users.userType,
    faceType: users.faceType,
    points: users.points,
    role: users.role,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  })
  .from(users)
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(users.createdAt))
  .limit(100);
  
  return result;
}

export async function getUserStats() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, todayUsers: 0, activeUsers: 0 };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const totalUsers = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
  const todayUsers = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(gte(users.createdAt, today));
  const activeUsers = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(gte(users.lastSignedIn, weekAgo));
  
  return {
    totalUsers: totalUsers[0]?.count || 0,
    todayUsers: todayUsers[0]?.count || 0,
    activeUsers: activeUsers[0]?.count || 0,
  };
}


// ==================== 城市管理 ====================

export async function getAllCities() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(cities)
    .orderBy(asc(cities.pinyin));
  
  return result;
}

export async function getActiveCities() {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select()
    .from(cities)
    .where(eq(cities.isActive, true))
    .orderBy(asc(cities.pinyin));

  return result;
}

export async function getCityById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(cities)
    .where(eq(cities.id, id))
    .limit(1);

  return result[0] || null;
}

export async function createCity(data: { name: string; pinyin: string }) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(cities).values({
    name: data.name,
    pinyin: data.pinyin.toLowerCase(),
  });
  
  return result;
}

export async function updateCity(id: number, data: { name?: string; pinyin?: string; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return null;
  
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.pinyin !== undefined) updateData.pinyin = data.pinyin.toLowerCase();
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  const result = await db.update(cities)
    .set(updateData)
    .where(eq(cities.id, id));
  
  return result;
}

export async function deleteCity(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  // 先检查是否有关联的景点
  const relatedSpots = await db.select({ count: sql<number>`COUNT(*)` })
    .from(spots)
    .where(eq(spots.cityId, id));
  
  if (relatedSpots[0]?.count > 0) {
    throw new Error('该城市下还有景点，请先删除景点');
  }
  
  const result = await db.delete(cities).where(eq(cities.id, id));
  return result;
}

// ==================== 景点管理 ====================

export async function getAllSpots(cityId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (cityId) {
    conditions.push(eq(spots.cityId, cityId));
  }
  
  const result = await db.select({
    id: spots.id,
    name: spots.name,
    cityId: spots.cityId,
    cityName: cities.name,
    latitude: spots.latitude,
    longitude: spots.longitude,
    isActive: spots.isActive,
    createdAt: spots.createdAt,
  })
  .from(spots)
  .leftJoin(cities, eq(spots.cityId, cities.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(spots.createdAt));
  
  return result;
}

export async function getActiveSpots(cityId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(spots.isActive, true)];
  if (cityId) {
    conditions.push(eq(spots.cityId, cityId));
  }
  
  const result = await db.select({
    id: spots.id,
    name: spots.name,
    cityId: spots.cityId,
    cityName: cities.name,
    latitude: spots.latitude,
    longitude: spots.longitude,
  })
  .from(spots)
  .leftJoin(cities, eq(spots.cityId, cities.id))
  .where(and(...conditions))
  .orderBy(desc(spots.createdAt));
  
  return result;
}

export async function createSpot(data: { 
  name: string; 
  cityId: number; 
  latitude?: string; 
  longitude?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(spots).values({
    name: data.name,
    cityId: data.cityId,
    latitude: data.latitude || null,
    longitude: data.longitude || null,
  });
  
  return result;
}

export async function updateSpot(id: number, data: { 
  name?: string; 
  cityId?: number; 
  latitude?: string; 
  longitude?: string;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.cityId !== undefined) updateData.cityId = data.cityId;
  if (data.latitude !== undefined) updateData.latitude = data.latitude;
  if (data.longitude !== undefined) updateData.longitude = data.longitude;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  const result = await db.update(spots)
    .set(updateData)
    .where(eq(spots.id, id));
  
  return result;
}

export async function deleteSpot(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.delete(spots).where(eq(spots.id, id));
  return result;
}

// ==================== 分享配置管理 ====================

export async function getAllShareConfigs() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(shareConfigs).orderBy(asc(shareConfigs.pageCode));
  return result;
}

export async function getShareConfig(pageCode: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(shareConfigs)
    .where(eq(shareConfigs.pageCode, pageCode))
    .limit(1);
  
  return result[0] || null;
}

export async function upsertShareConfig(data: {
  pageCode: string;
  pageName: string;
  title?: string;
  coverUrl?: string;
  description?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // 先检查是否存在
  const existing = await db.select()
    .from(shareConfigs)
    .where(eq(shareConfigs.pageCode, data.pageCode))
    .limit(1);
  
  if (existing.length > 0) {
    // 更新
    const result = await db.update(shareConfigs)
      .set({
        pageName: data.pageName,
        title: data.title || null,
        coverUrl: data.coverUrl || null,
        description: data.description || null,
      })
      .where(eq(shareConfigs.pageCode, data.pageCode));
    return result;
  } else {
    // 插入
    const result = await db.insert(shareConfigs).values({
      pageCode: data.pageCode,
      pageName: data.pageName,
      title: data.title || null,
      coverUrl: data.coverUrl || null,
      description: data.description || null,
    });
    return result;
  }
}

// ==================== 系统配置管理（扩展） ====================

export async function getAllSystemConfigs() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(systemConfigs);
  return result;
}

export async function deleteSystemConfig(key: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.delete(systemConfigs)
    .where(eq(systemConfigs.configKey, key));
  return result;
}


// ==================== 人群类型管理 ====================

export async function getAllGroupTypes() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(groupTypes)
    .orderBy(asc(groupTypes.sortOrder), asc(groupTypes.id));
  
  return result;
}

export async function getActiveGroupTypes(photoType?: 'single' | 'group') {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [eq(groupTypes.isActive, true)];
  if (photoType) {
    conditions.push(eq(groupTypes.photoType, photoType));
  }
  
  const result = await db.select()
    .from(groupTypes)
    .where(and(...conditions))
    .orderBy(asc(groupTypes.sortOrder), asc(groupTypes.id));
  
  return result;
}

export async function getGroupTypeByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(groupTypes)
    .where(eq(groupTypes.code, code))
    .limit(1);
  
  return result[0] || null;
}

export async function createGroupType(data: {
  code: string;
  displayName: string;
  photoType?: 'single' | 'group';
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(groupTypes).values({
    code: data.code,
    displayName: data.displayName,
    photoType: data.photoType || 'single',
    sortOrder: data.sortOrder || 0,
  });
  
  return result;
}

export async function updateGroupType(id: number, data: {
  code?: string;
  displayName?: string;
  photoType?: 'single' | 'group';
  sortOrder?: number;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const updateData: any = {};
  if (data.code !== undefined) updateData.code = data.code;
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.photoType !== undefined) updateData.photoType = data.photoType;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  const result = await db.update(groupTypes)
    .set(updateData)
    .where(eq(groupTypes.id, id));
  
  return result;
}

export async function deleteGroupType(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.delete(groupTypes).where(eq(groupTypes.id, id));
  return result;
}

/**
 * 更新人群类型的排序，自动调整其他项的排序以避免冲突
 * 实现逻辑：
 * 1. 获取当前项的旧排序值
 * 2. 如果新排序 < 旧排序，将处于[新排序, 旧排序)区间的项全部+1
 * 3. 如果新排序 > 旧排序，将处于(旧排序, 新排序]区间的项全部-1
 * 4. 更新当前项的排序为新值
 */
export async function updateGroupTypeSortOrder(id: number, newSortOrder: number) {
  const db = await getDb();
  if (!db) return null;
  
  // 获取当前项的信息
  const current = await db.select().from(groupTypes).where(eq(groupTypes.id, id));
  if (!current || current.length === 0) return null;
  
  const currentItem = current[0];
  const oldSortOrder = currentItem.sortOrder;
  const photoType = currentItem.photoType;
  
  // 如果排序没有变化，直接返回
  if (oldSortOrder === newSortOrder) return null;
  
  // 只调整同类型（single）的排序
  if (photoType !== 'single') return null;
  
  if (newSortOrder < oldSortOrder) {
    // 向前移动：将[新位置, 旧位置)区间的项全部后移一位
    await db.update(groupTypes)
      .set({ sortOrder: sql`${groupTypes.sortOrder} + 1` })
      .where(
        and(
          eq(groupTypes.photoType, 'single'),
          gte(groupTypes.sortOrder, newSortOrder),
          lt(groupTypes.sortOrder, oldSortOrder),
          ne(groupTypes.id, id)
        )
      );
  } else {
    // 向后移动：将(旧位置, 新位置]区间的项全部前移一位
    await db.update(groupTypes)
      .set({ sortOrder: sql`${groupTypes.sortOrder} - 1` })
      .where(
        and(
          eq(groupTypes.photoType, 'single'),
          gt(groupTypes.sortOrder, oldSortOrder),
          lte(groupTypes.sortOrder, newSortOrder),
          ne(groupTypes.id, id)
        )
      );
  }
  
  // 更新当前项的排序
  await db.update(groupTypes)
    .set({ sortOrder: newSortOrder })
    .where(eq(groupTypes.id, id));
  
  return { success: true };
}

// ==================== 模板统计 ====================

export async function recordTemplateView(templateId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.update(templates)
    .set({ viewCount: sql`${templates.viewCount} + 1` })
    .where(eq(templates.id, templateId));
  
  return result;
}

export async function recordTemplateSelect(templateId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.update(templates)
    .set({ selectCount: sql`${templates.selectCount} + 1` })
    .where(eq(templates.id, templateId));
  
  return result;
}

export async function recordTemplatePurchase(templateId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.update(templates)
    .set({ purchaseCount: sql`${templates.purchaseCount} + 1` })
    .where(eq(templates.id, templateId));
  
  return result;
}

export async function getTemplateStats(filters?: {
  city?: string;
  scenicSpot?: string;
  groupType?: string;
}) {
  const db = await getDb();
  if (!db) return {
    totalViews: 0,
    totalSelects: 0,
    totalPurchases: 0,
    conversionRate: 0,
    templates: [],
  };
  
  const conditions: any[] = [];
  if (filters?.city) conditions.push(eq(templates.city, filters.city));
  if (filters?.scenicSpot) conditions.push(eq(templates.scenicSpot, filters.scenicSpot));
  if (filters?.groupType) conditions.push(eq(templates.groupType, filters.groupType));
  
  const result = await db.select({
    id: templates.id,
    templateId: templates.templateId,
    name: templates.name,
    imageUrl: templates.imageUrl,
    city: templates.city,
    scenicSpot: templates.scenicSpot,
    groupType: templates.groupType,
    viewCount: templates.viewCount,
    selectCount: templates.selectCount,
    purchaseCount: templates.purchaseCount,
  })
  .from(templates)
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(templates.viewCount));
  
  const totalViews = result.reduce((sum, t) => sum + t.viewCount, 0);
  const totalSelects = result.reduce((sum, t) => sum + t.selectCount, 0);
  const totalPurchases = result.reduce((sum, t) => sum + t.purchaseCount, 0);
  const conversionRate = totalViews > 0 ? (totalPurchases / totalViews * 100).toFixed(2) : '0.00';
  
  return {
    totalViews,
    totalSelects,
    totalPurchases,
    conversionRate: parseFloat(conversionRate),
    templates: result,
  };
}

export async function getTemplateRanking(type: 'hot' | 'potential', limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  if (type === 'hot') {
    // 热度排行：按曝光数排序
    const result = await db.select({
      id: templates.id,
      templateId: templates.templateId,
      name: templates.name,
      imageUrl: templates.imageUrl,
      city: templates.city,
      scenicSpot: templates.scenicSpot,
      groupType: templates.groupType,
      viewCount: templates.viewCount,
      selectCount: templates.selectCount,
      purchaseCount: templates.purchaseCount,
    })
    .from(templates)
    .where(eq(templates.status, 'active'))
    .orderBy(desc(templates.viewCount))
    .limit(limit);
    
    return result;
  } else {
    // 潜力排行：按转化率排序（选择数/曝光数）
    const result = await db.select({
      id: templates.id,
      templateId: templates.templateId,
      name: templates.name,
      imageUrl: templates.imageUrl,
      city: templates.city,
      scenicSpot: templates.scenicSpot,
      groupType: templates.groupType,
      viewCount: templates.viewCount,
      selectCount: templates.selectCount,
      purchaseCount: templates.purchaseCount,
      conversionRate: sql<number>`CASE WHEN ${templates.viewCount} > 0 THEN ${templates.selectCount} / ${templates.viewCount} ELSE 0 END`,
    })
    .from(templates)
    .where(and(eq(templates.status, 'active'), sql`${templates.viewCount} > 10`))
    .orderBy(desc(sql`CASE WHEN ${templates.viewCount} > 0 THEN ${templates.selectCount} / ${templates.viewCount} ELSE 0 END`))
    .limit(limit);
    
    return result;
  }
}


// ==================== 图片配置缓存 ====================

// 保存图片缓存（先清除旧缓存，再保存新缓存）
export async function saveImageCacheBatch(userId: number, images: Array<{
  fileName: string;
  previewUrl: string;
  s3Key?: string;
  city: string;
  spot: string;
  groupType: string;
  faceType: 'wide' | 'narrow' | 'both';
  price: number;
  templateId: string;
  prompt: string;
  order: number;
  batchName?: string;
  batchId?: string;
}>) {
  const db = await getDb();
  if (!db) return null;
  
  // 计算3天后的过期时间
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);
  
  // 先清除该用户的旧缓存
  await db.delete(imageCache).where(eq(imageCache.userId, userId));
  
  // 批量插入新缓存
  if (images.length > 0) {
    const values = images.map((img, index) => ({
      userId,
      fileName: img.fileName,
      previewUrl: img.previewUrl,
      s3Key: img.s3Key || '',
      city: img.city,
      spot: img.spot,
      groupType: img.groupType,
      faceType: img.faceType,
      price: img.price,
      templateId: img.templateId || '',
      prompt: img.prompt || '',
      sortOrder: img.order || index,
      batchName: img.batchName || '',
      batchId: img.batchId || '',
      expiresAt,
    }));
    
    await db.insert(imageCache).values(values);
  }
  
  return { success: true };
}

// 获取用户的图片缓存（只返回未过期的）
export async function getImageCache(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  
  const result = await db.select()
    .from(imageCache)
    .where(
      and(
        eq(imageCache.userId, userId),
        or(
          isNull(imageCache.expiresAt),
          gt(imageCache.expiresAt, now)
        )
      )
    )
    .orderBy(asc(imageCache.sortOrder));
  
  return result;
}

// 清除用户的图片缓存
export async function clearImageCache(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.delete(imageCache)
    .where(eq(imageCache.userId, userId));
  
  return result;
}

// 清理所有过期的缓存数据（定时任务调用）
export async function cleanExpiredImageCache() {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  
  const result = await db.delete(imageCache)
    .where(
      and(
        isNotNull(imageCache.expiresAt),
        lt(imageCache.expiresAt, now)
      )
    );
  
  return result;
}


// ==================== 模板排序 ====================

// 获取指定分组（城市+景点+人群类型）的最大排序值
export async function getMaxSortOrder(city: string, scenicSpot: string, groupType: string) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({
    maxSort: sql<number>`COALESCE(MAX(${templates.sortOrder}), 0)`
  })
  .from(templates)
  .where(
    and(
      eq(templates.city, city),
      eq(templates.scenicSpot, scenicSpot),
      eq(templates.groupType, groupType)
    )
  );
  
  return result[0]?.maxSort || 0;
}

// 批量更新模板排序
export async function updateTemplateSortOrders(updates: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) return null;
  
  // 逐个更新排序值
  for (const update of updates) {
    await db.update(templates)
      .set({ sortOrder: update.sortOrder })
      .where(eq(templates.id, update.id));
  }
  
  return { success: true };
}

// 删除模板后重新计算排序（保持连续）
export async function recalculateSortOrderAfterDelete(city: string, scenicSpot: string, groupType: string) {
  const db = await getDb();
  if (!db) return null;
  
  // 获取该分组的所有模板，按当前排序排列
  const templatesInGroup = await db.select({
    id: templates.id,
    sortOrder: templates.sortOrder
  })
  .from(templates)
  .where(
    and(
      eq(templates.city, city),
      eq(templates.scenicSpot, scenicSpot),
      eq(templates.groupType, groupType)
    )
  )
  .orderBy(asc(templates.sortOrder));
  
  // 重新分配排序值（从1开始）
  for (let i = 0; i < templatesInGroup.length; i++) {
    const newSortOrder = i + 1;
    if (templatesInGroup[i].sortOrder !== newSortOrder) {
      await db.update(templates)
        .set({ sortOrder: newSortOrder })
        .where(eq(templates.id, templatesInGroup[i].id));
    }
  }
  
  return { success: true };
}

// 删除模板并重新计算排序
export async function deleteTemplateAndRecalculateSort(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 先获取要删除的模板信息
  const templateToDelete = await db.select({
    city: templates.city,
    scenicSpot: templates.scenicSpot,
    groupType: templates.groupType
  })
  .from(templates)
  .where(eq(templates.id, id))
  .limit(1);
  
  if (templateToDelete.length === 0) {
    throw new Error("Template not found");
  }
  
  const { city, scenicSpot, groupType } = templateToDelete[0];
  
  // 删除模板
  await db.delete(templates).where(eq(templates.id, id));
  
  // 重新计算排序
  await recalculateSortOrderAfterDelete(city, scenicSpot, groupType);
  
  return { success: true };
}


// ==================== 推广员业绩统计 ====================

// 获取推广员业绩统计
export async function getSalesStats(salesId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // 获取推广员信息
  const salesInfo = await db.select().from(sales).where(eq(sales.id, salesId)).limit(1);
  if (salesInfo.length === 0) return null;
  
  const salesData = salesInfo[0];
  
  // 统计扫码用户数（用户表中salesId关联的用户数）
  const userCountResult = await db.select({
    count: sql<number>`COUNT(*)`
  }).from(users).where(eq(users.salesId, salesId));
  const totalUsers = userCountResult[0]?.count || 0;
  
  // 统计今日扫码用户数
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayUserCountResult = await db.select({
    count: sql<number>`COUNT(*)`
  }).from(users).where(
    and(
      eq(users.salesId, salesId),
      gte(users.createdAt, today)
    )
  );
  const todayUsers = todayUserCountResult[0]?.count || 0;
  
  // 统计订单数和销售额
  const orderStatsResult = await db.select({
    count: sql<number>`COUNT(*)`,
    totalAmount: sql<number>`COALESCE(SUM(${orders.orderAmount}), 0)`
  }).from(orders).where(
    and(
      eq(orders.salesId, salesId),
      eq(orders.orderStatus, 'paid')
    )
  );
  const totalOrders = orderStatsResult[0]?.count || 0;
  const totalSalesAmount = orderStatsResult[0]?.totalAmount || 0;
  
  // 统计今日订单数和销售额
  const todayOrderStatsResult = await db.select({
    count: sql<number>`COUNT(*)`,
    totalAmount: sql<number>`COALESCE(SUM(${orders.orderAmount}), 0)`
  }).from(orders).where(
    and(
      eq(orders.salesId, salesId),
      eq(orders.orderStatus, 'paid'),
      gte(orders.createdAt, today)
    )
  );
  const todayOrders = todayOrderStatsResult[0]?.count || 0;
  const todaySalesAmount = todayOrderStatsResult[0]?.totalAmount || 0;
  
  // 计算佣金（根据推广员佣金比例）
  const commissionRate = salesData.commissionRate / 100; // 转换为小数
  const totalCommission = Math.floor(totalSalesAmount * commissionRate);
  const todayCommission = Math.floor(todaySalesAmount * commissionRate);
  
  return {
    salesId,
    salesName: salesData.salesName,
    salesCode: salesData.salesCode,
    channelId: salesData.channelId,
    commissionRate: salesData.commissionRate,
    // 扫码统计
    todayScans: todayUsers,
    totalScans: totalUsers,
    // 订单统计
    todayOrders,
    totalOrders,
    // 销售额（分）
    todaySalesAmount,
    totalSalesAmount,
    // 佣金（分）
    todayCommission,
    totalCommission,
    // 待结算和已结算佣金（暂时简化处理）
    pendingCommission: totalCommission,
    settledCommission: 0,
    // 转化率
    conversionRate: totalUsers > 0 ? (totalOrders / totalUsers * 100).toFixed(1) : '0.0'
  };
}

// 获取推广员的订单列表
export async function getOrdersBySalesId(
  salesId: number, 
  page: number = 1, 
  pageSize: number = 20,
  filters?: {
    status?: string;
    search?: string;
    city?: string;
    scenicSpot?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: 'createdAt' | 'orderAmount';
    sortOrder?: 'asc' | 'desc';
  }
) {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };
  
  const offset = (page - 1) * pageSize;
  
  // 构建筛选条件
  const conditions = [eq(orders.salesId, salesId)];
  
  if (filters?.status) {
    conditions.push(eq(orders.orderStatus, filters.status as 'pending' | 'paid' | 'completed' | 'failed'));
  }
  
  if (filters?.search) {
    conditions.push(
      or(
        like(orders.orderNo, `%${filters.search}%`),
        like(orders.userId, `%${filters.search}%`),
        like(orders.thirdPartyOrderNo, `%${filters.search}%`)
      )!
    );
  }
  
  if (filters?.city) {
    conditions.push(eq(orders.city, filters.city));
  }
  
  if (filters?.scenicSpot) {
    conditions.push(eq(orders.scenicSpot, filters.scenicSpot));
  }
  
  if (filters?.startDate) {
    conditions.push(gte(orders.createdAt, new Date(filters.startDate)));
  }
  
  if (filters?.endDate) {
    const endDateObj = new Date(filters.endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    conditions.push(lt(orders.createdAt, endDateObj));
  }
  
  const whereClause = and(...conditions);
  
  // 排序
  const sortField = filters?.sortBy === 'orderAmount' ? orders.orderAmount : orders.createdAt;
  const orderByClause = filters?.sortOrder === 'asc' ? asc(sortField) : desc(sortField);
  
  // 获取订单列表
  const orderList = await db.select()
    .from(orders)
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(pageSize)
    .offset(offset);
  
  // 获取总数
  const countResult = await db.select({
    count: sql<number>`COUNT(*)`
  }).from(orders).where(whereClause);
  
  return {
    orders: orderList,
    total: countResult[0]?.count || 0
  };
}

// 更新用户的推广员和渠道关联
export async function updateUserSalesChannel(openId: string, salesId: number, channelId: number) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(users)
    .set({ 
      salesId,
      channelId
    })
    .where(eq(users.openId, openId));
  
  return { success: true };
}

// 根据 URL 参数获取推广员和渠道信息
export async function getSalesInfoByUrlParams(params: {
  channelCode: string;
  salesCode: string;
  city?: string;
  scenicSpot?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // 通过渠道码和推广员码查找
  // 先查找渠道
  const channelResult = await db.select()
    .from(channels)
    .where(eq(channels.channelCode, params.channelCode))
    .limit(1);
  
  if (channelResult.length === 0) return null;
  const channel = channelResult[0];
  
  // 查找推广员
  const salesResult = await db.select()
    .from(sales)
    .where(and(
      eq(sales.channelId, channel.id),
      eq(sales.salesCode, params.salesCode)
    ))
    .limit(1);
  
  if (salesResult.length === 0) return null;
  const salesPerson = salesResult[0];
  
  return {
    salesId: salesPerson.id,
    channelId: channel.id,
    city: params.city || null,
    scenicSpot: params.scenicSpot || null,
    type: 'sales' as const
  };
}

// 根据推广码获取推广员和渠道信息
export async function getSalesInfoByPromoCode(promoCode: string) {
  const db = await getDb();
  if (!db) return null;
  
  // 先查询推广员推广码表
  const salesPromoResult = await db.select()
    .from(salesPromotionCodes)
    .where(eq(salesPromotionCodes.promoCode, promoCode))
    .limit(1);
  
  if (salesPromoResult.length > 0) {
    const promo = salesPromoResult[0];
    return {
      salesId: promo.salesId,
      channelId: promo.channelId,
      city: promo.city,
      scenicSpot: promo.scenicSpot,
      type: 'sales' as const
    };
  }
  
  // 如果不是推广员推广码，查询渠道推广码表
  const channelPromoResult = await db.select()
    .from(promotionCodes)
    .where(eq(promotionCodes.promoCode, promoCode))
    .limit(1);
  
  if (channelPromoResult.length > 0) {
    const promo = channelPromoResult[0];
    return {
      salesId: promo.salesId || null,
      channelId: promo.channelId,
      city: promo.city,
      scenicSpot: promo.scenicSpot,
      type: 'channel' as const
    };
  }
  
  return null;
}

// 获取机构渠道下所有推广员的业绩汇总
export async function getChannelSalesStats(channelId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // 获取该渠道下所有推广员
  const salesList = await db.select().from(sales).where(eq(sales.channelId, channelId));
  
  const statsPromises = salesList.map(async (s) => {
    // 统计扫码用户数
    const userCountResult = await db.select({
      count: sql<number>`COUNT(*)`
    }).from(users).where(eq(users.salesId, s.id));
    
    // 统计订单数和销售额
    const orderStatsResult = await db.select({
      count: sql<number>`COUNT(*)`,
      totalAmount: sql<number>`COALESCE(SUM(${orders.orderAmount}), 0)`
    }).from(orders).where(
      and(
        eq(orders.salesId, s.id),
        eq(orders.orderStatus, 'paid')
      )
    );
    
    const totalOrders = orderStatsResult[0]?.count || 0;
    const totalSalesAmount = orderStatsResult[0]?.totalAmount || 0;
    const commissionRate = s.commissionRate / 100;
    const totalCommission = Math.floor(totalSalesAmount * commissionRate);
    
    return {
      id: s.id,
      salesName: s.salesName,
      salesCode: s.salesCode,
      loginAccount: s.loginAccount,
      status: s.status,
      commissionRate: s.commissionRate,
      totalUsers: userCountResult[0]?.count || 0,
      totalOrders,
      totalSalesAmount,
      totalCommission,
      createdAt: s.createdAt
    };
  });
  
  return Promise.all(statsPromises);
}

// ==================== 渠道门户订单查询 ====================
export async function getChannelOrders(params: {
  channelId: number;
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  city?: string;
  scenicSpot?: string;
  startDate?: string;
  endDate?: string;
  salesId?: number;
  sortBy?: 'createdAt' | 'orderAmount';
  sortOrder?: 'asc' | 'desc';
}) {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };
  
  const { channelId, page = 1, pageSize = 20, status, search, city, scenicSpot, startDate, endDate, salesId, sortBy = 'createdAt', sortOrder = 'desc' } = params;
  const offset = (page - 1) * pageSize;
  
  const conditions: any[] = [eq(orders.channelId, channelId)];
  
  if (status) {
    conditions.push(eq(orders.orderStatus, status as any));
  }
  if (search) {
    conditions.push(
      or(
        like(orders.orderNo, `%${search}%`),
        like(orders.thirdPartyOrderNo, `%${search}%`)
      )
    );
  }
  if (city) {
    conditions.push(eq(orders.city, city));
  }
  if (scenicSpot) {
    conditions.push(eq(orders.scenicSpot, scenicSpot));
  }
  if (startDate) {
    conditions.push(gte(orders.createdAt, new Date(startDate)));
  }
  if (endDate) {
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);
    conditions.push(lte(orders.createdAt, endDateTime));
  }
  if (salesId) {
    conditions.push(eq(orders.salesId, salesId));
  }
  
  // 构建排序
  const orderByColumn = sortBy === 'orderAmount' ? orders.orderAmount : orders.createdAt;
  const orderByDirection = sortOrder === 'asc' ? asc(orderByColumn) : desc(orderByColumn);
  
  // 查询订单列表（带用户信息）
  const orderList = await db.select({
    id: orders.id,
    orderNo: orders.orderNo,
    userId: orders.userId,
    userOpenId: users.openId,
    channelId: orders.channelId,
    salesId: orders.salesId,
    orderType: orders.orderType,
    orderAmount: orders.orderAmount,
    pointsUsed: orders.pointsUsed,
    commissionAmount: orders.commissionAmount,
    orderStatus: orders.orderStatus,
    paymentMethod: orders.paymentMethod,
    paymentTime: orders.paymentTime,
    photoCount: orders.photoCount,
    city: orders.city,
    scenicSpot: orders.scenicSpot,
    faceType: orders.faceType,
    selfieUrl: orders.selfieUrl,
    templateIds: orders.templateIds,
    resultUrls: orders.resultUrls,
    errorCode: orders.errorCode,
    errorMessage: orders.errorMessage,
    thirdPartyOrderNo: orders.thirdPartyOrderNo,
    createdAt: orders.createdAt,
    userName: users.name,
    userAvatar: users.avatar,
  })
  .from(orders)
  .leftJoin(users, eq(orders.userId, users.id))
  .where(and(...conditions))
  .orderBy(orderByDirection)
  .limit(pageSize)
  .offset(offset);
  
  // 查询总数
  const countResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(and(...conditions));
  
  const total = countResult[0]?.count || 0;
  
  return {
    orders: orderList,
    total,
  };
}


// ==================== 订单趋势数据 ====================

export async function getChannelOrderTrend(channelId: number, days: number = 7) {
  const db = await getDb();
  if (!db) return [];
  
  // 获取过去N天的日期范围
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);
  
  // 查询该渠道的订单数据
  const orderList = await db.select({
    createdAt: orders.createdAt,
    orderAmount: orders.orderAmount,
    commissionAmount: orders.commissionAmount,
  })
  .from(orders)
  .where(
    and(
      eq(orders.channelId, channelId),
      gte(orders.createdAt, startDate)
    )
  );
  
  // 按日期分组统计
  const trendMap = new Map<string, { date: string; orderCount: number; orderAmount: number; commissionAmount: number }>();
  
  // 初始化所有日期
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    trendMap.set(dateStr, {
      date: dateStr,
      orderCount: 0,
      orderAmount: 0,
      commissionAmount: 0,
    });
  }
  
  // 统计订单数据
  for (const order of orderList) {
    if (!order.createdAt) continue;
    const dateStr = new Date(order.createdAt).toISOString().split('T')[0];
    const existing = trendMap.get(dateStr);
    if (existing) {
      existing.orderCount += 1;
      existing.orderAmount += order.orderAmount || 0;
      existing.commissionAmount += order.commissionAmount || 0;
    }
  }
  
  // 转换为数组并排序
  const result = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  
  // 格式化日期显示
  return result.map(item => ({
    ...item,
    dateLabel: `${parseInt(item.date.split('-')[1])}/${parseInt(item.date.split('-')[2])}`,
  }));
}


/**
 * 判断用户是否为新用户
 * 新用户定义：未消费过积分的用户（即未曾生成过照片）
 * 老用户定义：已消费过积分的用户（已生成过照片，无论成功或失败）
 */
export async function isNewUser(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return true; // 数据库连接失败时，默认为新用户
  
  try {
    // 查询该用户是否有任何照片记录（无论状态如何）
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(userPhotos)
      .where(eq(userPhotos.userId, userId));
    
    const count = result[0]?.count || 0;
    return count === 0;
  } catch (error) {
    console.error('Error checking user photos:', error);
    return true; // 查询失败时，默认为新用户
  }
}

/**
 * 获取用户的用户类型（新用户/老用户）
 */
export async function getUserType(userId: number): Promise<'new' | 'old'> {
  const isNew = await isNewUser(userId);
  return isNew ? 'new' : 'old';
}

// ==================== 小程序专用函数 ====================

/**
 * 创建新用户
 */
export async function createUser(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(users).values(data);

  // 返回创建的用户
  const result = await db.select().from(users).where(eq(users.openId, data.openId!)).limit(1);
  return result[0];
}

/**
 * 获取用户未完成的照片（processing 状态）
 */
export async function getUserPendingPhotos(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select()
    .from(userPhotos)
    .where(and(
      eq(userPhotos.userId, userId),
      eq(userPhotos.status, 'processing')
    ))
    .orderBy(desc(userPhotos.createdAt))
    .limit(10);

  return result;
}

/**
 * 更新用户是否已使用免费积分
 */
export async function updateUserHasUsedFreeCredits(userId: number, value: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ hasUsedFreeCredits: value })
    .where(eq(users.id, userId));
}

/**
 * 更新用户最后自拍照URL
 */
export async function updateUserLastSelfie(userId: number, selfieUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users)
    .set({ lastSelfieUrl: selfieUrl })
    .where(eq(users.id, userId));
}

/**
 * 分页获取用户照片列表
 */
export async function getUserPhotosPaginated(userId: number, page: number, pageSize: number) {
  const db = await getDb();
  if (!db) return { list: [], total: 0 };

  const offset = (page - 1) * pageSize;

  // 获取总数（排除已删除的照片）
  const countResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(userPhotos)
    .where(and(
      eq(userPhotos.userId, userId),
      ne(userPhotos.status, 'deleted' as any)
    ));
  const total = countResult[0]?.count || 0;

  // 获取分页数据（排除已删除的照片）
  const list = await db.select()
    .from(userPhotos)
    .where(and(
      eq(userPhotos.userId, userId),
      ne(userPhotos.status, 'deleted' as any)
    ))
    .orderBy(desc(userPhotos.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { list, total };
}

/**
 * 根据页面代码获取分享配置
 */
export async function getShareConfigByPageCode(pageCode: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select()
    .from(shareConfigs)
    .where(eq(shareConfigs.pageCode, pageCode))
    .limit(1);

  return result[0] || null;
}
