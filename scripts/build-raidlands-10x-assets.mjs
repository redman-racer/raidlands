import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const mediaRoot = join(repositoryRoot, "assets", "media");

function svg(width, height, body) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff5d4"/>
          <stop offset="0.48" stop-color="#ffc663"/>
          <stop offset="1" stop-color="#dd6f12"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
          <feOffset dy="4"/>
          <feComponentTransfer><feFuncA type="linear" slope=".9"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      ${body}
    </svg>`,
  );
}

async function compositeInPlace(filename, overlay) {
  const input = join(mediaRoot, filename);
  const output = await sharp(input).composite([{ input: overlay }]).toBuffer();
  await writeFile(input, output);
}

const primaryOverlay = svg(
  1024,
  1024,
  `<path d="M345 657H679L670 716H354Z" fill="#090909" stroke="#4d4640" stroke-width="2.5"/>
   <path d="M361 661H663" stroke="#de7117" stroke-width="2" opacity=".8"/>
   <text x="512" y="710" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="61" font-weight="900" letter-spacing="4" fill="url(#gold)" stroke="#fff1cf" stroke-width="1.5" paint-order="stroke" filter="url(#shadow)">10X</text>`,
);
if (process.argv.includes("--restore-primary-from-head")) {
  const originalPrimary = execFileSync("git", ["show", "HEAD:assets/media/raidlands-logo.png"], {
    cwd: repositoryRoot,
    maxBuffer: 8 * 1024 * 1024,
  });
  const restoredPrimary = await sharp(originalPrimary).composite([{ input: primaryOverlay }]).png().toBuffer();
  await writeFile(join(mediaRoot, "raidlands-logo.png"), restoredPrimary);
} else {
  await compositeInPlace("raidlands-logo.png", primaryOverlay);
}

await sharp(join(mediaRoot, "raidlands-logo.png"))
  .resize(512, 512, { fit: "contain" })
  .webp({ quality: 94, alphaQuality: 100 })
  .toFile(join(mediaRoot, "raidlands-logo.webp"));

await sharp(join(mediaRoot, "raidlands-logo.png"))
  .resize(164, 207, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(join(mediaRoot, "raidlands-logo-sm.png"));

const horizontalOverlay = svg(
  2172,
  724,
  `<rect x="1135" y="414" width="493" height="112" rx="8" fill="#080909"/>
   <path d="M1160 420H1604" stroke="#e37719" stroke-width="3" opacity=".7"/>
   <text x="1382" y="520" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="126" font-weight="900" letter-spacing="7" fill="url(#gold)" stroke="#fff1cf" stroke-width="2" paint-order="stroke" filter="url(#shadow)">10X</text>`,
);
if (process.argv.includes("--restore-horizontal-from-head")) {
  const originalHorizontal = execFileSync("git", ["show", "HEAD:assets/media/horizontal-logo-lrg.webp"], {
    cwd: repositoryRoot,
    maxBuffer: 8 * 1024 * 1024,
  });
  await sharp(originalHorizontal)
    .composite([{ input: horizontalOverlay }])
    .webp({ quality: 94, alphaQuality: 100 })
    .toFile(join(mediaRoot, "horizontal-logo-10x-lrg.webp"));
}

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

const serverHeaderOverlay = svg(
  1024,
  512,
  `<path d="M133 315H291L278 376H146Z" fill="#080909" stroke="#4d4640" stroke-width="2"/>
   <path d="M151 321H273" stroke="#de7117" stroke-width="1.5"/>
   <text x="212" y="359" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="38" font-weight="900" letter-spacing="2" fill="url(#gold)" stroke="#fff1cf" stroke-width=".8" paint-order="stroke">10X</text>
   <rect x="392" y="249" width="304" height="67" rx="4" fill="#080909"/>
   <text x="544" y="306" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="57" font-weight="900" letter-spacing="2" fill="#f4f1e9" stroke="#090909" stroke-width="2" paint-order="stroke" filter="url(#shadow)">10X PVP</text>
   <rect x="387" y="324" width="624" height="50" fill="#090909"/>
   <text x="699" y="365" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="34" font-weight="800" letter-spacing="1" fill="#f4f1e9">KITS | TP | CLANS | FAST CRAFTING</text>
   <rect x="387" y="378" width="622" height="38" fill="#090909"/>
   <text x="699" y="408" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="29" font-weight="800" letter-spacing="1.5" fill="#f07d23">GATHER. BUILD. RAID. REPEAT.</text>`,
);
await compositeInPlace("rust-server-header-raidlands-10x.png", serverHeaderOverlay);
await sharp(join(mediaRoot, "rust-server-header-raidlands-10x.png"))
  .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
  .toFile(join(mediaRoot, "rust-server-header-raidlands-10x.jpg"));

const votingBannerOverlay = svg(
  2172,
  724,
  `<rect x="1546" y="281" width="549" height="140" rx="8" fill="#090909"/>
   <text x="1820" y="394" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="105" font-weight="900" letter-spacing="4" fill="url(#gold)" stroke="#fff1cf" stroke-width="1.5" paint-order="stroke" filter="url(#shadow)">10X PVP</text>`,
);
await compositeInPlace("voting-site-banner-raidlands-10x.png", votingBannerOverlay);

console.log("Raidlands 10X logo, responsive logo, server header, and voting banner assets generated.");
