import fs from "fs";
import path from "path";
import { deflateSync } from "zlib";

function createPNG(size: number): Buffer {
  const width = size;
  const height = size;

  function crc32(data: Uint8Array): number {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        if (c & 1) c = 0xEDB88320 ^ ((c >>> 1) & 0x7FFFFFFF);
        else c = (c >>> 1) & 0x7FFFFFFF;
      }
      table[n] = c;
    }
    let crc = -1;
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xFF] ^ ((crc >>> 8) & 0x00FFFFFF);
    }
    return (crc ^ -1) >>> 0;
  }

  function writeU32BE(buf: Buffer, val: number, off: number) {
    buf[off] = (val >>> 24) & 0xFF;
    buf[off+1] = (val >>> 16) & 0xFF;
    buf[off+2] = (val >>> 8) & 0xFF;
    buf[off+3] = val & 0xFF;
  }

  function makeChunk(type: string, data: Buffer): Buffer {
    const chunk = Buffer.alloc(4 + 4 + data.length + 4);
    writeU32BE(chunk, data.length, 0);
    chunk.write(type, 4, 4, "ascii");
    data.copy(chunk, 8);
    const crcData = new Uint8Array(chunk.buffer, chunk.byteOffset + 4, 4 + data.length);
    writeU32BE(chunk, crc32(crcData), 8 + data.length);
    return chunk;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  writeU32BE(ihdr, width, 0);
  writeU32BE(ihdr, height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = Buffer.alloc(height * (1 + width * 4));
  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOff = y * (1 + width * 4);
    rawData[rowOff] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const off = rowOff + 1 + x * 4;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r - 0.5) {
        rawData[off] = 59;   // R
        rawData[off+1] = 130; // G
        rawData[off+2] = 246; // B
        rawData[off+3] = 255; // A
      } else if (dist <= r + 0.5) {
        const alpha = Math.max(0, Math.min(1, r + 0.5 - dist));
        rawData[off] = 59;
        rawData[off+1] = 130;
        rawData[off+2] = 246;
        rawData[off+3] = Math.round(alpha * 255);
      } else {
        rawData[off] = 0;
        rawData[off+1] = 0;
        rawData[off+2] = 0;
        rawData[off+3] = 0;
      }
    }
  }

  // Draw white pen icon in center
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x + 0.5 - cx) / (width * 0.3);
      const ny = (y + 0.5 - cy) / (height * 0.3);
      const cos45 = 0.7071;
      const rotX = nx * cos45 + ny * cos45;
      const rotY = -nx * cos45 + ny * cos45;

      const inBody = Math.abs(rotX) < 0.22 && rotY > -0.55 && rotY < 0.35;
      const inTip = rotY >= 0.35 && rotY < 0.65 && Math.abs(rotX) < 0.22 * (1 - (rotY - 0.35) / 0.30);

      if (inBody || inTip) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= r - 0.5) {
          const off = y * (1 + width * 4) + 1 + x * 4;
          rawData[off] = 255;
          rawData[off+1] = 255;
          rawData[off+2] = 255;
          rawData[off+3] = 255;
        }
      }
    }
  }

  const compressed = deflateSync(rawData);
  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(process.cwd(), "extension", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png = createPNG(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${png.length} bytes)`);
}

console.log("Icons generated successfully!");
