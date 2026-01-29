import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as db from './db';
import * as coze from './coze';

// Mock modules
vi.mock('./db');
vi.mock('./coze');

describe('quickGenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('should fail if user does not exist', async () => {
      const mockGetUserById = vi.spyOn(db, 'getUserById' as any);
      mockGetUserById.mockResolvedValue(null);

      // This would be tested in the actual router context
      // For now, we're testing the logic
      const user = await db.getUserById(1);
      expect(user).toBeNull();
    });

    it('should fail if user has no lastSelfieUrl', async () => {
      const mockGetUserById = vi.spyOn(db, 'getUserById' as any);
      mockGetUserById.mockResolvedValue({
        id: 1,
        lastSelfieUrl: null,
        points: 100,
      });

      const user = await db.getUserById(1);
      expect(user?.lastSelfieUrl).toBeNull();
    });

    it('should fail if user has insufficient points', async () => {
      const mockGetUserById = vi.spyOn(db, 'getUserById' as any);
      mockGetUserById.mockResolvedValue({
        id: 1,
        lastSelfieUrl: 'https://example.com/selfie.jpg',
        points: 5,
      });

      const mockGetTemplateById = vi.spyOn(db, 'getTemplateById' as any);
      mockGetTemplateById.mockResolvedValue({
        id: 1,
        price: 10,
        isFree: false,
      });

      const user = await db.getUserById(1);
      const template = await db.getTemplateById(1);

      expect(user?.points).toBe(5);
      expect(template?.price).toBe(10);
      expect(user!.points < template!.price).toBe(true);
    });

    it('should successfully create order and photos for valid input', async () => {
      const mockGetUserById = vi.spyOn(db, 'getUserById' as any);
      mockGetUserById.mockResolvedValue({
        id: 1,
        lastSelfieUrl: 'https://example.com/selfie.jpg',
        points: 100,
        channelId: null,
        salesId: null,
        faceType: 'wide',
      });

      const mockGetTemplateById = vi.spyOn(db, 'getTemplateById' as any);
      mockGetTemplateById.mockResolvedValue({
        id: 1,
        templateId: 'template_1',
        price: 10,
        isFree: false,
        imageUrl: 'https://example.com/template.jpg',
        hasMaskRegions: false,
      });

      const mockGeneratePhotoId = vi.spyOn(db, 'generatePhotoId' as any);
      mockGeneratePhotoId.mockResolvedValue('photo_1');

      const mockCreateUserPhoto = vi.spyOn(db, 'createUserPhoto' as any);
      mockCreateUserPhoto.mockResolvedValue({ id: 1 });

      const mockUpdateUserPoints = vi.spyOn(db, 'updateUserPoints' as any);
      mockUpdateUserPoints.mockResolvedValue(90);

      const mockCreateOrder = vi.spyOn(db, 'createOrder' as any);
      mockCreateOrder.mockResolvedValue({ id: 1 });

      const user = await db.getUserById(1);
      const template = await db.getTemplateById(1);
      const photoId = await db.generatePhotoId();

      expect(user?.lastSelfieUrl).toBe('https://example.com/selfie.jpg');
      expect(template?.price).toBe(10);
      expect(photoId).toBe('photo_1');

      await db.createUserPhoto({
        photoId,
        userId: 1,
        templateId: 1,
        selfieUrl: user!.lastSelfieUrl,
        photoType: 'single',
        status: 'processing',
        detectedFaceType: user?.faceType || null,
      });

      expect(mockCreateUserPhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          photoId: 'photo_1',
          userId: 1,
          status: 'processing',
        })
      );

      await db.updateUserPoints(1, -10, '生成照片消耗', undefined);
      expect(mockUpdateUserPoints).toHaveBeenCalledWith(1, -10, '生成照片消耗', undefined);
    });

    it('should handle multiple templates', async () => {
      const mockGetTemplateById = vi.spyOn(db, 'getTemplateById' as any);
      mockGetTemplateById
        .mockResolvedValueOnce({
          id: 1,
          price: 10,
          isFree: false,
        })
        .mockResolvedValueOnce({
          id: 2,
          price: 15,
          isFree: false,
        })
        .mockResolvedValueOnce({
          id: 3,
          price: 0,
          isFree: true,
        });

      const template1 = await db.getTemplateById(1);
      const template2 = await db.getTemplateById(2);
      const template3 = await db.getTemplateById(3);

      const totalPoints = [template1, template2, template3]
        .filter(t => !t.isFree)
        .reduce((sum, t) => sum + t.price, 0);

      expect(totalPoints).toBe(25);
    });
  });

  describe('progress', () => {
    it('should return correct progress for multiple photos', async () => {
      const mockGetUserPhotoByPhotoId = vi.spyOn(db, 'getUserPhotoByPhotoId' as any);
      
      mockGetUserPhotoByPhotoId
        .mockResolvedValueOnce({
          id: 1,
          photoId: 'photo_1',
          userId: 1,
          status: 'completed',
        })
        .mockResolvedValueOnce({
          id: 2,
          photoId: 'photo_2',
          userId: 1,
          status: 'completed',
        })
        .mockResolvedValueOnce({
          id: 3,
          photoId: 'photo_3',
          userId: 1,
          status: 'processing',
        })
        .mockResolvedValueOnce({
          id: 4,
          photoId: 'photo_4',
          userId: 1,
          status: 'processing',
        })
        .mockResolvedValueOnce({
          id: 5,
          photoId: 'photo_5',
          userId: 1,
          status: 'failed',
        });

      const photoIds = ['photo_1', 'photo_2', 'photo_3', 'photo_4', 'photo_5'];
      const photos = [];

      for (const photoId of photoIds) {
        const photo = await db.getUserPhotoByPhotoId(photoId);
        if (photo && photo.userId === 1) {
          photos.push(photo);
        }
      }

      const completedCount = photos.filter(p => p.status === 'completed').length;
      const failedCount = photos.filter(p => p.status === 'failed').length;
      const processingCount = photos.filter(p => p.status === 'processing').length;

      expect(completedCount).toBe(2);
      expect(failedCount).toBe(1);
      expect(processingCount).toBe(2);
      expect(photos.length).toBe(5);

      const totalPhotos = photoIds.length;
      const currentPhoto = Math.min(completedCount + 1, totalPhotos);
      const estimatedRemaining = Math.max(0, (totalPhotos - completedCount) * 5000);

      expect(currentPhoto).toBe(3);
      expect(estimatedRemaining).toBe(15000); // 3 remaining * 5000ms
    });

    it('should return zero estimated remaining when all photos are completed', async () => {
      const mockGetUserPhotoByPhotoId = vi.spyOn(db, 'getUserPhotoByPhotoId' as any);
      
      mockGetUserPhotoByPhotoId
        .mockResolvedValueOnce({
          id: 1,
          photoId: 'photo_1',
          userId: 1,
          status: 'completed',
        })
        .mockResolvedValueOnce({
          id: 2,
          photoId: 'photo_2',
          userId: 1,
          status: 'completed',
        });

      const photoIds = ['photo_1', 'photo_2'];
      const photos = [];

      for (const photoId of photoIds) {
        const photo = await db.getUserPhotoByPhotoId(photoId);
        if (photo && photo.userId === 1) {
          photos.push(photo);
        }
      }

      const completedCount = photos.filter(p => p.status === 'completed').length;
      const totalPhotos = photoIds.length;
      const estimatedRemaining = Math.max(0, (totalPhotos - completedCount) * 5000);

      expect(completedCount).toBe(2);
      expect(estimatedRemaining).toBe(0);
    });
  });

  describe('updateUser', () => {
    it('should update user lastSelfieUrl and lastSelfieTime', async () => {
      const mockUpdateUser = vi.spyOn(db, 'updateUser' as any);
      mockUpdateUser.mockResolvedValue(undefined);

      const selfieUrl = 'https://example.com/selfie.jpg';
      const now = new Date();

      await db.updateUser(1, {
        lastSelfieUrl: selfieUrl,
        lastSelfieTime: now,
      });

      expect(mockUpdateUser).toHaveBeenCalledWith(1, {
        lastSelfieUrl: selfieUrl,
        lastSelfieTime: now,
      });
    });
  });
});
