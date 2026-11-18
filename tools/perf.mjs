// FPS reales tras entrar: node tools/perf.mjs
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForSelector('#enter-silent:not([disabled])', { timeout: 90000 });
await page.click('#enter-silent');
await page.waitForTimeout(3000);
const fps = () => page.evaluate(() => new Promise((res) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 2500) requestAnimationFrame(f); else res(+(n / 2.5).toFixed(1)); }; requestAnimationFrame(f); }));
console.log('hero', await fps());
await page.evaluate(() => { const s = window.__bp.stage; s.renderer.shadowMap.enabled = false; s.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); }); });
await page.waitForTimeout(1500);
console.log('no shadows', await fps());
await page.evaluate(() => { const s = window.__bp.stage; s.composer.passes[1].enabled = false; });
console.log('no shadows, no bloom', await fps());
await browser.close();
