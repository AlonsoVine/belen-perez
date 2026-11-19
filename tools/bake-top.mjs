// Hornea la tapa del violín: máscara de las efes (alpha) + color con el filo corregido.
// Requiere el servidor de desarrollo en :5173.  node tools/bake-top.mjs  &&  python tools/optimize-assets.py
// Entradas: tools/raw/top.jpg y tools/raw/top-mask.png (las genera tools/prep-violin.mjs).
// Salidas: public/tex/top-alpha.png y public/tex/top.png (luego optimize-assets.py lo pasa a top.webp).
import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173/?bake', { waitUntil: 'commit' });
await page.waitForFunction(() => window.__bake && window.__bake.alpha && window.__bake.top, null, { timeout: 120000 });
const out = await page.evaluate(() => ({ alpha: window.__bake.alpha.toDataURL('image/png'), top: window.__bake.top.toDataURL('image/png') }));
const save = (f, u) => { fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); console.log(f, fs.statSync(f).size); };
save('public/tex/top-alpha.png', out.alpha);
save('public/tex/top.png', out.top);
await browser.close();
