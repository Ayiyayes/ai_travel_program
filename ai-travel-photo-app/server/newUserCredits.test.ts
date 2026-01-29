import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext, AuthenticatedUser } from "./_core/context";

// Mock database functions
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  hasUserCompletedOrder: vi.fn().mockResolvedValue(false),
  getTemplates: vi.fn().mockResolvedValue([]),
  getDistinctCities: vi.fn().mockResolvedValue([]),
  getTemplateById: vi.fn(),
}));

describe("New User Credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createNewUserContext(points: number = 10, hasUsedFreeCredits: boolean = false): TrpcContext {
    const user: AuthenticatedUser = {
      id: 1,
      openId: "new-user-id",
      email: "newuser@example.com",
      name: "New User",
      role: "user",
      points: points,
      initialFreeCredits: 10,
      hasUsedFreeCredits: hasUsedFreeCredits,
      channelId: null,
      salesId: null,
      promotionCodeId: null,
      gender: null,
      userType: null,
      faceType: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    return { user };
  }

  function createOldUserContext(): TrpcContext {
    const user: AuthenticatedUser = {
      id: 2,
      openId: "old-user-id",
      email: "olduser@example.com",
      name: "Old User",
      role: "user",
      points: 5,
      initialFreeCredits: 10,
      hasUsedFreeCredits: true, // 已消耗过赠送积分
      channelId: null,
      salesId: null,
      promotionCodeId: null,
      gender: null,
      userType: null,
      faceType: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    return { user };
  }

  describe("auth.me endpoint", () => {
    it("should return user with hasUsedFreeCredits=false for new user", async () => {
      const ctx = createNewUserContext(10, false);
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).not.toBeNull();
      expect(result?.points).toBe(10);
      expect(result?.hasUsedFreeCredits).toBe(false);
      expect(result?.initialFreeCredits).toBe(10);
    });

    it("should return user with hasUsedFreeCredits=true for old user", async () => {
      const ctx = createOldUserContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).not.toBeNull();
      expect(result?.hasUsedFreeCredits).toBe(true);
    });
  });

  describe("User identity check", () => {
    it("new user should have 10 initial free credits", () => {
      const ctx = createNewUserContext(10, false);
      expect(ctx.user?.initialFreeCredits).toBe(10);
      expect(ctx.user?.hasUsedFreeCredits).toBe(false);
    });

    it("old user should have hasUsedFreeCredits=true", () => {
      const ctx = createOldUserContext();
      expect(ctx.user?.hasUsedFreeCredits).toBe(true);
    });

    it("new user with 0 points but hasUsedFreeCredits=false is still new user", () => {
      // 用户可能还没消耗积分但积分为0（比如渠道配置0积分）
      const ctx = createNewUserContext(0, false);
      expect(ctx.user?.hasUsedFreeCredits).toBe(false);
    });
  });
});
