// Comprueba la web compilada servida en una subcarpeta (como GitHub Pages): node tools/subpath.mjs <url> <png>
import { chromium } from 'playwright';
const [url, shot] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const bad = [];
p.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
p.on('pageerror', (e) => bad.push('pageerror ' + e.message));
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForSelector('#enter-silent:not([disabled])', { timeout: 90000 });
await p.click('#enter-silent'); await p.waitForTimeout(2500);
await p.screenshot({ path: shot });
console.log(bad.length ? bad.join('\n') : 'sin errores');
await b.close();
