/**
 * 腾讯云短信服务模块
 * 用于发送验证码和通知短信
 */

import * as tencentcloud from "tencentcloud-sdk-nodejs";

// 腾讯云短信客户端
const SmsClient = tencentcloud.sms.v20210111.Client;

// 超级管理员手机号
const SUPER_ADMIN_PHONE = "18673105881";

// 验证码存储（内存缓存，生产环境建议使用 Redis）
const verificationCodes: Map<string, { code: string; expireAt: number }> = new Map();

// 获取短信客户端配置
function getSmsClientConfig() {
  const secretId = process.env.TENCENT_SMS_SECRET_ID;
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY;
  
  if (!secretId || !secretKey) {
    throw new Error("腾讯云短信配置缺失，请配置 TENCENT_SMS_SECRET_ID 和 TENCENT_SMS_SECRET_KEY");
  }
  
  return {
    credential: {
      secretId,
      secretKey,
    },
    region: "ap-guangzhou", // 默认广州区域
    profile: {
      httpProfile: {
        endpoint: "sms.tencentcloudapi.com",
      },
    },
  };
}

// 获取短信发送参数
function getSmsParams() {
  const sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID;
  const signName = process.env.TENCENT_SMS_SIGN_NAME;
  const verifyTemplateId = process.env.TENCENT_SMS_VERIFY_TEMPLATE_ID;
  const notifyTemplateId = process.env.TENCENT_SMS_NOTIFY_TEMPLATE_ID;
  
  if (!sdkAppId || !signName) {
    throw new Error("腾讯云短信配置缺失，请配置 TENCENT_SMS_SDK_APP_ID 和 TENCENT_SMS_SIGN_NAME");
  }
  
  return {
    sdkAppId,
    signName,
    verifyTemplateId: verifyTemplateId || "",
    notifyTemplateId: notifyTemplateId || "",
  };
}

/**
 * 生成6位随机验证码
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 发送验证码短信
 * @param phone 手机号
 * @param purpose 用途（用于区分不同场景的验证码）
 * @returns 是否发送成功
 */
export async function sendVerificationCode(phone: string, purpose: string = "default"): Promise<{ success: boolean; message: string }> {
  try {
    const config = getSmsClientConfig();
    const params = getSmsParams();
    
    if (!params.verifyTemplateId) {
      throw new Error("验证码模板ID未配置，请配置 TENCENT_SMS_VERIFY_TEMPLATE_ID");
    }
    
    const client = new SmsClient(config);
    const code = generateVerificationCode();
    
    // 发送短信
    const result = await client.SendSms({
      SmsSdkAppId: params.sdkAppId,
      SignName: params.signName,
      TemplateId: params.verifyTemplateId,
      PhoneNumberSet: [`+86${phone}`],
      TemplateParamSet: [code, "5"], // 验证码和有效期（分钟）
    });
    
    // 检查发送结果
    const sendStatus = result.SendStatusSet?.[0];
    if (sendStatus?.Code !== "Ok") {
      console.error("短信发送失败:", sendStatus);
      return { success: false, message: sendStatus?.Message || "短信发送失败" };
    }
    
    // 存储验证码（5分钟有效期）
    const key = `${phone}_${purpose}`;
    verificationCodes.set(key, {
      code,
      expireAt: Date.now() + 5 * 60 * 1000, // 5分钟后过期
    });
    
    console.log(`验证码已发送到 ${phone}，用途: ${purpose}`);
    return { success: true, message: "验证码已发送" };
    
  } catch (error: any) {
    console.error("发送验证码失败:", error);
    return { success: false, message: error.message || "发送验证码失败" };
  }
}

/**
 * 验证验证码
 * @param phone 手机号
 * @param code 验证码
 * @param purpose 用途
 * @returns 是否验证成功
 */
export function verifyCode(phone: string, code: string, purpose: string = "default"): { success: boolean; message: string } {
  const key = `${phone}_${purpose}`;
  const stored = verificationCodes.get(key);
  
  if (!stored) {
    return { success: false, message: "验证码不存在或已过期，请重新获取" };
  }
  
  if (Date.now() > stored.expireAt) {
    verificationCodes.delete(key);
    return { success: false, message: "验证码已过期，请重新获取" };
  }
  
  if (stored.code !== code) {
    return { success: false, message: "验证码错误" };
  }
  
  // 验证成功后删除验证码
  verificationCodes.delete(key);
  return { success: true, message: "验证成功" };
}

/**
 * 发送渠道操作通知短信
 * @param action 操作类型（create/delete）
 * @param channelName 渠道名称
 * @returns 是否发送成功
 */
export async function sendChannelNotification(action: "create" | "delete", channelName: string): Promise<{ success: boolean; message: string }> {
  try {
    const config = getSmsClientConfig();
    const params = getSmsParams();
    
    if (!params.notifyTemplateId) {
      throw new Error("通知模板ID未配置，请配置 TENCENT_SMS_NOTIFY_TEMPLATE_ID");
    }
    
    const client = new SmsClient(config);
    
    // 根据操作类型设置模板参数
    const actionText = action === "create" ? "新增" : "删除";
    
    // 发送短信
    const result = await client.SendSms({
      SmsSdkAppId: params.sdkAppId,
      SignName: params.signName,
      TemplateId: params.notifyTemplateId,
      PhoneNumberSet: [`+86${SUPER_ADMIN_PHONE}`],
      TemplateParamSet: [actionText, channelName], // 操作类型和渠道名称
    });
    
    // 检查发送结果
    const sendStatus = result.SendStatusSet?.[0];
    if (sendStatus?.Code !== "Ok") {
      console.error("通知短信发送失败:", sendStatus);
      return { success: false, message: sendStatus?.Message || "通知短信发送失败" };
    }
    
    console.log(`渠道${actionText}通知已发送到 ${SUPER_ADMIN_PHONE}，渠道名称: ${channelName}`);
    return { success: true, message: "通知已发送" };
    
  } catch (error: any) {
    console.error("发送通知短信失败:", error);
    // 通知短信发送失败不应阻止主操作，只记录日志
    return { success: false, message: error.message || "发送通知短信失败" };
  }
}

/**
 * 检查短信服务是否已配置
 */
export function isSmsConfigured(): boolean {
  return !!(
    process.env.TENCENT_SMS_SECRET_ID &&
    process.env.TENCENT_SMS_SECRET_KEY &&
    process.env.TENCENT_SMS_SDK_APP_ID &&
    process.env.TENCENT_SMS_SIGN_NAME
  );
}

/**
 * 获取超级管理员手机号
 */
export function getSuperAdminPhone(): string {
  return SUPER_ADMIN_PHONE;
}
