import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const [, , inputArgument, outputArgument] = process.argv;
if (!inputArgument || !outputArgument) {
  console.error("Usage: node scripts/create-leaderboard-hdri.mjs <input-image> <output.hdr>");
  process.exit(1);
}

const inputPath = resolve(inputArgument);
const outputPath = resolve(outputArgument);
const { data, info } = await sharp(inputPath)
  .removeAlpha()
  .toColourspace("srgb")
  .raw()
  .toBuffer({ resolveWithObject: true });

function srgbToLinear(value) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function reconstructedRadiance(value) {
  // The generated source is display-referred. An inverse Reinhard curve restores
  // localized practical lights above 1.0 while keeping the dark arena restrained.
  const limited = Math.min(value, 0.985);
  return (limited / Math.max(1 - limited, 0.015)) * 0.72;
}

function toRgbe(red, green, blue) {
  const brightest = Math.max(red, green, blue);
  if (brightest < 1e-32) return [0, 0, 0, 0];
  const exponent = Math.ceil(Math.log2(brightest));
  const scale = 256 / (2 ** exponent);
  return [
    Math.min(255, Math.round(red * scale)),
    Math.min(255, Math.round(green * scale)),
    Math.min(255, Math.round(blue * scale)),
    exponent + 128,
  ];
}

function encodeChannel(channel) {
  const packets = [];
  let cursor = 0;
  while (cursor < channel.length) {
    let run = 1;
    while (cursor + run < channel.length && run < 127 && channel[cursor + run] === channel[cursor]) run += 1;
    if (run >= 4) {
      packets.push(Buffer.from([128 + run, channel[cursor]]));
      cursor += run;
      continue;
    }

    const literalStart = cursor;
    cursor += run;
    while (cursor < channel.length && cursor - literalStart < 128) {
      let nextRun = 1;
      while (cursor + nextRun < channel.length && nextRun < 127 && channel[cursor + nextRun] === channel[cursor]) nextRun += 1;
      if (nextRun >= 4 || cursor - literalStart + nextRun > 128) break;
      cursor += nextRun;
    }
    const literalLength = cursor - literalStart;
    packets.push(Buffer.from([literalLength]), Buffer.from(channel.subarray(literalStart, cursor)));
  }
  return packets;
}

const scanlines = [];
for (let y = 0; y < info.height; y += 1) {
  const channels = Array.from({ length: 4 }, () => new Uint8Array(info.width));
  for (let x = 0; x < info.width; x += 1) {
    const offset = (y * info.width + x) * info.channels;
    const rgbe = toRgbe(
      reconstructedRadiance(srgbToLinear(data[offset])),
      reconstructedRadiance(srgbToLinear(data[offset + 1])),
      reconstructedRadiance(srgbToLinear(data[offset + 2])),
    );
    for (let channel = 0; channel < 4; channel += 1) channels[channel][x] = rgbe[channel];
  }
  scanlines.push(Buffer.from([2, 2, info.width >> 8, info.width & 0xff]));
  channels.forEach((channel) => scanlines.push(...encodeChannel(channel)));
}

const header = Buffer.from(
  `#?RADIANCE\n# Raidlands generated panorama; linear highlights reconstructed from display-referred source\nFORMAT=32-bit_rle_rgbe\n\n-Y ${info.height} +X ${info.width}\n`,
  "ascii",
);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.concat([header, ...scanlines]));
console.log(`Wrote ${info.width}x${info.height} Radiance HDR to ${outputPath}`);
