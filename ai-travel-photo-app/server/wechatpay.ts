// 微信支付服务
import crypto from 'crypto';
import axios from 'axios';
import * as db from './db';

// 微信支付配置（从数据库读取或使用环境变量）
interface WechatPayConfig {
  appId: string;          // 小程序 AppID
  mchId: string;          // 商户号
  apiKey: string;         // API 密钥 (v2)
  apiV3Key: string;       // API v3 密钥
  serialNo: string;       // 商户证书序列号
  privateKey: string;     // 商户私钥
  notifyUrl: string;      // 支付回调地址
}

// 配置缓存
let configCache: WechatPayConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60000; // 1分钟缓存

// 获取配置
async function getConfig(): Promise<WechatPayConfig> {
  const now = Date.now();
  if (configCache && now - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }

  // 从数据库获取配置
  const [appId, mchId, apiKey, apiV3Key, serialNo, privateKey, notifyUrl] = await Promise.all([
    db.getSystemConfig('WECHAT_APP_ID'),
    db.getSystemConfig('WECHAT_MCH_ID'),
    db.getSystemConfig('WECHAT_API_KEY'),
    db.getSystemConfig('WECHAT_API_V3_KEY'),
    db.getSystemConfig('WECHAT_SERIAL_NO'),
    db.getSystemConfig('WECHAT_PRIVATE_KEY'),
    db.getSystemConfig('WECHAT_PAY_NOTIFY_URL'),
  ]);

  configCache = {
    appId: appId || process.env.WECHAT_APP_ID || '',
    mchId: mchId || process.env.WECHAT_MCH_ID || '',
    apiKey: apiKey || process.env.WECHAT_API_KEY || '',
    apiV3Key: apiV3Key || process.env.WECHAT_API_V3_KEY || '',
    serialNo: serialNo || process.env.WECHAT_SERIAL_NO || '',
    privateKey: privateKey || process.env.WECHAT_PRIVATE_KEY || '',
    notifyUrl: notifyUrl || process.env.WECHAT_PAY_NOTIFY_URL || '',
  };
  configCacheTime = now;

  return configCache;
}

// 生成随机字符串
function generateNonceStr(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成签名 (JSAPI v3)
function generateSignature(
  method: string,
  url: string,
  timestamp: number,
  nonceStr: string,
  body: string,
  privateKey: string
): string {
  const message = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const sign = crypto.createSign('SHA256');
  sign.update(message);
  return sign.sign(privateKey, 'base64');
}

// 创建 JSAPI 支付订单
export async function createJsapiOrder(params: {
  openId: string;
  outTradeNo: string;    // 商户订单号
  totalAmount: number;   // 金额（分）
  description: string;   // 商品描述
}): Promise<{
  success: boolean;
  prepayId?: string;
  payParams?: {
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
  };
  error?: string;
}> {
  const config = await getConfig();

  if (!config.mchId || !config.apiV3Key) {
    return { success: false, error: '微信支付未配置' };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonceStr = generateNonceStr();

  const requestBody = {
    appid: config.appId,
    mchid: config.mchId,
    description: params.description,
    out_trade_no: params.outTradeNo,
    notify_url: config.notifyUrl,
    amount: {
      total: params.totalAmount,
      currency: 'CNY',
    },
    payer: {
      openid: params.openId,
    },
  };

  const url = '/v3/pay/transactions/jsapi';
  const body = JSON.stringify(requestBody);

  try {
    const signature = generateSignature('POST', url, timestamp, nonceStr, body, config.privateKey);

    const response = await axios.post(`https://api.mch.weixin.qq.com${url}`, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.serialNo}"`,
      },
    });

    if (response.data.prepay_id) {
      // 生成小程序调起支付的参数
      const payTimestamp = String(Math.floor(Date.now() / 1000));
      const payNonceStr = generateNonceStr();
      const packageStr = `prepay_id=${response.data.prepay_id}`;

      // 生成支付签名
      const payMessage = `${config.appId}\n${payTimestamp}\n${payNonceStr}\n${packageStr}\n`;
      const paySign = crypto.createSign('SHA256');
      paySign.update(payMessage);
      const paySignature = paySign.sign(config.privateKey, 'base64');

      return {
        success: true,
        prepayId: response.data.prepay_id,
        payParams: {
          appId: config.appId,
          timeStamp: payTimestamp,
          nonceStr: payNonceStr,
          package: packageStr,
          signType: 'RSA',
          paySign: paySignature,
        },
      };
    }

    return { success: false, error: '获取预支付ID失败' };
  } catch (error: any) {
    console.error('[WechatPay] 创建订单失败:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}

// 验证支付回调签名
export async function verifyNotifySignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  serialNo: string
): Promise<boolean> {
  // 实际实现需要获取微信支付平台证书来验证
  // 这里简化处理，生产环境需要完整实现
  const config = await getConfig();

  // TODO: 实现证书验证逻辑
  // 1. 获取微信支付平台证书
  // 2. 验证签名

  return true; // 简化处理
}

// 解密回调数据
export async function decryptNotifyResource(resource: {
  algorithm: string;
  ciphertext: string;
  associated_data: string;
  nonce: string;
}): Promise<any> {
  const config = await getConfig();

  if (resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error('不支持的加密算法');
  }

  const key = Buffer.from(config.apiV3Key);
  const nonce = Buffer.from(resource.nonce);
  const associatedData = Buffer.from(resource.associated_data);
  const ciphertext = Buffer.from(resource.ciphertext, 'base64');

  // 分离密文和认证标签
  const authTag = ciphertext.slice(-16);
  const encryptedData = ciphertext.slice(0, -16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  decipher.setAAD(associatedData);

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

  return JSON.parse(decrypted.toString('utf8'));
}

// 查询订单状态
export async function queryOrder(outTradeNo: string): Promise<{
  success: boolean;
  tradeState?: string;
  transactionId?: string;
  error?: string;
}> {
  const config = await getConfig();

  if (!config.mchId) {
    return { success: false, error: '微信支付未配置' };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonceStr = generateNonceStr();
  const url = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${config.mchId}`;

  try {
    const signature = generateSignature('GET', url, timestamp, nonceStr, '', config.privateKey);

    const response = await axios.get(`https://api.mch.weixin.qq.com${url}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.serialNo}"`,
      },
    });

    return {
      success: true,
      tradeState: response.data.trade_state,
      transactionId: response.data.transaction_id,
    };
  } catch (error: any) {
    console.error('[WechatPay] 查询订单失败:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}

// 关闭订单
export async function closeOrder(outTradeNo: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const config = await getConfig();

  if (!config.mchId) {
    return { success: false, error: '微信支付未配置' };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonceStr = generateNonceStr();
  const url = `/v3/pay/transactions/out-trade-no/${outTradeNo}/close`;
  const body = JSON.stringify({ mchid: config.mchId });

  try {
    const signature = generateSignature('POST', url, timestamp, nonceStr, body, config.privateKey);

    await axios.post(`https://api.mch.weixin.qq.com${url}`, { mchid: config.mchId }, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.serialNo}"`,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('[WechatPay] 关闭订单失败:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
    };
  }
}
