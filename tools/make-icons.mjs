// 앱 아이콘(PNG)을 게임 안 햄버거 도트로 만든다. 외부 이미지·패키지 없이 Node 내장 zlib 만 쓴다.
// 실행: npm run icons  →  public/icons/icon-{180,192,512}.png
import { writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { BURGER } from '../public/js/sprites/items.js';

const palette = JSON.parse(readFileSync(new URL('../public/data/palette.json', import.meta.url), 'utf8'));
const color = Object.fromEntries(palette.colors.map((c) => [c.key, c.hex]));
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// 바탕: 밝은 바닥 베이지, 테두리 없이 (가장자리는 기기가 둥글게 자른다)
const BACKGROUND = rgb(color.f);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  // 도트가 번지지 않게 정수 배율, 가운데에 (마스크로 잘려도 남도록 60% 안팎)
  const scale = Math.floor((size * 0.62) / 16);
  const off = Math.floor((size - 16 * scale) / 2);
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // 필터 없음
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x - off) / scale);
      const sy = Math.floor((y - off) / scale);
      const key = x >= off && y >= off && sx < 16 && sy < 16 ? BURGER[sy][sx] : '.';
      const [r, g, b] = key === palette.transparent ? BACKGROUND : rgb(color[key]);
      raw.set([r, g, b], row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8비트 RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [180, 192, 512]) {
  writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), png(size));
  console.log(`icon-${size}.png`);
}
