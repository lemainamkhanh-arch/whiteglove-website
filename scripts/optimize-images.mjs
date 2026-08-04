import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Any image wider than this gets downscaled (keeps aspect ratio).
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 78;
const PNG_QUALITY = 80;
// Folders to scan (assets/ holds site images; CMS also uploads new blog
// images under assets/blog/<slug>/, which is nested inside assets/ already).
const TARGETS = ['assets'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jpe?g|png)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

async function optimizeOne(file) {
  const original = fs.readFileSync(file);
  const image = sharp(original, { failOn: 'none' }).rotate();
  const meta = await image.metadata();
  let pipeline = image;
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }
  const ext = path.extname(file).toLowerCase();
  const optimized = ext === '.png'
    ? await pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 }).toBuffer()
    : await pipeline.jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true }).toBuffer();

  if (optimized.length < original.length) {
    fs.writeFileSync(file, optimized);
    console.log(`optimized ${file}: ${(original.length / 1024).toFixed(0)}KB -> ${(optimized.length / 1024).toFixed(0)}KB`);
  } else {
    console.log(`skip ${file}: already optimal (${(original.length / 1024).toFixed(0)}KB)`);
  }
}

(async () => {
  const files = TARGETS.flatMap((dir) => (fs.existsSync(dir) ? walk(dir) : []));
  console.log(`Found ${files.length} image(s) to check.`);
  for (const file of files) {
    try {
      await optimizeOne(file);
    } catch (err) {
      console.error(`failed to optimize ${file}:`, err.message);
    }
  }
})();
