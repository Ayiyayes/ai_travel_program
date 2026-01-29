import sharp from 'sharp';

const MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;
const THUMBNAIL_MAX_BYTES = 600 * 1024;
const THUMBNAIL_MAX_WIDTH = 720;

async function compressJpeg(input: Buffer, options: { maxBytes: number; maxWidth?: number; quality?: number; minQuality?: number }) {
  const { maxBytes, maxWidth, quality = 82, minQuality = 60 } = options;
  let currentQuality = quality;
  let width = maxWidth;

  if (!width) {
    try {
      const meta = await sharp(input).metadata();
      if (meta.width) {
        width = meta.width;
      }
    } catch (error) {
      width = undefined;
    }
  }

  const build = async (q: number, w?: number) => {
    let pipeline = sharp(input).rotate();
    if (w) {
      pipeline = pipeline.resize({ width: w, withoutEnlargement: true });
    }
    return pipeline.jpeg({ quality: q, mozjpeg: true }).toBuffer();
  };

  let output = await build(currentQuality, width);
  while (output.length > maxBytes && currentQuality > minQuality) {
    currentQuality = Math.max(minQuality, currentQuality - 6);
    output = await build(currentQuality, width);
  }

  let resizeWidth = width;
  while (output.length > maxBytes && resizeWidth && resizeWidth > 480) {
    resizeWidth = Math.floor(resizeWidth * 0.85);
    output = await build(currentQuality, resizeWidth);
  }

  return output;
}

async function buildWebp(input: Buffer, options: { maxWidth?: number; quality?: number }) {
  const { maxWidth, quality = 80 } = options;
  let pipeline = sharp(input).rotate();
  if (maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  return pipeline.webp({ quality }).toBuffer();
}

export async function processTemplateImage(input: Buffer) {
  const mainJpeg = await compressJpeg(input, { maxBytes: MAX_ORIGINAL_BYTES, quality: 82 });
  const thumbnailJpeg = await compressJpeg(input, { maxBytes: THUMBNAIL_MAX_BYTES, maxWidth: THUMBNAIL_MAX_WIDTH, quality: 72 });
  const mainWebp = await buildWebp(input, { quality: 80 });
  const thumbnailWebp = await buildWebp(input, { maxWidth: THUMBNAIL_MAX_WIDTH, quality: 72 });

  return {
    mainJpeg,
    thumbnailJpeg,
    mainWebp,
    thumbnailWebp,
  };
}
