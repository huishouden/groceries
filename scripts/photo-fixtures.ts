/**
 * Draws the invented product photos that Add by photo is tested with (e2e/fixtures/photos/): simple
 * labelled packages of well-known national brands, rendered from HTML in Chromium. No real photo
 * is ever committed; run again after changing a drawing:
 *
 *   bun scripts/photo-fixtures.ts
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dir, '..', 'e2e', 'fixtures', 'photos');

/** EAN-13 bars for a 13-digit code (the digits are checked by the reader, not here). */
function ean13Bars(code: string): string {
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
  const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
  const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  const d = code.split('').map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  bits += '101';
  const w = 2;
  const rects = bits
    .split('')
    .map((b, i) => (b === '1' ? `<rect x="${(i + 10) * w}" y="0" width="${w}" height="120"/>` : ''))
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(bits.length + 20) * w}" height="150" style="background:#fff"><g fill="#000">${rects}</g><text x="50%" y="144" font-family="monospace" font-size="20" text-anchor="middle">${code}</text></svg>`;
}

const creamer = `
  <div class="bottle" style="--c:#f3efe6;--cap:#7a3b2e">
    <div class="cap"></div>
    <div class="body">
      <div class="label" style="background:#6b2d2a;color:#fff">
        <div style="font:italic 800 46px Georgia;letter-spacing:-1px">Coffee mate</div>
        <div style="font:600 18px Arial;margin-top:2px">NESTLÉ</div>
        <div style="font:700 30px Georgia;margin-top:18px;color:#f6d7a8">Italian Sweet Crème</div>
        <div style="font:800 26px Arial;margin-top:10px;background:#fff;color:#6b2d2a;padding:4px 10px;border-radius:6px;display:inline-block">ZERO SUGAR</div>
        <div style="font:600 18px Arial;margin-top:12px">COFFEE CREAMER</div>
        <div style="font:500 15px Arial;margin-top:22px">28.9 FL OZ (1.8 PT) 854 mL</div>
      </div>
    </div>
  </div>`;

const whipped = `
  <div class="can">
    <div class="nozzle"></div>
    <div class="shoulder"></div>
    <div class="canbody">
      <div style="font:900 52px Arial;color:#c8102e;transform:rotate(-6deg);margin-top:40px">Reddi-wip</div>
      <div style="font:700 24px Arial;color:#1f3a93;margin-top:22px">ORIGINAL</div>
      <div style="font:600 17px Arial;color:#333;margin-top:10px">WHIPPED TOPPING<br/>MADE WITH REAL CREAM</div>
      <div style="font:500 15px Arial;color:#333;margin-top:60px">NET WT 13 OZ (368g)</div>
    </div>
  </div>`;

const spaghetti = `
  <div class="box" style="background:#1f4fa3;width:200px;height:420px">
    <div style="background:#e63329;color:#fff;font:900 40px Georgia;padding:10px;border-radius:50%/40%;margin:30px 12px">Barilla</div>
    <div style="color:#fff;font:800 30px Arial;margin-top:30px">Spaghetti</div>
    <div style="color:#fff;font:600 16px Arial;margin-top:8px">n.5</div>
    <div style="color:#fff;font:500 14px Arial;margin-top:120px">NET WT 16 OZ (1 LB) 454g</div>
  </div>`;

const ketchup = `
  <div class="bottle" style="--c:#b3121b;--cap:#ffffff">
    <div class="cap"></div>
    <div class="body">
      <div class="label" style="background:#fff;color:#111;border-radius:50% 50% 12px 12px / 20% 20% 12px 12px">
        <div style="font:900 50px Georgia;color:#111">HEINZ</div>
        <div style="font:700 26px Arial;color:#b3121b;margin-top:10px">TOMATO KETCHUP</div>
        <div style="font:500 15px Arial;margin-top:30px">32 OZ (2 LB) 907g</div>
      </div>
    </div>
  </div>`;

const nutella = (code: string) => `
  <div class="jar">
    <div class="lid"></div>
    <div class="jarbody">
      <div style="font:900 54px Arial;margin-top:28px"><span style="color:#111">n</span><span style="color:#e2001a">utella</span></div>
      <div style="font:600 16px Arial;color:#5a3a22;margin-top:8px">HAZELNUT SPREAD WITH COCOA</div>
      <div style="margin-top:22px;display:inline-block;padding:6px;background:#fff">${ean13Bars(code)}</div>
    </div>
  </div>`;

const STYLE = `
  body{margin:0;width:1280px;height:960px;display:flex;align-items:flex-end;justify-content:center;gap:70px;
    background:linear-gradient(#ece5d8 0 62%, #b9a184 62% 100%);font-family:Arial;padding-bottom:70px;box-sizing:border-box}
  .bottle{display:flex;flex-direction:column;align-items:center}
  .bottle .cap{width:90px;height:60px;background:var(--cap);border-radius:10px 10px 4px 4px}
  .bottle .body{width:260px;height:560px;background:var(--c);border-radius:80px 80px 30px 30px;display:flex;align-items:center;justify-content:center;box-shadow:inset -20px 0 30px rgba(0,0,0,.12)}
  .bottle .label{width:240px;padding:26px 8px;text-align:center;border-radius:12px}
  .can{display:flex;flex-direction:column;align-items:center}
  .can .nozzle{width:40px;height:50px;background:#ddd;border-radius:6px 6px 0 0}
  .can .shoulder{width:150px;height:50px;background:#c9ccd1;border-radius:60px 60px 0 0}
  .can .canbody{width:220px;height:480px;background:linear-gradient(90deg,#e9ecef,#fff 40%,#d6d9dd);text-align:center;border-radius:6px;box-shadow:0 0 0 2px #bbb inset}
  .box{text-align:center;border-radius:4px;box-shadow:inset -14px 0 20px rgba(0,0,0,.2)}
  .jar{display:flex;flex-direction:column;align-items:center}
  .jar .lid{width:300px;height:70px;background:#fff;border:2px solid #ccc;border-radius:10px}
  .jar .jarbody{width:340px;height:430px;background:#fff;border-radius:30px;text-align:center;border:2px solid #ddd;box-shadow:inset -20px 0 30px rgba(0,0,0,.08)}
`;

/** Each photo: its products, side by side on a counter. */
const PHOTOS: Record<string, string[]> = {
  creamer: [creamer],
  whipped: [whipped],
  'creamer-and-whipped': [creamer, whipped],
  'three-products': [spaghetti, ketchup, whipped],
  barcode: [nutella('3017620422003')],
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
for (const [name, products] of Object.entries(PHOTOS)) {
  await page.setContent(`<!doctype html><style>${STYLE}</style><body>${products.join('')}</body>`);
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 85 });
  console.log(`${name}.jpg`);
}
await browser.close();
