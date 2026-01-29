import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

// Mock database functions
vi.mock('./db', () => ({
  getDb: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  getTemplates: vi.fn().mockResolvedValue([]),
  getDistinctCities: vi.fn().mockResolvedValue([]),
  getTemplateById: vi.fn(),
  createPhoto: vi.fn(),
  getPhotoByPhotoId: vi.fn(),
  updatePhotoStatus: vi.fn(),
  getUserPhotos: vi.fn().mockResolvedValue([]),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  getAllTemplates: vi.fn().mockResolvedValue([]),
  getChannels: vi.fn().mockResolvedValue([]),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
  getSalesByChannel: vi.fn().mockResolvedValue([]),
  createSales: vi.fn(),
  updateSales: vi.fn(),
  deleteSales: vi.fn(),
  getOrders: vi.fn().mockResolvedValue([]),
  createOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
  getAdminStats: vi.fn().mockResolvedValue({
    totalChannels: 0,
    activeChannels: 0,
    totalOrders: 0,
    totalRevenue: 0,
  }),
  updateUserPoints: vi.fn(),
  createPointsRecord: vi.fn(),
  // 图片缓存相关函数
  saveImageCacheBatch: vi.fn().mockResolvedValue({ success: true }),
  getImageCache: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      fileName: 'test1.jpg',
      previewUrl: 'https://example.com/test1.jpg',
      city: '北京',
      spot: '故宫',
      groupType: 'shaonv',
      faceType: 'narrow',
      price: 10,
      templateId: 'shaonv_narrow_00001',
      prompt: '测试描述1',
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      userId: 1,
      fileName: 'test2.jpg',
      previewUrl: 'https://example.com/test2.jpg',
      city: '上海',
      spot: '外滩',
      groupType: 'dashu',
      faceType: 'wide',
      price: 8,
      templateId: 'dashu_wide_00002',
      prompt: '测试描述2',
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  clearImageCache: vi.fn().mockResolvedValue({ affectedRows: 2 }),
}));

type AuthenticatedUser = NonNullable<TrpcContext['user']>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: 'test-admin-id',
    email: 'admin@example.com',
    name: 'Test Admin',
    loginMethod: 'manus',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: 'https',
      headers: {},
    } as TrpcContext['req'],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext['res'],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: 'test-user-id',
    email: 'user@example.com',
    name: 'Test User',
    loginMethod: 'manus',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: 'https',
      headers: {},
    } as TrpcContext['req'],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext['res'],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: 'https',
      headers: {},
    } as TrpcContext['req'],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext['res'],
  };
}

describe('Image Cache API - saveImageCache', () => {
  const testImages = [
    {
      fileName: 'test1.jpg',
      previewUrl: 'https://example.com/test1.jpg',
      city: '北京',
      spot: '故宫',
      groupType: 'shaonv',
      faceType: 'narrow' as const,
      price: 10,
      templateId: 'shaonv_narrow_00001',
      prompt: '测试描述1',
      order: 1,
    },
    {
      fileName: 'test2.jpg',
      previewUrl: 'https://example.com/test2.jpg',
      city: '上海',
      spot: '外滩',
      groupType: 'dashu',
      faceType: 'wide' as const,
      price: 8,
      templateId: 'dashu_wide_00002',
      prompt: '测试描述2',
      order: 2,
    },
  ];

  it('should save image cache for admin user', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.template.saveImageCache({
      images: testImages,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('should reject non-admin users', async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.template.saveImageCache({
        images: testImages,
      })
    ).rejects.toThrow();
  });

  it('should reject unauthenticated users', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.template.saveImageCache({
        images: testImages,
      })
    ).rejects.toThrow();
  });
});

describe('Image Cache API - getImageCache', () => {
  it('should retrieve cached images for admin user', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.template.getImageCache();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);

    // 验证数据内容
    const firstImage = result[0];
    expect(firstImage.fileName).toBe('test1.jpg');
    expect(firstImage.city).toBe('北京');
    expect(firstImage.spot).toBe('故宫');
  });

  it('should reject non-admin users', async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.template.getImageCache()).rejects.toThrow();
  });

  it('should reject unauthenticated users', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.template.getImageCache()).rejects.toThrow();
  });
});

describe('Image Cache API - clearImageCache', () => {
  it('should clear all cached images for admin user', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.template.clearImageCache();

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should reject non-admin users', async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.template.clearImageCache()).rejects.toThrow();
  });

  it('should reject unauthenticated users', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.template.clearImageCache()).rejects.toThrow();
  });
});

describe('Image Cache Input Validation', () => {
  it('should validate faceType enum values', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const invalidImages = [
      {
        fileName: 'test.jpg',
        previewUrl: 'https://example.com/test.jpg',
        city: '北京',
        spot: '故宫',
        groupType: 'shaonv',
        faceType: 'invalid' as any, // 无效的脸型值
        price: 10,
        templateId: 'test_001',
        order: 1,
      },
    ];

    await expect(
      caller.template.saveImageCache({
        images: invalidImages,
      })
    ).rejects.toThrow();
  });

  it('should accept all valid faceType values', async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // 测试 wide
    const wideResult = await caller.template.saveImageCache({
      images: [
        {
          fileName: 'test_wide.jpg',
          previewUrl: 'https://example.com/test_wide.jpg',
          city: '北京',
          spot: '故宫',
          groupType: 'shaonv',
          faceType: 'wide',
          price: 10,
          templateId: 'test_wide_001',
          order: 1,
        },
      ],
    });
    expect(wideResult.success).toBe(true);

    // 测试 narrow
    const narrowResult = await caller.template.saveImageCache({
      images: [
        {
          fileName: 'test_narrow.jpg',
          previewUrl: 'https://example.com/test_narrow.jpg',
          city: '北京',
          spot: '故宫',
          groupType: 'shaonv',
          faceType: 'narrow',
          price: 10,
          templateId: 'test_narrow_001',
          order: 1,
        },
      ],
    });
    expect(narrowResult.success).toBe(true);

    // 测试 both
    const bothResult = await caller.template.saveImageCache({
      images: [
        {
          fileName: 'test_both.jpg',
          previewUrl: 'https://example.com/test_both.jpg',
          city: '北京',
          spot: '故宫',
          groupType: 'shaonv',
          faceType: 'both',
          price: 10,
          templateId: 'test_both_001',
          order: 1,
        },
      ],
    });
    expect(bothResult.success).toBe(true);
  });
});
