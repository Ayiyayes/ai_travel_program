import sharp from 'sharp';
import fs from 'fs';

// 遮盖区域配置（背景雕塑的脸部位置）
const maskRegions = [
  {
    x: 0.35,      // 左上角X（百分比）
    y: 0.15,      // 左上角Y（百分比）
    width: 0.30,  // 宽度（百分比）
    height: 0.30  // 高度（百分比）
  }
];

async function generateMaskedImage() {
  try {
    const image = sharp('/tmp/test_image.png');
    const metadata = await image.metadata();
    const { width, height } = metadata;

    console.log(`原始图片尺寸: ${width}x${height}`);

    // 创建遮盖层（SVG）
    const maskRects = maskRegions.map(r => {
      const rectX = Math.round(r.x * width);
      const rectY = Math.round(r.y * height);
      const rectWidth = Math.round(r.width * width);
      const rectHeight = Math.round(r.height * height);
      console.log(`遮盖区域: x=${rectX}, y=${rectY}, width=${rectWidth}, height=${rectHeight}`);
      return `<rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" fill="rgb(128,128,128)" />`;
    }).join('\n');

    const maskSvg = `
      <svg width="${width}" height="${height}">
        ${maskRects}
      </svg>
    `;

    // 将灰色遮盖层合成到原图上
    const maskedBuffer = await image
      .composite([{
        input: Buffer.from(maskSvg),
        blend: 'over'
      }])
      .jpeg({ quality: 90 })
      .toBuffer();

    fs.writeFileSync('/tmp/masked_image.jpg', maskedBuffer);
    console.log('遮盖处理完成: /tmp/masked_image.jpg');
    console.log(`文件大小: ${maskedBuffer.length} bytes`);
  } catch (error) {
    console.error('处理失败:', error.message);
    process.exit(1);
  }
}

generateMaskedImage();
