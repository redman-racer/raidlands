import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const mediaRoot = join(repositoryRoot, "assets", "media");
const primaryPath = join(mediaRoot, "raidlands-logo.png");
const campaignBackgroundPath = join(mediaRoot, "website-hero-raid-overlook-v4.png");

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function isGeneratedCheckerPixel(data, offset) {
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const minimum = Math.min(red, green, blue);
  const maximum = Math.max(red, green, blue);

  return minimum >= 214 && maximum - minimum <= 18;
}

async function removeConnectedCheckerboard(sourcePath) {
  const normalized = await sharp(sourcePath)
    .resize(1024, 1024, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = normalized;
  const pixelCount = info.width * info.height;
  const background = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const enqueue = (pixel) => {
    if (background[pixel] || !isGeneratedCheckerPixel(data, pixel * 3)) {
      return;
    }

    background[pixel] = 1;
    queue[tail] = pixel;
    tail += 1;
  };

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }

  for (let y = 0; y < info.height; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }

  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);

    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < info.width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - info.width);
    if (y + 1 < info.height) enqueue(pixel + info.width);
  }

  const rgba = Buffer.alloc(pixelCount * 4);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const sourceOffset = pixel * 3;
    const outputOffset = pixel * 4;
    rgba[outputOffset] = data[sourceOffset];
    rgba[outputOffset + 1] = data[sourceOffset + 1];
    rgba[outputOffset + 2] = data[sourceOffset + 2];
    rgba[outputOffset + 3] = background[pixel] ? 0 : 255;
  }

  return sharp(rgba, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  }).png({ compressionLevel: 9 }).toBuffer();
}

async function validatePrimaryLogo() {
  const { data, info } = await sharp(primaryPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let maxX = -1;
  let minY = info.height;
  let maxY = -1;
  let transparentPixels = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];

      if (alpha < 8) {
        transparentPixels += 1;
        continue;
      }

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (transparentPixels < info.width * info.height * 0.2) {
    throw new Error("Primary logo does not contain a genuine transparent background.");
  }

  const artworkCenterX = (minX + maxX) / 2;
  const canvasCenterX = (info.width - 1) / 2;

  if (Math.abs(artworkCenterX - canvasCenterX) > 24) {
    throw new Error(`Primary logo artwork is horizontally off-center by ${Math.round(artworkCenterX - canvasCenterX)} pixels.`);
  }

  return {
    width: info.width,
    height: info.height,
    bounds: { minX, maxX, minY, maxY },
    artworkCenterX,
    canvasCenterX,
    transparentPercent: Math.round((transparentPixels / (info.width * info.height)) * 1000) / 10,
  };
}

