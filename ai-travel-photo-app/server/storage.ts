// Storage helpers - supports local storage and Tencent Cloud COS
import { ENV } from './_core/env';
import * as fs from 'fs';
import * as path from 'path';
import COS from 'cos-nodejs-sdk-v5';

// 本地存储目录
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'dist', 'public', 'uploads');

// 腾讯云 COS 客户端（懒加载）
let cosClient: COS | null = null;

function getCosClient(): COS {
  if (!cosClient) {
    if (!ENV.cosSecretId || !ENV.cosSecretKey) {
      throw new Error('腾讯云 COS 配置缺失：请设置 COS_SECRET_ID 和 COS_SECRET_KEY');
    }
    cosClient = new COS({
      SecretId: ENV.cosSecretId,
      SecretKey: ENV.cosSecretKey,
    });
  }
  return cosClient;
}

// 确保本地上传目录存在
function ensureLocalUploadDir(subDir: string = ''): string {
  const dir = subDir ? path.join(LOCAL_UPLOAD_DIR, subDir) : LOCAL_UPLOAD_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// 本地存储实现
async function localStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  const filePath = path.join(LOCAL_UPLOAD_DIR, key);

  // 确保目录存在
  const dir = path.dirname(filePath);
  ensureLocalUploadDir(path.relative(LOCAL_UPLOAD_DIR, dir));

  // 将数据写入文件
  const buffer = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

  // 返回可访问的URL（相对路径）
  const url = `/uploads/${key}`;
  return { key, url };
}

// 腾讯云 COS 存储实现
async function cosStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const cos = getCosClient();
  const key = relKey.replace(/^\/+/, "");
  const buffer = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);

  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: ENV.cosBucket,
      Region: ENV.cosRegion,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }, (err, data) => {
      if (err) {
        console.error('[COS] Upload error:', err);
        reject(new Error(`COS upload failed: ${err.message}`));
      } else {
        // 构建公网访问 URL
        const url = `https://${ENV.cosBucket}.cos.${ENV.cosRegion}.myqcloud.com/${key}`;
        console.log('[COS] Upload success:', url);
        resolve({ key, url });
      }
    });
  });
}

// 统一存储接口
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  // 根据环境变量选择存储方式
  if (ENV.storageType === 'cloud') {
    return cosStoragePut(relKey, data, contentType);
  }
  return localStoragePut(relKey, data, contentType);
}

// 获取文件 URL
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");

  if (ENV.storageType === 'cloud') {
    // 腾讯云 COS 公网 URL
    const url = `https://${ENV.cosBucket}.cos.${ENV.cosRegion}.myqcloud.com/${key}`;
    return { key, url };
  }

  // 本地存储
  return { key, url: `/uploads/${key}` };
}
