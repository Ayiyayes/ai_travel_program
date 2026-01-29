import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions
vi.mock('./db', () => ({
  getAllSystemConfigs: vi.fn().mockResolvedValue([
    { id: 1, configKey: 'TENCENT_MAP_API_KEY', configValue: 'test-key', description: 'Test' },
    { id: 2, configKey: 'COZE_API_KEY', configValue: 'sat_test', description: 'Test' },
  ]),
  getSystemConfig: vi.fn().mockImplementation((key: string) => {
    const configs: Record<string, string> = {
      'TENCENT_MAP_API_KEY': 'test-key',
      'COZE_API_KEY': 'sat_test',
    };
    return Promise.resolve(configs[key]);
  }),
  setSystemConfig: vi.fn().mockResolvedValue(undefined),
  deleteSystemConfig: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
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

describe("API Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("admin.systemConfigs", () => {
    it("should return all system configs for admin user", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.admin.systemConfigs();

      expect(result).toHaveLength(2);
      expect(result[0].configKey).toBe('TENCENT_MAP_API_KEY');
      expect(result[1].configKey).toBe('COZE_API_KEY');
    });
  });

  describe("admin.saveSystemConfig", () => {
    it("should save a system config", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.admin.saveSystemConfig({
        key: 'COZE_SINGLE_FACE_WORKFLOW_ID',
        value: '7578419604687552562',
        description: 'Single face swap workflow',
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("admin.testApiConnection", () => {
    it("should validate Coze API Key format - valid sat_ prefix", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      // Mock fetch for Coze API
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ code: 4000, msg: 'workflow not found' }),
      });

      const result = await caller.admin.testApiConnection({
        configKey: 'COZE_API_KEY',
        configValue: 'sat_validtoken123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('验证通过');
    });

    it("should reject invalid Coze API Key format", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.admin.testApiConnection({
        configKey: 'COZE_API_KEY',
        configValue: 'invalid_key',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('格式不正确');
    });

    it("should validate workflow ID format - valid numeric", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      // Mock fetch for Coze API
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ code: 4000, msg: 'parameter missing' }),
      });

      const result = await caller.admin.testApiConnection({
        configKey: 'COZE_SINGLE_FACE_WORKFLOW_ID',
        configValue: '7578419604687552562',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('验证通过');
    });

    it("should reject invalid workflow ID format", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.admin.testApiConnection({
        configKey: 'COZE_SINGLE_FACE_WORKFLOW_ID',
        configValue: 'not-a-number',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('格式不正确');
    });

    it("should reject empty config value", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.admin.testApiConnection({
        configKey: 'COZE_API_KEY',
        configValue: '',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('不能为空');
    });
  });
});
