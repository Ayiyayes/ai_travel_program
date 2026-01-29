import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  hasUserCompletedOrder: vi.fn().mockResolvedValue(false),
  getTemplates: vi.fn().mockResolvedValue([
    {
      id: 1,
      templateId: "tpl_001",
      name: "西湖春韵",
      imageUrl: "https://example.com/image1.jpg",
      thumbnailUrl: "https://example.com/thumb1.jpg",
      city: "杭州",
      scenicSpot: "西湖",
      groupType: "花季少女",
      photoType: "single",
      faceType: "both",
      price: 0,
      isFree: true,
      prompt: "test prompt",
      sortOrder: 1,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      templateId: "tpl_002",
      name: "橘子洲头",
      imageUrl: "https://example.com/image2.jpg",
      thumbnailUrl: "https://example.com/thumb2.jpg",
      city: "长沙",
      scenicSpot: "橘子洲",
      groupType: "花季少女",
      photoType: "single",
      faceType: "wide",
      price: 10,
      isFree: false,
      prompt: "test prompt 2",
      sortOrder: 2,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getDistinctCities: vi.fn().mockResolvedValue(["杭州", "长沙", "北京"]),
  getTemplateById: vi.fn().mockResolvedValue({
    id: 1,
    templateId: "tpl_001",
    name: "西湖春韵",
    imageUrl: "https://example.com/image1.jpg",
    thumbnailUrl: "https://example.com/thumb1.jpg",
    city: "杭州",
    scenicSpot: "西湖",
    groupType: "花季少女",
    photoType: "single",
    faceType: "both",
    price: 0,
    isFree: true,
    prompt: "test prompt",
    sortOrder: 1,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
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

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("template.list", () => {
  it("returns templates list for public access", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.template.list({});

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("filters templates by groupType", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.template.list({ groupType: "花季少女" });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("filters templates by city", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.template.list({ city: "杭州" });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("template.cities", () => {
  it("returns list of cities", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.template.cities();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.openId).toBe("test-user-id");
    expect(result?.name).toBe("Test User");
  });
});
