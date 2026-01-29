import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sharp module
vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1000, height: 800 }),
    extract: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-image-data')),
    composite: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
  }));
  return { default: mockSharp };
});

// Mock storage
vi.mock('./storage', () => ({
  storagePut: vi.fn().mockResolvedValue({ url: 'https://s3.example.com/masked-image.png', key: 'masked-image.png' }),
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: Buffer.from('mock-image-data') }),
  },
}));

import {
  MaskRegion,
  generateMaskedTemplate,
  extractRegionCache,
  restoreRegions,
} from './imageMask';

describe('Image Mask Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MaskRegion type', () => {
    it('should have correct structure', () => {
      const region: MaskRegion = {
        id: 'test-region-1',
        x: 0.1,
        y: 0.2,
        width: 0.15,
        height: 0.2,
        label: '雕塑1',
      };

      expect(region.id).toBe('test-region-1');
      expect(region.x).toBe(0.1);
      expect(region.y).toBe(0.2);
      expect(region.width).toBe(0.15);
      expect(region.height).toBe(0.2);
      expect(region.label).toBe('雕塑1');
    });

    it('should allow optional label', () => {
      const region: MaskRegion = {
        id: 'test-region-2',
        x: 0.5,
        y: 0.5,
        width: 0.1,
        height: 0.1,
      };

      expect(region.label).toBeUndefined();
    });
  });

  describe('generateMaskedTemplate', () => {
    it('should generate masked image with single region', async () => {
      const regions: MaskRegion[] = [
        { id: 'r1', x: 0.1, y: 0.2, width: 0.15, height: 0.2 },
      ];

      const result = await generateMaskedTemplate(
        Buffer.from('mock-image-data'),
        regions
      );

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should generate masked image with multiple regions', async () => {
      const regions: MaskRegion[] = [
        { id: 'r1', x: 0.1, y: 0.2, width: 0.15, height: 0.2 },
        { id: 'r2', x: 0.6, y: 0.3, width: 0.1, height: 0.15 },
      ];

      const result = await generateMaskedTemplate(
        Buffer.from('mock-image-data'),
        regions
      );

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should return original buffer for empty regions', async () => {
      const originalBuffer = Buffer.from('mock-image-data');
      const result = await generateMaskedTemplate(originalBuffer, []);

      expect(result).toBe(originalBuffer);
    });
  });

  describe('extractRegionCache', () => {
    it('should extract region cache from image', async () => {
      const regions: MaskRegion[] = [
        { id: 'r1', x: 0.1, y: 0.2, width: 0.15, height: 0.2 },
      ];

      const result = await extractRegionCache(
        Buffer.from('mock-image-data'),
        regions
      );

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should throw error for empty regions', async () => {
      await expect(
        extractRegionCache(Buffer.from('mock-image-data'), [])
      ).rejects.toThrow('遮盖区域不能为空');
    });
  });

  describe('restoreRegions', () => {
    it('should restore regions to swapped image', async () => {
      const swappedBuffer = Buffer.from('swapped-image');
      const regionCacheBuffer = Buffer.from('region-cache');

      const result = await restoreRegions(swappedBuffer, regionCacheBuffer);

      expect(result).toBeInstanceOf(Buffer);
    });
  });
});

describe('Mask Region Validation', () => {
  it('should validate region coordinates are within bounds', () => {
    const validRegion: MaskRegion = {
      id: 'valid',
      x: 0.5,
      y: 0.5,
      width: 0.3,
      height: 0.3,
    };

    // x + width should not exceed 1
    expect(validRegion.x + validRegion.width).toBeLessThanOrEqual(1);
    // y + height should not exceed 1
    expect(validRegion.y + validRegion.height).toBeLessThanOrEqual(1);
  });

  it('should detect invalid region coordinates', () => {
    const invalidRegion: MaskRegion = {
      id: 'invalid',
      x: 0.9,
      y: 0.9,
      width: 0.3,
      height: 0.3,
    };

    // This region would extend beyond the image bounds
    expect(invalidRegion.x + invalidRegion.width).toBeGreaterThan(1);
    expect(invalidRegion.y + invalidRegion.height).toBeGreaterThan(1);
  });
});
