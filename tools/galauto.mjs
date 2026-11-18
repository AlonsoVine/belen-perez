// Comprueba el desfile automático de la galería y la pausa con hover
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForSelector('#enter-silent:not([disabled])', { timeout: 90000 });
await p.click('#enter-silent'); await p.waitForTimeout(1500);
const y = await p.evaluate(() => document.getElementById('gallery').getBoundingClientRect().top + scrollY - 250);
await p.evaluate((y) => window.__bp.lenis.scrollTo(y, { immediate: true, force: true }), y);
await p.mouse.move(640, 100); await p.waitForTimeout(1500);
const tx = () => p.evaluate(() => new DOMMatrix(getComputedStyle(document.getElementById('gallery-track')).transform).m41);
const a = await tx(); await p.waitForTimeout(2000); const b2 = await tx();
console.log('sin hover, px en 2s:', (a - b2).toFixed(1), await p.evaluate(() => { const t = document.getElementById('gallery-track'); return [t.style.transform, t.children.length, t.children[15]?.offsetLeft, t.scrollWidth]; }));
await p.mouse.move(640, 500); await p.waitForTimeout(2500);
const c = await tx(); await p.waitForTimeout(1500); const d = await tx();
console.log('con hover, px en 1.5s:', (c - d).toFixed(1));
await b.close();
