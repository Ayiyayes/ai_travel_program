import QRCode from 'qrcode';
import { storagePut } from './storage';

// 系统主色调（用于二维码颜色）
const PRIMARY_COLOR = '#E57373'; // 珊瑚粉色

// 小程序链接配置（占位，等小程序上线后替换）
export const MINIPROGRAM_CONFIG = {
  // 微信小程序
  wechat: {
    // 小程序上线后替换为真实的小程序路径
    // 格式: weixin://dl/business/?appid=APPID&path=pages/index/index
    baseUrl: 'https://ai-travel-photo.manus.space/app',
    name: '微信小程序',
  },
  // 抖音小程序
  douyin: {
    // 小程序上线后替换为真实的小程序路径
    // 格式: snssdk1128://microapp?app_id=APPID&path=pages/index/index
    baseUrl: 'https://ai-travel-photo.manus.space/app',
    name: '抖音小程序',
  },
};

/**
 * 生成带参数的推广链接
 * @param platform 平台类型: 'wechat' | 'douyin'
 * @param params 链接参数
 */
export function generatePromotionLink(
  platform: 'wechat' | 'douyin',
  params: {
    channelCode: string;
    salesCode?: string;
    city: string;
    scenicSpot: string;
  }
): string {
  const baseUrl = MINIPROGRAM_CONFIG[platform].baseUrl;
  const queryParams = new URLSearchParams({
    channel: params.channelCode,
    city: params.city,
    spot: params.scenicSpot,
    platform,
  });
  
  if (params.salesCode) {
    queryParams.set('sales', params.salesCode);
  }
  
  return `${baseUrl}?${queryParams.toString()}`;
}

/**
 * 生成二维码图片并上传到S3
 * @param content 二维码内容（链接）
 * @param filename 文件名（不含扩展名）
 */
export async function generateQRCodeAndUpload(
  content: string,
  filename: string
): Promise<string> {
  try {
    // 生成二维码为Buffer
    const qrBuffer = await QRCode.toBuffer(content, {
      type: 'png',
      width: 512,
      margin: 2,
      color: {
        dark: PRIMARY_COLOR,
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H', // 高容错率
    });
    
    // 上传到S3
    const key = `qrcodes/${filename}-${Date.now()}.png`;
    const { url } = await storagePut(key, qrBuffer, 'image/png');
    
    return url;
  } catch (error) {
    console.error('生成二维码失败:', error);
    throw error;
  }
}

/**
 * 为渠道生成所有平台的推广码
 * @param channelCode 渠道编码
 * @param city 城市
 * @param scenicSpot 景点
 * @param salesCode 销售编码（可选）
 */
export async function generateAllPlatformCodes(params: {
  channelCode: string;
  city: string;
  scenicSpot: string;
  salesCode?: string;
}): Promise<{
  wechatLink: string;
  wechatQrCodeUrl: string;
  douyinLink: string;
  douyinQrCodeUrl: string;
}> {
  const { channelCode, city, scenicSpot, salesCode } = params;
  
  // 生成微信小程序链接和二维码
  const wechatLink = generatePromotionLink('wechat', {
    channelCode,
    salesCode,
    city,
    scenicSpot,
  });
  const wechatFilename = `wechat-${channelCode}-${city}-${scenicSpot}`;
  const wechatQrCodeUrl = await generateQRCodeAndUpload(wechatLink, wechatFilename);
  
  // 生成抖音小程序链接和二维码
  const douyinLink = generatePromotionLink('douyin', {
    channelCode,
    salesCode,
    city,
    scenicSpot,
  });
  const douyinFilename = `douyin-${channelCode}-${city}-${scenicSpot}`;
  const douyinQrCodeUrl = await generateQRCodeAndUpload(douyinLink, douyinFilename);
  
  return {
    wechatLink,
    wechatQrCodeUrl,
    douyinLink,
    douyinQrCodeUrl,
  };
}

/**
 * 生成二维码的Base64数据（用于前端直接显示）
 * @param content 二维码内容
 */
export async function generateQRCodeBase64(content: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(content, {
      width: 512,
      margin: 2,
      color: {
        dark: PRIMARY_COLOR,
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
    return dataUrl;
  } catch (error) {
    console.error('生成二维码Base64失败:', error);
    throw error;
  }
}
