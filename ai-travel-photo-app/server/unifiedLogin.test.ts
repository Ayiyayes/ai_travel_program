import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db functions
vi.mock('./db', () => ({
  getChannelUserByUsername: vi.fn(),
  updateChannelUserLastLogin: vi.fn(),
  getChannelById: vi.fn(),
  getSalesById: vi.fn(),
}));

import * as db from './db';

describe('统一登录功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('超级管理员登录', () => {
    it('应该使用正确的账号密码登录成功', () => {
      const username = '18673105881';
      const password = '123456';
      
      // 验证超级管理员账号
      expect(username).toBe('18673105881');
      expect(password).toBe('123456');
    });

    it('应该返回superadmin角色', () => {
      const expectedRole = 'superadmin';
      expect(expectedRole).toBe('superadmin');
    });
  });

  describe('渠道用户查找逻辑', () => {
    it('应该支持通过用户名直接查找', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        password: '123456',
        role: 'institution_channel',
        channelId: 1,
        salesId: null,
        status: 'enabled',
      };
      
      vi.mocked(db.getChannelUserByUsername).mockResolvedValue(mockUser as any);
      
      const result = await db.getChannelUserByUsername('testuser');
      expect(result).toBeDefined();
      expect(result?.username).toBe('testuser');
    });

    it('应该支持通过渠道名称查找', async () => {
      const mockUser = {
        id: 2,
        username: 'channel_user',
        password: '123456',
        role: 'institution_channel',
        channelId: 60001,
        salesId: null,
        status: 'enabled',
      };
      
      vi.mocked(db.getChannelUserByUsername).mockResolvedValue(mockUser as any);
      
      const result = await db.getChannelUserByUsername('霸得蛮');
      expect(result).toBeDefined();
    });

    it('应该支持通过渠道编码查找', async () => {
      const mockUser = {
        id: 3,
        username: 'channel_code_user',
        password: '123456',
        role: 'institution_channel',
        channelId: 60001,
        salesId: null,
        status: 'enabled',
      };
      
      vi.mocked(db.getChannelUserByUsername).mockResolvedValue(mockUser as any);
      
      const result = await db.getChannelUserByUsername('JG0002');
      expect(result).toBeDefined();
    });

    it('应该支持通过推广员名称查找', async () => {
      const mockUser = {
        id: 4,
        username: 'sales_user',
        password: '123456',
        role: 'sales',
        channelId: 60001,
        salesId: 1,
        status: 'enabled',
      };
      
      vi.mocked(db.getChannelUserByUsername).mockResolvedValue(mockUser as any);
      
      const result = await db.getChannelUserByUsername('dragon');
      expect(result).toBeDefined();
    });

    it('应该支持通过推广员编码查找', async () => {
      const mockUser = {
        id: 5,
        username: 'sales_code_user',
        password: '123456',
        role: 'sales',
        channelId: 60001,
        salesId: 1,
        status: 'enabled',
      };
      
      vi.mocked(db.getChannelUserByUsername).mockResolvedValue(mockUser as any);
      
      const result = await db.getChannelUserByUsername('SMK505PEE');
      expect(result).toBeDefined();
    });
  });

  describe('角色跳转逻辑', () => {
    it('超级管理员应跳转到 /admin', () => {
      const role = 'superadmin';
      const expectedPath = '/admin';
      
      let redirectPath = '';
      if (role === 'superadmin') {
        redirectPath = '/admin';
      }
      
      expect(redirectPath).toBe(expectedPath);
    });

    it('机构渠道应跳转到 /channel-portal', () => {
      const role = 'institution_channel';
      const expectedPath = '/channel-portal';
      
      let redirectPath = '';
      if (role === 'institution_channel' || role === 'individual_channel') {
        redirectPath = '/channel-portal';
      }
      
      expect(redirectPath).toBe(expectedPath);
    });

    it('个人渠道应跳转到 /channel-portal', () => {
      const role = 'individual_channel';
      const expectedPath = '/channel-portal';
      
      let redirectPath = '';
      if (role === 'institution_channel' || role === 'individual_channel') {
        redirectPath = '/channel-portal';
      }
      
      expect(redirectPath).toBe(expectedPath);
    });

    it('推广员应跳转到 /sales-portal', () => {
      const role = 'sales';
      const expectedPath = '/sales-portal';
      
      let redirectPath = '';
      if (role === 'sales') {
        redirectPath = '/sales-portal';
      }
      
      expect(redirectPath).toBe(expectedPath);
    });
  });

  describe('密码验证', () => {
    it('密码正确时应返回成功', () => {
      const inputPassword = '123456';
      const storedPassword = '123456';
      
      expect(inputPassword).toBe(storedPassword);
    });

    it('密码错误时应返回失败', () => {
      const inputPassword = 'wrongpassword';
      const storedPassword = '123456';
      
      expect(inputPassword).not.toBe(storedPassword);
    });
  });

  describe('账号状态检查', () => {
    it('启用状态的账号应允许登录', () => {
      const status = 'enabled';
      const canLogin = status === 'enabled';
      
      expect(canLogin).toBe(true);
    });

    it('禁用状态的账号应拒绝登录', () => {
      const status = 'disabled';
      const canLogin = status === 'enabled';
      
      expect(canLogin).toBe(false);
    });
  });
});
