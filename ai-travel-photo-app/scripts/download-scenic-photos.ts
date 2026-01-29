/**
 * 景点素材图片下载脚本
 * 使用 Unsplash API 下载高质量旅游景点图片
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Unsplash API 配置
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || 'YOUR_ACCESS_KEY_HERE';
const UNSPLASH_API_URL = 'https://api.unsplash.com';

// 下载目录
const DOWNLOAD_DIR = path.join(__dirname, '../public/scenic-templates');

// 确保下载目录存在
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// 景点关键词列表（中英文）
const SCENIC_SPOTS = [
  { name: '长沙-橘子洲', keywords: 'Changsha Orange Isle China landmark' },
  { name: '长沙-岳麓山', keywords: 'Yuelu Mountain Changsha temple' },
  { name: '长沙-天心阁', keywords: 'Tianxin Pavilion Changsha ancient tower' },
  { name: '北京-天安门', keywords: 'Tiananmen Square Beijing landmark' },
  { name: '北京-故宫', keywords: 'Forbidden City Beijing palace' },
  { name: '北京-长城', keywords: 'Great Wall of China Beijing' },
  { name: '上海-外滩', keywords: 'The Bund Shanghai skyline night' },
  { name: '上海-东方明珠', keywords: 'Oriental Pearl Tower Shanghai' },
  { name: '西安-兵马俑', keywords: 'Terracotta Army Xian warriors' },
  { name: '西安-大雁塔', keywords: 'Big Wild Goose Pagoda Xian' },
  { name: '杭州-西湖', keywords: 'West Lake Hangzhou scenic' },
  { name: '苏州-园林', keywords: 'Suzhou classical gardens' },
  { name: '成都-宽窄巷子', keywords: 'Kuanzhai Alley Chengdu street' },
  { name: '重庆-洪崖洞', keywords: 'Hongya Cave Chongqing night view' },
  { name: '桂林-漓江', keywords: 'Li River Guilin mountains' },
  { name: '张家界-天门山', keywords: 'Tianmen Mountain Zhangjiajie' },
  { name: '三亚-天涯海角', keywords: 'Tianya Haijiao Sanya beach' },
  { name: '丽江-古城', keywords: 'Lijiang Old Town ancient street' },
  { name: '拉萨-布达拉宫', keywords: 'Potala Palace Lhasa Tibet' },
];

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  links: {
    download_location: string;
  };
  user: {
    name: string;
    username: string;
  };
  description: string | null;
}

/**
 * 搜索图片
 */
async function searchPhotos(query: string, perPage: number = 5): Promise<UnsplashPhoto[]> {
  try {
    const response = await axios.get(`${UNSPLASH_API_URL}/search/photos`, {
      params: {
        query,
        per_page: perPage,
        orientation: 'portrait', // 竖版图片更适合做模板
      },
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      },
    });

    return response.data.results;
  } catch (error) {
    console.error(`搜索失败 [${query}]:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * 下载图片
 */
async function downloadPhoto(photo: UnsplashPhoto, spotName: string, index: number): Promise<boolean> {
  try {
    // 触发下载统计（Unsplash API 要求）
    if (photo.links.download_location) {
      await axios.get(photo.links.download_location, {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      });
    }

    // 下载图片
    const imageUrl = photo.urls.regular; // 使用 regular 尺寸，平衡质量和大小
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });

    // 生成文件名
    const sanitizedSpotName = spotName.replace(/[\/\\]/g, '-');
    const filename = `${sanitizedSpotName}_${index + 1}_${photo.id}.jpg`;
    const filepath = path.join(DOWNLOAD_DIR, filename);

    // 保存文件
    fs.writeFileSync(filepath, response.data);

    console.log(`✅ 下载成功: ${filename}`);
    console.log(`   作者: ${photo.user.name} (@${photo.user.username})`);
    if (photo.description) {
      console.log(`   描述: ${photo.description}`);
    }

    return true;
  } catch (error) {
    console.error(`❌ 下载失败 [${photo.id}]:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * 延迟函数（避免 API 限流）
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始下载景点素材图片...\n');

  // 检查 API Key
  if (UNSPLASH_ACCESS_KEY === 'YOUR_ACCESS_KEY_HERE') {
    console.error('❌ 错误: 请先设置 UNSPLASH_ACCESS_KEY 环境变量');
    console.log('\n获取方式:');
    console.log('1. 访问 https://unsplash.com/developers');
    console.log('2. 注册应用获取 Access Key');
    console.log('3. 设置环境变量: export UNSPLASH_ACCESS_KEY=your_key');
    process.exit(1);
  }

  console.log(`📁 下载目录: ${DOWNLOAD_DIR}\n`);

  let totalDownloaded = 0;
  let totalFailed = 0;

  for (const spot of SCENIC_SPOTS) {
    console.log(`\n🏞️  正在处理: ${spot.name}`);
    console.log(`   搜索关键词: ${spot.keywords}`);

    // 搜索图片
    const photos = await searchPhotos(spot.keywords, 3); // 每个景点下载 3 张

    if (photos.length === 0) {
      console.log(`⚠️  未找到相关图片`);
      continue;
    }

    console.log(`   找到 ${photos.length} 张图片，开始下载...`);

    // 下载图片
    for (let i = 0; i < photos.length; i++) {
      const success = await downloadPhoto(photos[i], spot.name, i);
      if (success) {
        totalDownloaded++;
      } else {
        totalFailed++;
      }

      // 延迟以避免 API 限流
      await delay(1000);
    }

    // 每个景点之间延迟
    await delay(2000);
  }

  console.log('\n✨ 下载完成!');
  console.log(`   成功: ${totalDownloaded} 张`);
  console.log(`   失败: ${totalFailed} 张`);
  console.log(`\n📂 文件保存在: ${DOWNLOAD_DIR}`);
}

// 运行脚本
main().catch((error) => {
  console.error('💥 脚本执行出错:', error);
  process.exit(1);
});
