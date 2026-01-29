import { describe, it, expect } from 'vitest';

// 复制前端的解析函数进行测试
function parseTemplateFilename(filename: string): {
  templateId: string;
  templateGroupId: string;
  groupType: string;
  faceType: 'wide' | 'narrow' | 'both';
  isValid: boolean;
} {
  // 移除扩展名
  const basename = filename.replace(/\.[^.]+$/, '');
  
  // 尝试匹配带脸型后缀的格式：groupType_randomCode_n 或 groupType_randomCode_w
  const withFaceTypeMatch = basename.match(/^([a-z]+)_([a-zA-Z0-9]{5})_(n|w)$/i);
  if (withFaceTypeMatch) {
    const [, groupType, randomCode, faceTypeSuffix] = withFaceTypeMatch;
    const templateGroupId = `${groupType}_${randomCode}`.toLowerCase();
    
    return {
      templateId: basename.toLowerCase(),
      templateGroupId,
      groupType: groupType.toLowerCase(),
      faceType: faceTypeSuffix.toLowerCase() === 'n' ? 'narrow' : 'wide',
      isValid: true,
    };
  }
  
  // 尝试匹配不带脸型后缀的格式：groupType_randomCode
  const withoutFaceTypeMatch = basename.match(/^([a-z]+)_([a-zA-Z0-9]{5})$/i);
  if (withoutFaceTypeMatch) {
    const [, groupType, randomCode] = withoutFaceTypeMatch;
    const templateGroupId = `${groupType}_${randomCode}`.toLowerCase();
    
    return {
      templateId: basename.toLowerCase(),
      templateGroupId,
      groupType: groupType.toLowerCase(),
      faceType: 'both',
      isValid: true,
    };
  }
  
  // 无法解析，使用文件名作为默认值
  return {
    templateId: basename,
    templateGroupId: basename,
    groupType: '',
    faceType: 'both',
    isValid: false,
  };
}

describe('模板文件名解析', () => {
  describe('带脸型后缀的文件名', () => {
    it('应正确解析窄脸模板文件名', () => {
      const result = parseTemplateFilename('shaonv_hhhh5_n.jpg');
      
      expect(result.isValid).toBe(true);
      expect(result.templateId).toBe('shaonv_hhhh5_n');
      expect(result.templateGroupId).toBe('shaonv_hhhh5');
      expect(result.groupType).toBe('shaonv');
      expect(result.faceType).toBe('narrow');
    });
    
    it('应正确解析宽脸模板文件名', () => {
      const result = parseTemplateFilename('shaonv_hhhh5_w.jpg');
      
      expect(result.isValid).toBe(true);
      expect(result.templateId).toBe('shaonv_hhhh5_w');
      expect(result.templateGroupId).toBe('shaonv_hhhh5');
      expect(result.groupType).toBe('shaonv');
      expect(result.faceType).toBe('wide');
    });
    
    it('宽脸和窄脸模板应有相同的templateGroupId', () => {
      const narrow = parseTemplateFilename('shunv_abc12_n.png');
      const wide = parseTemplateFilename('shunv_abc12_w.png');
      
      expect(narrow.templateGroupId).toBe(wide.templateGroupId);
      expect(narrow.templateGroupId).toBe('shunv_abc12');
    });
    
    it('应支持大写字母的文件名', () => {
      const result = parseTemplateFilename('SHAONV_HHHH5_N.jpg');
      
      expect(result.isValid).toBe(true);
      expect(result.templateId).toBe('shaonv_hhhh5_n');
      expect(result.templateGroupId).toBe('shaonv_hhhh5');
      expect(result.faceType).toBe('narrow');
    });
    
    it('应支持混合大小写的文件名', () => {
      const result = parseTemplateFilename('ShaoNv_HhHh5_W.jpg');
      
      expect(result.isValid).toBe(true);
      expect(result.templateId).toBe('shaonv_hhhh5_w');
      expect(result.faceType).toBe('wide');
    });
  });
  
  describe('不带脸型后缀的文件名（通用模板）', () => {
    it('应正确解析通用模板文件名', () => {
      const result = parseTemplateFilename('younv_abc12.jpg');
      
      expect(result.isValid).toBe(true);
      expect(result.templateId).toBe('younv_abc12');
      expect(result.templateGroupId).toBe('younv_abc12');
      expect(result.groupType).toBe('younv');
      expect(result.faceType).toBe('both');
    });
    
    it('应支持数字和字母混合的编码', () => {
      const result = parseTemplateFilename('nainai_xy789.png');
      
      expect(result.isValid).toBe(true);
      expect(result.templateId).toBe('nainai_xy789');
      expect(result.groupType).toBe('nainai');
    });
  });
  
  describe('无效的文件名格式', () => {
    it('编码不足5位应返回无效', () => {
      const result = parseTemplateFilename('shaonv_abc_n.jpg');
      
      expect(result.isValid).toBe(false);
    });
    
    it('编码超过5位应返回无效', () => {
      const result = parseTemplateFilename('shaonv_abcdef_n.jpg');
      
      expect(result.isValid).toBe(false);
    });
    
    it('缺少人群类型应返回无效', () => {
      const result = parseTemplateFilename('_abc12_n.jpg');
      
      expect(result.isValid).toBe(false);
    });
    
    it('普通文件名应返回无效', () => {
      const result = parseTemplateFilename('my_beautiful_photo.jpg');
      
      expect(result.isValid).toBe(false);
      expect(result.templateId).toBe('my_beautiful_photo');
      expect(result.faceType).toBe('both');
    });
    
    it('无扩展名的文件应正常解析', () => {
      const result = parseTemplateFilename('shaonv_hhhh5_n');
      
      expect(result.isValid).toBe(true);
      expect(result.templateId).toBe('shaonv_hhhh5_n');
    });
  });
  
  describe('各人群类型测试', () => {
    const testCases = [
      { filename: 'shaonv_test1_n.jpg', groupType: 'shaonv', desc: '少女' },
      { filename: 'shunv_test2_w.jpg', groupType: 'shunv', desc: '熟女' },
      { filename: 'nainai_test3_n.jpg', groupType: 'nainai', desc: '奶奶' },
      { filename: 'shaonan_test4_w.jpg', groupType: 'shaonan', desc: '少男' },
      { filename: 'dashu_test5_n.jpg', groupType: 'dashu', desc: '大叔' },
      { filename: 'younv_test6.jpg', groupType: 'younv', desc: '幼女（通用）' },
      { filename: 'xiaoxiaoshaonan_a1b2c.jpg', groupType: 'xiaoxiaoshaonan', desc: '小小少年（通用）' },
    ];
    
    testCases.forEach(({ filename, groupType, desc }) => {
      it(`应正确解析${desc}模板`, () => {
        const result = parseTemplateFilename(filename);
        expect(result.groupType).toBe(groupType);
      });
    });
  });
});
