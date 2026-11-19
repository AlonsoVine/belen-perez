// Compara configuraciones de sombra en la vista inicial: node tools/shadowtest.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:5173/', { waitUntil: 'commit' });
await page.waitForSelector('#enter-silent:not([disabled])', { timeout: 120000 });
await page.click('#enter-silent');
await page.waitForTimeout(5000);
const measure = () => page.evaluate(() => new Promise((res) => { const d = []; let l = performance.now(); const s = l; const f = (t) => { d.push(t - l); l = t; if (t - s < 3000) requestAnimationFrame(f); else { d.shift(); const o = [...d].sort((a, b) => a - b); res({ fps: +(1000 / (d.reduce((a, b) => a + b) / d.length)).toFixed(1), p95: +o[Math.floor(o.length * 0.95)].toFixed(1), max: +o[o.length - 1].toFixed(1) }); } }; requestAnimationFrame(f); }));
const set = (cfg) => page.evaluate((cfg) => {
  const st = window.__bp.stage;
  const ks = st.key.shadow;
  if (cfg.size && ks.mapSize.x !== cfg.size) { ks.mapSize.set(cfg.size, cfg.size); ks.map?.dispose(); ks.map = null; }
  st.__mode = cfg.mode;
  if (!st.__patched) { st.__patched = true; const u = st.updateShadows.bind(st); st.updateShadows = (a, b) => { u(a, b); if (st.__mode === 'every') ks.needsUpdate = true; if (st.__mode === 'none') ks.needsUpdate = false; }; }
}, cfg);
const cfgs = [['every2048', { mode: 'every', size: 2048 }], ['alt2048', { mode: 'alt', size: 2048 }], ['none', { mode: 'none', size: 2048 }], ['every1024', { mode: 'every', size: 1024 }], ['alt1024', { mode: 'alt', size: 1024 }]];
for (let round = 0; round < 2; round++) for (const [n, c] of cfgs) { await set(c); await page.waitForTimeout(1200); console.log(round, n, JSON.stringify(await measure())); }
await browser.close();
