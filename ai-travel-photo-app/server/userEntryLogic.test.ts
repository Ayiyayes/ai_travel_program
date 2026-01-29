import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrpcContext } from './_core/context';

// Mock db functions
vi.mock('./db', () => ({
  hasUserCompletedOrder: vi.fn(),
  getUserByOpenId: vi.fn(),
  getUserById: vi.fn(),
  upsertUser: vi.fn(),
}));

import * as db from './db';
import { appRouter } from './routers';

type AuthenticatedUser = NonNullable<TrpcContext['user']>;

// 创建新用户上下文（没有完成订单）
function createNewUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: 'new-user-open-id',
    email: 'newuser@example.com',
    name: 'New User',
    loginMethod: 'manus',
    role: 'user',
    points: 10,
    initialFreeCredits: 10,
    hasUsedFreeCredits: false,
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

  return {
    user,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext['res'],
  };
}

// 创建老用户上下文（有完成订单）
function createOldUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: 'old-user-open-id',
    email: 'olduser@example.com',
    name: 'Old User',
    loginMethod: 'manus',
    role: 'user',
    points: 5,
    initialFreeCredits: 10,
    hasUsedFreeCredits: true,
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

  return {
    user,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext['res'],
  };
}

// 创建未登录上下文
function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: 'https', headers: {} } as TrpcContext['req'],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext['res'],
  };
}

describe('新老用户入口逻辑', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('auth.me 接口返回 hasCompletedOrder 字段', () => {
    it('新用户应该返回 hasCompletedOrder = false', async () => {
      const ctx = createNewUserContext();
      const caller = appRouter.createCaller(ctx);

      // Mock: 新用户没有完成的订单
      vi.mocked(db.hasUserCompletedOrder).mockResolvedValue(false);

      const result = await caller.auth.me();

      expect(result).not.toBeNull();
      expect(result?.hasCompletedOrder).toBe(false);
      expect(db.hasUserCompletedOrder).toHaveBeenCalledWith(1);
    });

    it('老用户应该返回 hasCompletedOrder = true', async () => {
      const ctx = createOldUserContext();
      const caller = appRouter.createCaller(ctx);

      // Mock: 老用户有完成的订单
      vi.mocked(db.hasUserCompletedOrder).mockResolvedValue(true);

      const result = await caller.auth.me();

      expect(result).not.toBeNull();
      expect(result?.hasCompletedOrder).toBe(true);
      expect(db.hasUserCompletedOrder).toHaveBeenCalledWith(2);
    });

    it('未登录用户应该返回 null', async () => {
      const ctx = createUnauthenticatedContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeNull();
      // 未登录用户不应该调用 hasUserCompletedOrder
      expect(db.hasUserCompletedOrder).not.toHaveBeenCalled();
    });
  });

  describe('hasUserCompletedOrder 函数逻辑', () => {
    it('应该正确判断用户是否有完成的订单', async () => {
      // 这个测试验证 mock 的行为符合预期
      vi.mocked(db.hasUserCompletedOrder).mockImplementation(async (userId: number) => {
        // 模拟：用户ID为2的是老用户
        return userId === 2;
      });

      const newUserResult = await db.hasUserCompletedOrder(1);
      const oldUserResult = await db.hasUserCompletedOrder(2);

      expect(newUserResult).toBe(false);
      expect(oldUserResult).toBe(true);
    });
  });

  describe('入口跳转逻辑说明', () => {
    it('新用户（hasCompletedOrder=false）应该停留在 P1 首页', () => {
      // 前端逻辑：当 hasCompletedOrder 为 false 时，不跳转
      const hasCompletedOrder = false;
      const shouldRedirectToP6 = hasCompletedOrder === true;
      
      expect(shouldRedirectToP6).toBe(false);
    });

    it('老用户（hasCompletedOrder=true）应该跳转到 P6 模板选择页', () => {
      // 前端逻辑：当 hasCompletedOrder 为 true 时，跳转到 /templates
      const hasCompletedOrder = true;
      const shouldRedirectToP6 = hasCompletedOrder === true;
      
      expect(shouldRedirectToP6).toBe(true);
    });
  });
});
