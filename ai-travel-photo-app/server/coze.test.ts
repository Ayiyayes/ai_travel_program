import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// Mock axios for unit tests
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Import after mocking
import { faceSwapSingle, faceSwapCouple, parseFaceSwapResult } from './coze';

describe('Coze API Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('faceSwapSingle (同步模式)', () => {
    it('should return executeId and resultUrls on success', async () => {
      const mockResponse = {
        data: {
          code: 0,
          msg: '',
          execute_id: '7593559000290557952',
          data: JSON.stringify({
            output: ['https://example.com/result.png']
          })
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await faceSwapSingle({
        userImageUrl: 'https://example.com/user.jpg',
        templateImageUrls: ['https://example.com/template.jpg']
      });

      expect(result.executeId).toBe('7593559000290557952');
      expect(result.resultUrls).toEqual(['https://example.com/result.png']);
    });

    it('should handle empty output', async () => {
      const mockResponse = {
        data: {
          code: 0,
          msg: '',
          execute_id: '7593559000290557952',
          data: JSON.stringify({
            output: ['']
          })
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await faceSwapSingle({
        userImageUrl: 'https://example.com/user.jpg',
        templateImageUrls: ['https://example.com/template.jpg']
      });

      expect(result.executeId).toBe('7593559000290557952');
      expect(result.resultUrls).toEqual(['']);
    });

    it('should throw error on API failure', async () => {
      const mockResponse = {
        data: {
          code: 1,
          msg: 'API Error',
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await expect(faceSwapSingle({
        userImageUrl: 'https://example.com/user.jpg',
        templateImageUrls: ['https://example.com/template.jpg']
      })).rejects.toThrow('API Error');
    });

    it('should call API with correct parameters', async () => {
      const mockResponse = {
        data: {
          code: 0,
          msg: '',
          execute_id: '123',
          data: JSON.stringify({ output: ['url'] })
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await faceSwapSingle({
        userImageUrl: 'https://example.com/user.jpg',
        templateImageUrls: ['https://example.com/template.jpg']
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/workflow/run'),
        expect.objectContaining({
          workflow_id: '7578419604687552562',
          parameters: {
            image: 'https://example.com/user.jpg',
            template_image_url: 'https://example.com/template.jpg' // 修复：应该是字符串，不是数组
          }
        }),
        expect.any(Object)
      );
    });
  });

  describe('faceSwapCouple (同步模式)', () => {
    it('should return executeId and resultUrls on success', async () => {
      const mockResponse = {
        data: {
          code: 0,
          msg: '',
          execute_id: '7593558207647645734',
          data: JSON.stringify({
            output: ['https://example.com/couple-result.png']
          })
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await faceSwapCouple({
        user1ImageUrl: 'https://example.com/user1.jpg',
        user2ImageUrl: 'https://example.com/user2.jpg',
        templateImageUrls: ['https://example.com/template.jpg']
      });

      expect(result.executeId).toBe('7593558207647645734');
      expect(result.resultUrls).toEqual(['https://example.com/couple-result.png']);
    });

    it('should call API with correct parameters for couple face swap', async () => {
      const mockResponse = {
        data: {
          code: 0,
          msg: '',
          execute_id: '123',
          data: JSON.stringify({ output: ['url'] })
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      await faceSwapCouple({
        user1ImageUrl: 'https://example.com/user1.jpg',
        user2ImageUrl: 'https://example.com/user2.jpg',
        templateImageUrls: ['https://example.com/template.jpg']
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/workflow/run'),
        expect.objectContaining({
          workflow_id: '7574050703116075050',
          parameters: {
            image1: 'https://example.com/user1.jpg',
            image2: 'https://example.com/user2.jpg',
            template_image_url: 'https://example.com/template.jpg' // 修复：应该是字符串，不是数组
          }
        }),
        expect.any(Object)
      );
    });

    it('should handle multiple result URLs', async () => {
      const mockResponse = {
        data: {
          code: 0,
          msg: '',
          execute_id: '123',
          data: JSON.stringify({
            output: [
              'https://example.com/result1.png',
              'https://example.com/result2.png'
            ]
          })
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await faceSwapCouple({
        user1ImageUrl: 'https://example.com/user1.jpg',
        user2ImageUrl: 'https://example.com/user2.jpg',
        templateImageUrls: ['https://example.com/template.jpg']
      });

      expect(result.resultUrls).toHaveLength(2);
    });
  });

  describe('parseFaceSwapResult', () => {
    it('should parse successful result', () => {
      const output = {
        output: ['https://example.com/result1.png', 'https://example.com/result2.png']
      };

      const result = parseFaceSwapResult(output);

      expect(result.success).toBe(true);
      expect(result.resultUrls).toEqual(['https://example.com/result1.png', 'https://example.com/result2.png']);
    });

    it('should handle empty output array', () => {
      const output = {
        output: []
      };

      const result = parseFaceSwapResult(output);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('未生成换脸图片');
    });

    it('should handle null output', () => {
      const result = parseFaceSwapResult(null);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('无输出结果');
    });

    it('should handle missing output field', () => {
      const output = {};

      const result = parseFaceSwapResult(output);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('未生成换脸图片');
    });

    it('should handle undefined output', () => {
      const result = parseFaceSwapResult(undefined);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('无输出结果');
    });
  });
});

// 集成测试单独文件运行，避免 mock 冲突
// 运行集成测试: pnpm test coze.integration.test.ts
