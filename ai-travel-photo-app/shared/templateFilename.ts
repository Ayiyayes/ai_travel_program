/**
 * 模板文件名解析工具
 * 
 * 文件名编码规则：人群类型_随机5位编码_脸型后缀
 * 示例：
 * - shaonv_hhhh5_n.jpg (窄脸)
 * - shaonv_hhhh5_w.jpg (宽脸)
 * - younv_abc12.jpg (不区分脸型)
 */

export interface ParsedFilename {
  // 原始文件名（不含扩展名）
  basename: string;
  // 人群类型代码（如 shaonv, shunv）
  groupType: string;
  // 随机编码部分（如 hhhh5, abc12）
  randomCode: string;
  // 脸型后缀：n=窄脸, w=宽脸, null=不区分
  faceTypeSuffix: 'n' | 'w' | null;
  // 数据库脸型值
  faceType: 'narrow' | 'wide' | 'both';
  // 模板组ID（用于关联宽脸/窄脸版本）
  templateGroupId: string;
  // 是否为有效的编码格式
  isValid: boolean;
  // 解析错误信息
  error?: string;
}

/**
 * 解析模板文件名
 * @param filename 文件名（可带或不带扩展名）
 * @returns 解析结果
 */
export function parseTemplateFilename(filename: string): ParsedFilename {
  // 移除扩展名
  const basename = filename.replace(/\.[^.]+$/, '');
  
  // 默认返回值
  const defaultResult: ParsedFilename = {
    basename,
    groupType: '',
    randomCode: '',
    faceTypeSuffix: null,
    faceType: 'both',
    templateGroupId: basename,
    isValid: false,
    error: '无法解析文件名格式',
  };
  
  // 尝试匹配带脸型后缀的格式：groupType_randomCode_n 或 groupType_randomCode_w
  const withFaceTypeMatch = basename.match(/^([a-z]+)_([a-zA-Z0-9]{5})_(n|w)$/i);
  if (withFaceTypeMatch) {
    const [, groupType, randomCode, faceTypeSuffix] = withFaceTypeMatch;
    const templateGroupId = `${groupType}_${randomCode}`.toLowerCase();
    
    return {
      basename,
      groupType: groupType.toLowerCase(),
      randomCode: randomCode.toLowerCase(),
      faceTypeSuffix: faceTypeSuffix.toLowerCase() as 'n' | 'w',
      faceType: faceTypeSuffix.toLowerCase() === 'n' ? 'narrow' : 'wide',
      templateGroupId,
      isValid: true,
    };
  }
  
  // 尝试匹配不带脸型后缀的格式：groupType_randomCode
  const withoutFaceTypeMatch = basename.match(/^([a-z]+)_([a-zA-Z0-9]{5})$/i);
  if (withoutFaceTypeMatch) {
    const [, groupType, randomCode] = withoutFaceTypeMatch;
    const templateGroupId = `${groupType}_${randomCode}`.toLowerCase();
    
    return {
      basename,
      groupType: groupType.toLowerCase(),
      randomCode: randomCode.toLowerCase(),
      faceTypeSuffix: null,
      faceType: 'both',
      templateGroupId,
      isValid: true,
    };
  }
  
  // 无法解析，返回默认值（使用完整文件名作为组ID）
  return defaultResult;
}

/**
 * 验证文件名是否符合编码规则
 * @param filename 文件名
 * @returns 是否有效
 */
export function isValidTemplateFilename(filename: string): boolean {
  return parseTemplateFilename(filename).isValid;
}

/**
 * 从文件名获取模板组ID
 * @param filename 文件名
 * @returns 模板组ID
 */
export function getTemplateGroupId(filename: string): string {
  return parseTemplateFilename(filename).templateGroupId;
}

/**
 * 从文件名获取脸型
 * @param filename 文件名
 * @returns 脸型值
 */
export function getFaceTypeFromFilename(filename: string): 'narrow' | 'wide' | 'both' {
  return parseTemplateFilename(filename).faceType;
}

/**
 * 需要区分脸型的人群类型列表
 */
export const FACE_TYPE_REQUIRED_GROUPS = [
  'shaonv',   // 少女
  'shunv',    // 熟女
  'nainai',   // 奶奶
  'shaonan',  // 少男
  'dashu',    // 大叔
];

/**
 * 检查人群类型是否需要区分脸型
 * @param groupType 人群类型代码
 * @returns 是否需要区分脸型
 */
export function requiresFaceType(groupType: string): boolean {
  return FACE_TYPE_REQUIRED_GROUPS.includes(groupType.toLowerCase());
}
