/**
 * Generate app icons and installer graphics from LOGO.png
 * Run: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const LOGO = path.join(__dirname, '..', 'LOGO.png');
const ASSETS = path.join(__dirname, '..', 'assets');
const BUILD = path.join(__dirname, '..', 'build');

/**
 * Create a 24-bit BMP file from raw RGB pixel data.
 * BMP rows are bottom-to-top, padded to 4-byte boundaries.
 */
function createBmp(width, height, rgbBuffer) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;
  const buf = Buffer.alloc(fileSize);

  // BMP file header (14 bytes)
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);       // reserved
  buf.writeUInt32LE(54, 10);     // pixel data offset

  // DIB header (BITMAPINFOHEADER, 40 bytes)
  buf.writeUInt32LE(40, 14);     // header size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);  // positive = bottom-up
  buf.writeUInt16LE(1, 26);      // color planes
  buf.writeUInt16LE(24, 28);     // bits per pixel
  buf.writeUInt32LE(0, 30);      // no compression
  buf.writeUInt32LE(pixelDataSize, 34);
  buf.writeInt32LE(2835, 38);    // h resolution (72 DPI)
  buf.writeInt32LE(2835, 42);    // v resolution
  buf.writeUInt32LE(0, 46);      // colors in palette
  buf.writeUInt32LE(0, 50);      // important colors

  // Pixel data (bottom-up, BGR order)
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 3;
    const dstRow = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const si = srcRow + x * 3;
      const di = dstRow + x * 3;
      buf[di] = rgbBuffer[si + 2];     // B
      buf[di + 1] = rgbBuffer[si + 1]; // G
      buf[di + 2] = rgbBuffer[si];     // R
    }
  }
  return buf;
}

async function main() {
  // Ensure directories exist
  fs.mkdirSync(ASSETS, { recursive: true });
  fs.mkdirSync(BUILD, { recursive: true });

  console.log('Generating icons from LOGO.png...');

  // 1. App icon PNG (512x512) for Linux/general use
  await sharp(LOGO)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ASSETS, 'icon.png'));
  console.log('  ✓ assets/icon.png (512x512)');

  // 2. Generate multi-resolution PNGs for ICO
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const tmpPngs = [];
  for (const size of icoSizes) {
    const tmpPath = path.join(ASSETS, `_tmp_${size}.png`);
    await sharp(LOGO)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(tmpPath);
    tmpPngs.push(tmpPath);
  }

  // 3. Create ICO from the multi-res PNG files (dynamic import for ESM module)
  const pngToIco = (await import('png-to-ico')).default;
  const icoBuffer = await pngToIco(tmpPngs);
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), icoBuffer);
  // Clean up tmp PNGs
  for (const f of tmpPngs) fs.unlinkSync(f);
  console.log('  ✓ assets/icon.ico (multi-res: 16,32,48,64,128,256)');

  // 4. Installer sidebar BMP (164x314) - dark branded sidebar
  const sidebarLogoSize = 120;
  const sidebarLogo = await sharp(LOGO)
    .resize(sidebarLogoSize, sidebarLogoSize, { fit: 'contain', background: { r: 24, g: 24, b: 27, alpha: 1 } })
    .png()
    .toBuffer();

  const sidebarRaw = await sharp({
    create: {
      width: 164,
      height: 314,
      channels: 3,
      background: { r: 24, g: 24, b: 27 }
    }
  })
    .composite([{
      input: sidebarLogo,
      left: Math.floor((164 - sidebarLogoSize) / 2),
      top: 40
    }])
    .removeAlpha()
    .raw()
    .toBuffer();
  fs.writeFileSync(path.join(BUILD, 'installerSidebar.bmp'), createBmp(164, 314, sidebarRaw));
  console.log('  ✓ build/installerSidebar.bmp (164x314)');

  // 5. Installer header BMP (150x57) - compact header with logo
  const headerLogoSize = 40;
  const headerLogo = await sharp(LOGO)
    .resize(headerLogoSize, headerLogoSize, { fit: 'contain', background: { r: 24, g: 24, b: 27, alpha: 1 } })
    .png()
    .toBuffer();

  const headerRaw = await sharp({
    create: {
      width: 150,
      height: 57,
      channels: 3,
      background: { r: 24, g: 24, b: 27 }
    }
  })
    .composite([{
      input: headerLogo,
      left: Math.floor((150 - headerLogoSize) / 2),
      top: Math.floor((57 - headerLogoSize) / 2)
    }])
    .removeAlpha()
    .raw()
    .toBuffer();
  fs.writeFileSync(path.join(BUILD, 'installerHeader.bmp'), createBmp(150, 57, headerRaw));
  console.log('  ✓ build/installerHeader.bmp (150x57)');

  // 6. Copy ICO to build dir for installer/uninstaller icons
  fs.copyFileSync(path.join(ASSETS, 'icon.ico'), path.join(BUILD, 'installerIcon.ico'));
  fs.copyFileSync(path.join(ASSETS, 'icon.ico'), path.join(BUILD, 'uninstallerIcon.ico'));
  console.log('  ✓ build/installerIcon.ico');
  console.log('  ✓ build/uninstallerIcon.ico');

  console.log('\nAll icons generated successfully!');
}

main().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
