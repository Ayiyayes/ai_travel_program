/**
 * 图片遮盖处理工具
 * 用于处理背景雕塑遮盖功能
 */

import sharp from 'sharp';

// 遮盖区域类型
export interface MaskRegion {
  id: string;        // 区域唯一ID
  x: number;         // 左上角X坐标（百分比 0-1）
  y: number;         // 左上角Y坐标（百分比 0-1）
  width: number;     // 宽度（百分比 0-1）
  height: number;    // 高度（百分比 0-1）
  label?: string;    // 标签（可选）
}

// 遮盖颜色（灰色）
const MASK_COLOR = { r: 128, g: 128, b: 128 };

/**
 * 生成遮盖版模板图片
 * 将标记区域填充为灰色
 * 
 * @param originalBuffer - 原始图片Buffer
 * @param regions - 遮盖区域配置数组
 * @returns 遮盖版图片Buffer
 */
export async function generateMaskedTemplate(
  originalBuffer: Buffer,
  regions: MaskRegion[]
): Promise<Buffer> {
  if (!regions || regions.length === 0) {
    return originalBuffer;
  }

  const image = sharp(originalBuffer);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error('无法获取图片尺寸');
  }

  // 创建遮盖层（SVG）
  const maskRects = regions.map(r => {
    const rectX = Math.round(r.x * width);
    const rectY = Math.round(r.y * height);
    const rectWidth = Math.round(r.width * width);
    const rectHeight = Math.round(r.height * height);
    return `<rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" fill="rgb(${MASK_COLOR.r},${MASK_COLOR.g},${MASK_COLOR.b})" />`;
  }).join('\n');

  const maskSvg = `
    <svg width="${width}" height="${height}">
      ${maskRects}
    </svg>
  `;

  // 将遮盖层合成到原图上
  return image
    .composite([{
      input: Buffer.from(maskSvg),
      blend: 'over'
    }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * 提取区域像素缓存
 * 创建透明背景图片，只保留标记区域的原始像素
 * 
 * @param originalBuffer - 原始图片Buffer
 * @param regions - 遮盖区域配置数组
 * @returns 区域像素缓存图片Buffer（PNG格式，透明背景）
 */
export async function extractRegionCache(
  originalBuffer: Buffer,
  regions: MaskRegion[]
): Promise<Buffer> {
  if (!regions || regions.length === 0) {
    throw new Error('遮盖区域不能为空');
  }

  const image = sharp(originalBuffer);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error('无法获取图片尺寸');
  }

  // 创建透明背景的画布
  const canvas = sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  // 提取每个区域并准备合成
  const composites = await Promise.all(regions.map(async (r) => {
    const left = Math.round(r.x * width);
    const top = Math.round(r.y * height);
    const regionWidth = Math.round(r.width * width);
    const regionHeight = Math.round(r.height * height);

    // 确保区域在图片范围内
    const safeLeft = Math.max(0, Math.min(left, width - 1));
    const safeTop = Math.max(0, Math.min(top, height - 1));
    const safeWidth = Math.min(regionWidth, width - safeLeft);
    const safeHeight = Math.min(regionHeight, height - safeTop);

    if (safeWidth <= 0 || safeHeight <= 0) {
      return null;
    }

    const regionBuffer = await sharp(originalBuffer)
      .extract({
        left: safeLeft,
        top: safeTop,
        width: safeWidth,
        height: safeHeight
      })
      .toBuffer();

    return {
      input: regionBuffer,
      left: safeLeft,
      top: safeTop
    };
  }));

  // 过滤掉无效区域
  const validComposites = composites.filter(c => c !== null);

  if (validComposites.length === 0) {
    throw new Error('没有有效的遮盖区域');
  }

  // 合成所有区域到透明画布
  return canvas
    .composite(validComposites as sharp.OverlayOptions[])
    .png() // 使用PNG保留透明度
    .toBuffer();
}

/**
 * 还原区域（换脸后）
 * 将缓存的区域像素覆盖到换脸结果上
 * 
 * @param swappedBuffer - Coze换脸结果图片Buffer
 * @param regionCacheBuffer - 预缓存的区域像素图片Buffer
 * @returns 最终图片Buffer（雕塑区域已还原）
 */
export async function restoreRegions(
  swappedBuffer: Buffer,
  regionCacheBuffer: Buffer
): Promise<Buffer> {
  // 直接将缓存的区域像素覆盖到换脸结果上
  // 透明区域不会覆盖原图
  return sharp(swappedBuffer)
    .composite([{
      input: regionCacheBuffer,
      blend: 'over'
    }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * 从URL下载图片
 * 
 * @param url - 图片URL
 * @returns 图片Buffer
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载图片失败: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * 验证遮盖区域配置
 * 
 * @param regions - 遮盖区域配置数组
 * @returns 是否有效
 */
export function validateMaskRegions(regions: MaskRegion[]): boolean {
  if (!Array.isArray(regions)) {
    return false;
  }

  for (const region of regions) {
    // 检查必要字段
    if (typeof region.x !== 'number' || typeof region.y !== 'number' ||
        typeof region.width !== 'number' || typeof region.height !== 'number') {
      return false;
    }

    // 检查范围（0-1）
    if (region.x < 0 || region.x > 1 || region.y < 0 || region.y > 1 ||
        region.width <= 0 || region.width > 1 || region.height <= 0 || region.height > 1) {
      return false;
    }

    // 检查区域不超出图片边界
    if (region.x + region.width > 1 || region.y + region.height > 1) {
      return false;
    }
  }

  return true;
}

/**
 * 解析遮盖区域JSON
 * 
 * @param json - JSON字符串
 * @returns 遮盖区域数组
 */
export function parseMaskRegions(json: string | null | undefined): MaskRegion[] {
  if (!json) {
    return [];
  }

  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed.maskRegions && Array.isArray(parsed.maskRegions)) {
      return parsed.maskRegions;
    }
    return [];
  } catch {
    return [];
  }
}
