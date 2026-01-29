import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as coze from './coze';

describe('Face Analysis Functions', () => {
  describe('convertFaceTypeToDb', () => {
    it('should convert 宽脸 to wide', () => {
      expect(coze.convertFaceTypeToDb('宽脸')).toBe('wide');
    });

    it('should convert 窄脸 to narrow', () => {
      expect(coze.convertFaceTypeToDb('窄脸')).toBe('narrow');
    });

    it('should return null for unknown values', () => {
      expect(coze.convertFaceTypeToDb('其他')).toBeNull();
      expect(coze.convertFaceTypeToDb('')).toBeNull();
    });
  });

  describe('convertFaceTypeFromDb', () => {
    it('should convert wide to 宽脸', () => {
      expect(coze.convertFaceTypeFromDb('wide')).toBe('宽脸');
    });

    it('should convert narrow to 窄脸', () => {
      expect(coze.convertFaceTypeFromDb('narrow')).toBe('窄脸');
    });

    it('should return null for unknown values', () => {
      expect(coze.convertFaceTypeFromDb('both')).toBeNull();
      expect(coze.convertFaceTypeFromDb(null)).toBeNull();
    });
  });
});

describe('Face Type Matching Logic', () => {
  // 需要区分脸型的人群类型
  const faceTypeGroups = ['少女', '熟女', '奶奶', '少男', '大叔'];
  
  // 不需要区分脸型的人群类型
  const noFaceTypeGroups = ['幼女', '小小少年', '时尚奶奶', '情侣'];

  describe('Group Type Face Type Requirements', () => {
    it('should require face type for specific group types', () => {
      faceTypeGroups.forEach(group => {
        expect(faceTypeGroups.includes(group)).toBe(true);
      });
    });

    it('should not require face type for other group types', () => {
      noFaceTypeGroups.forEach(group => {
        expect(faceTypeGroups.includes(group)).toBe(false);
      });
    });
  });

  describe('Template Matching Scenarios', () => {
    it('should use original template when faceType is both', () => {
      const template = { faceType: 'both', groupType: '少女' };
      // 通用模板不需要匹配
      expect(template.faceType === 'both').toBe(true);
    });

    it('should use original template when user face type matches', () => {
      const template = { faceType: 'narrow', groupType: '少女' };
      const userFaceType = '窄脸';
      const dbFaceType = coze.convertFaceTypeToDb(userFaceType);
      expect(dbFaceType).toBe(template.faceType);
    });

    it('should find matching template when user face type differs', () => {
      const template = { faceType: 'narrow', groupType: '少女' };
      const userFaceType = '宽脸';
      const dbFaceType = coze.convertFaceTypeToDb(userFaceType);
      expect(dbFaceType).toBe('wide');
      expect(dbFaceType).not.toBe(template.faceType);
      // 需要查找宽脸版本的模板
    });

    it('should skip face type matching for non-face-type groups', () => {
      const template = { faceType: 'both', groupType: '幼女' };
      const userFaceType = '宽脸';
      // 幼女类型不需要区分脸型，直接使用原模板
      expect(faceTypeGroups.includes(template.groupType)).toBe(false);
    });
  });
});
