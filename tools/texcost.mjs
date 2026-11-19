// Tiempo de las texturas procedurales de src/textures.js: node tools/texcost.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('response', (r) => { if (r.status() >= 400) console.log(r.status(), r.url()); });
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
const r = await p.evaluate(async () => {
  const m = await import('/src/textures.js');
  const out = {};
  for (const [k, f] of Object.entries(m)) { if (typeof f !== 'function') continue; const t = performance.now(); try { f(); } catch (e) { out[k] = 'err ' + e.message; continue; } out[k] = +(performance.now() - t).toFixed(1); }
  return out;
});
console.log(JSON.stringify(r));
await b.close();
