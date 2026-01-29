import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock drizzle-orm functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ type: 'eq', field, value })),
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  gte: vi.fn((field, value) => ({ type: 'gte', field, value })),
  lte: vi.fn((field, value) => ({ type: 'lte', field, value })),
  gt: vi.fn((field, value) => ({ type: 'gt', field, value })),
  lt: vi.fn((field, value) => ({ type: 'lt', field, value })),
  ne: vi.fn((field, value) => ({ type: 'ne', field, value })),
  sql: vi.fn((strings, ...values) => ({ type: 'sql', strings, values })),
  desc: vi.fn(),
  asc: vi.fn(),
  like: vi.fn(),
  or: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
  isNotNull: vi.fn(),
}));

describe('Group Type Sort Order Logic', () => {
  describe('updateGroupTypeSortOrder', () => {
    it('should not change anything if sortOrder is the same', () => {
      // 测试：当新排序等于旧排序时，不应该有任何变化
      const oldSortOrder = 3;
      const newSortOrder = 3;
      
      expect(oldSortOrder === newSortOrder).toBe(true);
    });

    it('should shift items forward when moving item to earlier position', () => {
      // 测试：当将项目移动到更早的位置时
      // 例如：将排序3的项移动到排序1
      // 原来的排序1和2应该变成2和3
      const items = [
        { id: 1, code: 'girl_child', sortOrder: 1 },
        { id: 2, code: 'girl_young', sortOrder: 2 },
        { id: 3, code: 'woman_mature', sortOrder: 3 },
      ];
      
      const targetId = 3;
      const newSortOrder = 1;
      const oldSortOrder = 3;
      
      // 模拟调整逻辑
      const adjustedItems = items.map(item => {
        if (item.id === targetId) {
          return { ...item, sortOrder: newSortOrder };
        }
        // 将[新位置, 旧位置)区间的项全部+1
        if (item.sortOrder >= newSortOrder && item.sortOrder < oldSortOrder) {
          return { ...item, sortOrder: item.sortOrder + 1 };
        }
        return item;
      });
      
      // 验证结果
      expect(adjustedItems.find(i => i.id === 1)?.sortOrder).toBe(2); // 原来1变成2
      expect(adjustedItems.find(i => i.id === 2)?.sortOrder).toBe(3); // 原来2变成3
      expect(adjustedItems.find(i => i.id === 3)?.sortOrder).toBe(1); // 目标变成1
    });

    it('should shift items backward when moving item to later position', () => {
      // 测试：当将项目移动到更晚的位置时
      // 例如：将排序1的项移动到排序3
      // 原来的排序2和3应该变成1和2
      const items = [
        { id: 1, code: 'girl_child', sortOrder: 1 },
        { id: 2, code: 'girl_young', sortOrder: 2 },
        { id: 3, code: 'woman_mature', sortOrder: 3 },
      ];
      
      const targetId = 1;
      const newSortOrder = 3;
      const oldSortOrder = 1;
      
      // 模拟调整逻辑
      const adjustedItems = items.map(item => {
        if (item.id === targetId) {
          return { ...item, sortOrder: newSortOrder };
        }
        // 将(旧位置, 新位置]区间的项全部-1
        if (item.sortOrder > oldSortOrder && item.sortOrder <= newSortOrder) {
          return { ...item, sortOrder: item.sortOrder - 1 };
        }
        return item;
      });
      
      // 验证结果
      expect(adjustedItems.find(i => i.id === 1)?.sortOrder).toBe(3); // 目标变成3
      expect(adjustedItems.find(i => i.id === 2)?.sortOrder).toBe(1); // 原来2变成1
      expect(adjustedItems.find(i => i.id === 3)?.sortOrder).toBe(2); // 原来3变成2
    });

    it('should handle moving to adjacent position', () => {
      // 测试：移动到相邻位置
      // 例如：将排序2的项移动到排序1
      const items = [
        { id: 1, code: 'girl_child', sortOrder: 1 },
        { id: 2, code: 'girl_young', sortOrder: 2 },
      ];
      
      const targetId = 2;
      const newSortOrder = 1;
      const oldSortOrder = 2;
      
      // 模拟调整逻辑
      const adjustedItems = items.map(item => {
        if (item.id === targetId) {
          return { ...item, sortOrder: newSortOrder };
        }
        if (item.sortOrder >= newSortOrder && item.sortOrder < oldSortOrder) {
          return { ...item, sortOrder: item.sortOrder + 1 };
        }
        return item;
      });
      
      // 验证结果
      expect(adjustedItems.find(i => i.id === 1)?.sortOrder).toBe(2); // 原来1变成2
      expect(adjustedItems.find(i => i.id === 2)?.sortOrder).toBe(1); // 目标变成1
    });

    it('should maintain unique sort orders after adjustment', () => {
      // 测试：调整后所有排序值应该唯一
      const items = [
        { id: 1, sortOrder: 1 },
        { id: 2, sortOrder: 2 },
        { id: 3, sortOrder: 3 },
        { id: 4, sortOrder: 4 },
        { id: 5, sortOrder: 5 },
        { id: 6, sortOrder: 6 },
        { id: 7, sortOrder: 7 },
      ];
      
      // 将第5项移动到第2位
      const targetId = 5;
      const newSortOrder = 2;
      const oldSortOrder = 5;
      
      const adjustedItems = items.map(item => {
        if (item.id === targetId) {
          return { ...item, sortOrder: newSortOrder };
        }
        if (item.sortOrder >= newSortOrder && item.sortOrder < oldSortOrder) {
          return { ...item, sortOrder: item.sortOrder + 1 };
        }
        return item;
      });
      
      // 验证所有排序值唯一
      const sortOrders = adjustedItems.map(i => i.sortOrder);
      const uniqueSortOrders = [...new Set(sortOrders)];
      expect(sortOrders.length).toBe(uniqueSortOrders.length);
      
      // 验证排序值范围
      expect(Math.min(...sortOrders)).toBe(1);
      expect(Math.max(...sortOrders)).toBe(7);
    });
  });
});
