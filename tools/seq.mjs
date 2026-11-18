// Secuencia de fotogramas de un tramo del recorrido, con scroll continuo (como un usuario):
// node tools/seq.mjs <carpeta> <id0> <f0> <id1> <f1> [n]
import { chromium } from 'playwright';
import fs from 'node:fs';

const [out, id0, f0, id1, f1, nArg] = process.argv.slice(2);
const n = +(nArg || 12);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForSelector('#enter-silent:not([disabled])', { timeout: 60000 });
await page.click('#enter-silent');
await page.waitForTimeout(2500);
const yOf = (id, f) => page.evaluate(([id, f]) => {
  const el = document.getElementById(id);
  const top = el.getBoundingClientRect().top + window.scrollY;
  return top + f * Math.max(el.offsetHeight - innerHeight, el.offsetHeight * 0.6);
}, [id, +f]);
const y0 = await yOf(id0, f0), y1 = await yOf(id1, f1);
await page.evaluate((y) => window.__bp.lenis.scrollTo(y, { immediate: true, force: true }), y0);
await page.waitForTimeout(1500);
for (let k = 0; k <= n; k++) {
  const y = y0 + ((y1 - y0) * k) / n;
  await page.evaluate((y) => window.__bp.lenis.scrollTo(y, { duration: 0.5 }), y);
  await page.waitForTimeout(650);
  const info = await page.evaluate(() => { const s = window.__bp.stage; return { dip: s.final.uniforms.uDip.value.toFixed(2), inside: s.insideK?.toFixed(2) }; });
  await page.screenshot({ path: `${out}/${String(k).padStart(2, '0')}.png` });
  console.log(k, JSON.stringify(info));
}
await browser.close();
