import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  getChannelUserById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        channelId: 100,
        username: 'test_channel',
        role: 'admin',
      });
    }
    return Promise.resolve(null);
  }),
  getChannelById: vi.fn().mockImplementation((id: number) => {
    if (id === 100) {
      return Promise.resolve({
        id: 100,
        channelName: '测试机构渠道',
        channelCode: 'CH100',
        channelType: 'institution',
        commissionRate: 50,
        status: 'active',
        cities: '["杭州", "长沙"]',
        scenicSpots: '["西湖", "橘子洲"]',
        createdAt: new Date(),
      });
    }
    if (id === 200) {
      return Promise.resolve({
        id: 200,
        channelName: '测试个人渠道',
        channelCode: 'CH200',
        channelType: 'personal',
        commissionRate: 30,
        status: 'active',
        cities: '["北京"]',
        scenicSpots: '["故宫"]',
        createdAt: new Date(),
      });
    }
    return Promise.resolve(null);
  }),
  getChannelOrders: vi.fn().mockImplementation((params: any) => {
    // 模拟订单数据
    const allOrders = [
      {
        id: 1,
        orderNo: 'ORD001',
        userId: 1,
        channelId: 100,
        salesId: 10,
        orderType: 'single',
        orderAmount: 1000,
        pointsUsed: 5,
        commissionAmount: 500,
        orderStatus: 'paid',
        city: '杭州',
        scenicSpot: '西湖',
        faceType: 'normal',
        createdAt: new Date(),
      },
      {
        id: 2,
        orderNo: 'ORD002',
        userId: 2,
        channelId: 100,
        salesId: 20,
        orderType: 'dual',
        orderAmount: 2000,
        pointsUsed: 10,
        commissionAmount: 1000,
        orderStatus: 'completed',
        city: '长沙',
        scenicSpot: '橘子洲',
        faceType: 'wide',
        createdAt: new Date(),
      },
      {
        id: 3,
        orderNo: 'ORD003',
        userId: 3,
        channelId: 100,
        salesId: 10,
        orderType: 'single',
        orderAmount: 1500,
        pointsUsed: 8,
        commissionAmount: 750,
        orderStatus: 'paid',
        city: '杭州',
        scenicSpot: '西湖',
        faceType: 'narrow',
        createdAt: new Date(),
      },
    ];
    
    let filteredOrders = allOrders.filter(o => o.channelId === params.channelId);
    
    // 按salesId筛选
    if (params.salesId) {
      filteredOrders = filteredOrders.filter(o => o.salesId === params.salesId);
    }
    
    // 按状态筛选
    if (params.status) {
      filteredOrders = filteredOrders.filter(o => o.orderStatus === params.status);
    }
    
    // 按城市筛选
    if (params.city) {
      filteredOrders = filteredOrders.filter(o => o.city === params.city);
    }
    
    // 按景点筛选
    if (params.scenicSpot) {
      filteredOrders = filteredOrders.filter(o => o.scenicSpot === params.scenicSpot);
    }
    
    return Promise.resolve({
      orders: filteredOrders,
      total: filteredOrders.length,
    });
  }),
  getSalesByChannelId: vi.fn().mockImplementation((channelId: number) => {
    if (channelId === 100) {
      return Promise.resolve([
        { id: 10, salesName: '推广员A', salesCode: 'S001', status: 'active' },
        { id: 20, salesName: '推广员B', salesCode: 'S002', status: 'active' },
      ]);
    }
    return Promise.resolve([]);
  }),
  getChannelSalesStats: vi.fn().mockImplementation((channelId: number) => {
    if (channelId === 100) {
      return Promise.resolve([
        { id: 10, salesName: '推广员A', loginAccount: 'sales_a', status: 'active', totalOrders: 5, totalSalesAmount: 5000, totalCommission: 2500, createdAt: new Date() },
        { id: 20, salesName: '推广员B', loginAccount: 'sales_b', status: 'active', totalOrders: 3, totalSalesAmount: 3000, totalCommission: 1500, createdAt: new Date() },
      ]);
    }
    return Promise.resolve([]);
  }),
  // 其他必要的mock
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
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("channelPortal.orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns orders for a channel", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channelPortal.orders({
      channelId: 100,
      page: 1,
      pageSize: 20,
    });

    expect(result).toBeDefined();
    expect(result.orders).toBeDefined();
    expect(Array.isArray(result.orders)).toBe(true);
    expect(result.total).toBe(3);
  });

  it("filters orders by salesId for institution channel", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channelPortal.orders({
      channelId: 100,
      salesId: 10,
      page: 1,
      pageSize: 20,
    });

    expect(result).toBeDefined();
    expect(result.orders).toBeDefined();
    expect(result.total).toBe(2); // 推广员A有2个订单
    result.orders.forEach((order: any) => {
      expect(order.salesId).toBe(10);
    });
  });

  it("filters orders by status", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channelPortal.orders({
      channelId: 100,
      status: 'paid',
      page: 1,
      pageSize: 20,
    });

    expect(result).toBeDefined();
    expect(result.total).toBe(2); // 2个已支付订单
    result.orders.forEach((order: any) => {
      expect(order.orderStatus).toBe('paid');
    });
  });

  it("filters orders by city", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channelPortal.orders({
      channelId: 100,
      city: '杭州',
      page: 1,
      pageSize: 20,
    });

    expect(result).toBeDefined();
    expect(result.total).toBe(2); // 杭州有2个订单
    result.orders.forEach((order: any) => {
      expect(order.city).toBe('杭州');
    });
  });

  it("combines salesId and city filters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channelPortal.orders({
      channelId: 100,
      salesId: 10,
      city: '杭州',
      page: 1,
      pageSize: 20,
    });

    expect(result).toBeDefined();
    expect(result.total).toBe(2); // 推广员A在杭州的订单
    result.orders.forEach((order: any) => {
      expect(order.salesId).toBe(10);
      expect(order.city).toBe('杭州');
    });
  });

  it("returns empty result for non-existent channel", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channelPortal.orders({
      channelId: 999,
      page: 1,
      pageSize: 20,
    });

    expect(result).toBeDefined();
    expect(result.orders).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns empty result when salesId filter has no matches", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channelPortal.orders({
      channelId: 100,
      salesId: 999, // 不存在的推广员ID
      page: 1,
      pageSize: 20,
    });

    expect(result).toBeDefined();
    expect(result.orders).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("channelPortal.salesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sales list for institution channel", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channelPortal.salesList({
      channelId: 100,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('推广员A');
    expect(result[1].name).toBe('推广员B');
  });

  it("returns empty list for personal channel", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.channelPortal.salesList({
      channelId: 200,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});