function campaignOverlay(width, height, panel, titleY, rateY, detailY) {
  const panelCenter = panel.x + panel.width / 2;

  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#080909" stop-opacity=".9"/>
          <stop offset="1" stop-color="#050505" stop-opacity=".78"/>
        </linearGradient>
        <linearGradient id="orange" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff1c3"/>
          <stop offset=".46" stop-color="#ffc45c"/>
          <stop offset="1" stop-color="#e66e12"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5"/>
          <feOffset dy="5"/>
          <feComponentTransfer><feFuncA type="linear" slope=".9"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="#000" opacity=".22"/>
      <rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" rx="${Math.round(height * 0.018)}" fill="url(#panel)" stroke="#df7118" stroke-width="${Math.max(2, Math.round(height * 0.006))}"/>
      <path d="M${panel.x + panel.width * .08} ${panel.y + panel.height * .08}H${panel.x + panel.width * .92}" stroke="#ff9933" stroke-width="${Math.max(1, Math.round(height * 0.004))}" opacity=".72"/>
      <text x="${panelCenter}" y="${titleY}" text-anchor="middle" font-family="Impact, Haettenschweiler, Arial Narrow Bold, sans-serif" font-size="${Math.round(height * .19)}" font-weight="900" letter-spacing="${Math.round(height * .01)}" fill="#f5f1e8" stroke="#090909" stroke-width="${Math.max(2, Math.round(height * .008))}" paint-order="stroke" filter="url(#shadow)">RAIDLANDS</text>
      <text x="${panelCenter}" y="${rateY}" text-anchor="middle" font-family="Impact, Haettenschweiler, Arial Narrow Bold, sans-serif" font-size="${Math.round(height * .21)}" font-weight="900" letter-spacing="${Math.round(height * .012)}" fill="url(#orange)" stroke="#090909" stroke-width="${Math.max(2, Math.round(height * .008))}" paint-order="stroke" filter="url(#shadow)">10X</text>
      <text x="${panelCenter}" y="${detailY}" text-anchor="middle" font-family="Impact, Haettenschweiler, Arial Narrow Bold, sans-serif" font-size="${Math.round(height * .047)}" font-weight="800" letter-spacing="${Math.round(height * .004)}" fill="#f5f1e8">10X GATHER  •  5X LOOT  •  3X SCRAP</text>
    </svg>`,
  );
}

async function buildCampaignAsset({
  width,
  height,
  logoSize,
  logoLeft,
  logoTop,
  panel,
  titleY,
  rateY,
  detailY,
  output,
  format = "png",
}) {
  const background = await sharp(campaignBackgroundPath)
    .resize(width, height, { fit: "cover", position: "centre" })
    .modulate({ brightness: 0.58, saturation: 0.9 })
    .toBuffer();
  const logo = await sharp(primaryPath)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const composed = sharp(background).composite([
    { input: logo, left: logoLeft, top: logoTop },
    { input: campaignOverlay(width, height, panel, titleY, rateY, detailY) },
  ]);

  if (format === "jpeg") {
    await composed.jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(output);
    return;
  }

  await composed.png({ compressionLevel: 9 }).toFile(output);
}

const importedPrimary = optionValue("--primary-source");

if (importedPrimary) {
  const sourcePath = resolve(importedPrimary);
  const transparentMaster = await removeConnectedCheckerboard(sourcePath);
  await sharp(transparentMaster).toFile(primaryPath);
}

await sharp(primaryPath)
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp({ quality: 94, alphaQuality: 100 })
  .toFile(join(mediaRoot, "raidlands-logo.webp"));

await sharp(primaryPath)
  .resize(164, 207, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(join(mediaRoot, "raidlands-logo-sm.png"));

for (const [filename, width, height] of [
  ["horizontal-logo-10x-med.webp", 1100, 367],
  ["horizontal-logo-10x-sm.webp", 550, 183],
  ["horizontal-logo-10x-xsm.webp", 300, 100],
  ["horizontal-logo-10x-xxsm.webp", 120, 40],
]) {
  await sharp(join(mediaRoot, "horizontal-logo-10x-lrg.webp"))
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(join(mediaRoot, filename));
}

await buildCampaignAsset({
  width: 1024,
  height: 512,
  logoSize: 430,
  logoLeft: -10,
  logoTop: 42,
  panel: { x: 365, y: 75, width: 635, height: 360 },
  titleY: 205,
  rateY: 325,
  detailY: 392,
  output: join(mediaRoot, "rust-server-header-raidlands-10x.png"),
});

await sharp(join(mediaRoot, "rust-server-header-raidlands-10x.png"))
  .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
  .toFile(join(mediaRoot, "rust-server-header-raidlands-10x.jpg"));

await buildCampaignAsset({
  width: 2172,
  height: 724,
  logoSize: 690,
  logoLeft: 0,
  logoTop: 18,
  panel: { x: 680, y: 125, width: 1435, height: 485 },
  titleY: 320,
  rateY: 485,
  detailY: 560,
  output: join(mediaRoot, "voting-site-banner-raidlands-10x.png"),
});

await buildCampaignAsset({
  width: 1200,
  height: 630,
  logoSize: 570,
  logoLeft: -25,
  logoTop: 30,
  panel: { x: 485, y: 110, width: 680, height: 410 },
  titleY: 270,
  rateY: 410,
  detailY: 477,
  output: join(mediaRoot, "og-image.png"),
});

const validation = await validatePrimaryLogo();
console.log(JSON.stringify({
  primary: validation,
  derivatives: [
    "raidlands-logo.webp",
    "raidlands-logo-sm.png",
    "horizontal-logo-10x-med.webp",
    "horizontal-logo-10x-sm.webp",
    "horizontal-logo-10x-xsm.webp",
    "horizontal-logo-10x-xxsm.webp",
    "rust-server-header-raidlands-10x.png",
    "rust-server-header-raidlands-10x.jpg",
    "voting-site-banner-raidlands-10x.png",
    "og-image.png",
  ],
}, null, 2));
