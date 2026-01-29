/**
 * 下载北京故宫景点素材
 * 使用 Pixabay API (完全免费，无需注册)
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pixabay API 配置 (完全免费)
const PIXABAY_API_KEY = '47848363-b9259e6dc6c31bad3bd5b3aa3';
const PIXABAY_API_URL = 'https://pixabay.com/api/';

// 下载目录
const DOWNLOAD_DIR = path.join(__dirname, '../public/scenic-templates/beijing-gugong');

// 确保下载目录存在
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

interface PixabayPhoto {
  id: number;
  pageURL: string;
  largeImageURL: string;
  webformatURL: string;
  imageURL: string;
  user: string;
  tags: string;
}

/**
 * 搜索故宫图片
 */
async function searchGugongPhotos(perPage: number = 15): Promise<PixabayPhoto[]> {
  try {
    console.log('🔍 正在搜索北京故宫图片...');

    const response = await axios.get(PIXABAY_API_URL, {
      params: {
        key: PIXABAY_API_KEY,
        q: 'Forbidden City Beijing',
        image_type: 'photo',
        orientation: 'vertical', // 竖版图片
        per_page: perPage,
        safesearch: 'true',
      },
    });

    console.log(`✅ 找到 ${response.data.hits.length} 张图片`);
    return response.data.hits;
  } catch (error) {
    console.error('❌ 搜索失败:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * 下载图片
 */
async function downloadPhoto(photo: PixabayPhoto, index: number): Promise<boolean> {
  try {
    const imageUrl = photo.largeImageURL; // 使用高清图片
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });

    // 生成文件名
    const filename = `gugong_${index + 1}_${photo.id}.jpg`;
    const filepath = path.join(DOWNLOAD_DIR, filename);

    // 保存文件
    fs.writeFileSync(filepath, response.data);

    console.log(`  ✅ ${filename}`);
    console.log(`     作者: ${photo.user}`);
    console.log(`     标签: ${photo.tags}`);

    return true;
  } catch (error) {
    console.error(`  ❌ 下载失败 [${photo.id}]:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 主函数
 */
async function main() {
  console.log('🏛️  开始下载北京故宫景点素材...\n');
  console.log(`📁 保存目录: ${DOWNLOAD_DIR}\n`);

  // 搜索图片
  const photos = await searchGugongPhotos(15);

  if (photos.length === 0) {
    console.log('⚠️  未找到相关图片');
    process.exit(1);
  }

  console.log(`\n📥 开始下载 ${photos.length} 张图片...\n`);

  let successCount = 0;
  let failCount = 0;

  // 下载图片
  for (let i = 0; i < photos.length; i++) {
    console.log(`[${i + 1}/${photos.length}] 下载中...`);
    const success = await downloadPhoto(photos[i], i);

    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // 延迟避免请求过快
    if (i < photos.length - 1) {
      await delay(500);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✨ 下载完成!');
  console.log(`   成功: ${successCount} 张`);
  console.log(`   失败: ${failCount} 张`);
  console.log(`\n📂 文件保存在: ${DOWNLOAD_DIR}`);
  console.log('='.repeat(50));
}

// 运行脚本
main().catch((error) => {
  console.error('\n💥 脚本执行出错:', error);
  process.exit(1);
});
