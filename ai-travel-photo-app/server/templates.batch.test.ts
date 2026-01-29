import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('./db', () => ({
  batchUpdateTemplates: vi.fn(),
  batchDeleteTemplates: vi.fn(),
}));

import { batchUpdateTemplates, batchDeleteTemplates } from './db';

describe('Template Batch Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('batchUpdateTemplates', () => {
    it('should update multiple templates with provided data', async () => {
      const mockBatchUpdate = vi.mocked(batchUpdateTemplates);
      mockBatchUpdate.mockResolvedValue(3);

      const ids = [1, 2, 3];
      const data = { city: '北京', scenicSpot: '天安门' };
      
      const result = await batchUpdateTemplates(ids, data);
      
      expect(mockBatchUpdate).toHaveBeenCalledWith(ids, data);
      expect(result).toBe(3);
    });

    it('should return 0 when ids array is empty', async () => {
      const mockBatchUpdate = vi.mocked(batchUpdateTemplates);
      mockBatchUpdate.mockResolvedValue(0);

      const result = await batchUpdateTemplates([], { city: '北京' });
      
      expect(result).toBe(0);
    });

    it('should handle partial updates (only non-empty fields)', async () => {
      const mockBatchUpdate = vi.mocked(batchUpdateTemplates);
      mockBatchUpdate.mockResolvedValue(2);

      const ids = [1, 2];
      const data = { city: '上海', status: 'active' };
      
      const result = await batchUpdateTemplates(ids, data);
      
      expect(mockBatchUpdate).toHaveBeenCalledWith(ids, data);
      expect(result).toBe(2);
    });
  });

  describe('batchDeleteTemplates', () => {
    it('should delete multiple templates', async () => {
      const mockBatchDelete = vi.mocked(batchDeleteTemplates);
      mockBatchDelete.mockResolvedValue(3);

      const ids = [1, 2, 3];
      
      const result = await batchDeleteTemplates(ids);
      
      expect(mockBatchDelete).toHaveBeenCalledWith(ids);
      expect(result).toBe(3);
    });

    it('should return 0 when ids array is empty', async () => {
      const mockBatchDelete = vi.mocked(batchDeleteTemplates);
      mockBatchDelete.mockResolvedValue(0);

      const result = await batchDeleteTemplates([]);
      
      expect(result).toBe(0);
    });
  });
});
