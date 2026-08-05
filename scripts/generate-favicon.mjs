import fs from 'fs';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const SETTINGS_PATH = 'content/settings.json';

async function main() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    console.log('No content/settings.json found - keeping existing favicon files.');
    return;
  }
  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  const faviconField = settings.favicon;
  if (!faviconField) {
    console.log('No custom favicon set in CMS (Cài đặt chung -> Favicon) - keeping existing favicon files.');
    return;
  }
  const localPath = faviconField.replace(/^\//, '');
  if (!fs.existsSync(localPath)) {
    console.warn('Favicon source "' + localPath + '" not found on disk - keeping existing favicon files.');
    return;
  }

  const source = sharp(fs.readFileSync(localPath)).rotate();
  const [png16, png32, png48, png180] = await Promise.all([
    source.clone().resize(16, 16, { fit: 'cover' }).png().toBuffer(),
    source.clone().resize(32, 32, { fit: 'cover' }).png().toBuffer(),
    source.clone().resize(48, 48, { fit: 'cover' }).png().toBuffer(),
    source.clone().resize(180, 180, { fit: 'cover' }).png().toBuffer(),
  ]);

  fs.writeFileSync('favicon-16x16.png', png16);
  fs.writeFileSync('favicon-32x32.png', png32);
  fs.writeFileSync('apple-touch-icon.png', png180);

  const icoBuffer = await pngToIco([png16, png32, png48]);
  fs.writeFileSync('favicon.ico', icoBuffer);

  console.log('Generated favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png from CMS favicon: ' + faviconField);
}

main().catch((err) => {
  console.error('Favicon generation failed:', err);
  process.exit(1);
});
