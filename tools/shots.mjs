// Key-view screenshots at fixed scroll positions: node tools/shots.mjs <dir> [url]
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2];
const url = process.argv[3] || 'http://localhost:5173/';
fs.mkdirSync(out, { recursive: true });
const views = [
  ['hero', 'hero', 0], ['about', 'about', 0.5], ['fhole-approach', 'about', 1], ['inside-entry', 'inside', 0.06],
  ['inside-mid', 'inside', 0.36], ['inside-label', 'inside', 0.72], ['strings', 'strings', 0.5],
  ['project', 'project', 0.5], ['gallery', 'listen', 0.95], ['contact', 'contact', 0.4], ['coda', 'coda-space', 0.55],
];
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'commit' });
await page.waitForSelector('#enter-silent:not([disabled])', { timeout: 120000 });
await page.click('#enter-silent');
await page.waitForTimeout(5000);
for (const [name, id, f] of views) {
  const y = await page.evaluate(([id, f]) => {
    const el = document.getElementById(id);
    return el.getBoundingClientRect().top + window.scrollY + f * Math.max(el.offsetHeight - innerHeight, 0);
  }, [id, f]);
  await page.evaluate((y) => window.__bp.lenis.scrollTo(y, { immediate: true, force: true }), y);
  // espera a que scroll suavizado y cámara converjan (no depende de los fps)
  await page.waitForFunction((y) => { const st = window.__bp.stage; return Math.abs(st.scrollY - y) < 2 && st.cur && Math.abs(st.smoothY - st.scrollY) < 1 && st.cur.pos.distanceTo(st.rig.pos) < 0.002 && Math.abs(st.cur.fov - st.rig.fov) < 0.01; }, y, { timeout: 60000, polling: 250 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${name}.png` });
}
await browser.close();
console.log('ok');
