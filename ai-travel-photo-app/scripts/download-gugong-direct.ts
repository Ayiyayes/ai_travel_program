/**
 * 直接下载北京故宫景点素材
 * 使用精选的公开图片资源
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 下载目录
const DOWNLOAD_DIR = path.join(__dirname, '../public/scenic-templates/beijing-gugong');

// 确保下载目录存在
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// 精选的故宫图片链接（来自公开的免费图库）
const GUGONG_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1508804052814-cd3ba865a116?w=1080&q=80',
    name: 'gugong_main_hall.jpg',
    description: '故宫太和殿主殿',
  },
  {
    url: 'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=1080&q=80',
    name: 'gugong_architecture.jpg',
    description: '故宫建筑细节',
  },
  {
    url: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1080&q=80',
    name: 'gugong_palace.jpg',
    description: '故宫宫殿全景',
  },
  {
    url: 'https://images.unsplash.com/photo-1584646098378-0874589d76b1?w=1080&q=80',
    name: 'gugong_gate.jpg',
    description: '故宫城门',
  },
  {
    url: 'https://images.unsplash.com/photo-1537981281565-bfba039200d7?w=1080&q=80',
    name: 'gugong_forbidden_city.jpg',
    description: '紫禁城景观',
  },
  {
    url: 'https://images.unsplash.com/photo-1583952812866-8d18acc7f5d8?w=1080&q=80',
    name: 'gugong_courtyard.jpg',
    description: '故宫庭院',
  },
  {
    url: 'https://images.unsplash.com/photo-1570797197190-8e003a00c846?w=1080&q=80',
    name: 'gugong_temple.jpg',
    description: '故宫殿宇',
  },
  {
    url: 'https://images.unsplash.com/photo-1601128533718-e88c3d3b8f7f?w=1080&q=80',
    name: 'gugong_red_walls.jpg',
    description: '故宫红墙',
  },
  {
    url: 'https://images.unsplash.com/photo-1551796813-3a8f7ddfc1ca?w=1080&q=80',
    name: 'gugong_roof.jpg',
    description: '故宫屋顶',
  },
  {
    url: 'https://images.unsplash.com/photo-1587560699334-cc4ff634909a?w=1080&q=80',
    name: 'gugong_corner_tower.jpg',
    description: '故宫角楼',
  },
];

/**
 * 下载单张图片
 */
async function downloadImage(
  imageUrl: string,
  filename: string,
  description: string
): Promise<boolean> {
  try {
    console.log(`📥 下载: ${description}`);

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const filepath = path.join(DOWNLOAD_DIR, filename);
    fs.writeFileSync(filepath, response.data);

    console.log(`   ✅ 成功: ${filename}`);
    return true;
  } catch (error) {
    console.error(`   ❌ 失败: ${error instanceof Error ? error.message : error}`);
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
  console.log(`📊 共 ${GUGONG_IMAGES.length} 张图片\n`);
  console.log('='.repeat(60) + '\n');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < GUGONG_IMAGES.length; i++) {
    const image = GUGONG_IMAGES[i];
    console.log(`[${i + 1}/${GUGONG_IMAGES.length}]`);

    const success = await downloadImage(image.url, image.name, image.description);

    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // 延迟避免请求过快
    if (i < GUGONG_IMAGES.length - 1) {
      await delay(1000);
      console.log('');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ 下载完成!');
  console.log(`   ✅ 成功: ${successCount} 张`);
  console.log(`   ❌ 失败: ${failCount} 张`);
  console.log(`\n📂 文件保存在: ${DOWNLOAD_DIR}`);
  console.log('='.repeat(60));
}

// 运行脚本
main().catch((error) => {
  console.error('\n💥 脚本执行出错:', error);
  process.exit(1);
});
