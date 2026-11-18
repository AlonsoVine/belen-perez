// Capturas automáticas del recorrido: node tools/shoot.mjs <carpeta> [ancho] [alto]
import { chromium } from 'playwright';
import fs from 'node:fs';

const out = process.argv[2] || 'shots';
const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/00-loader.png` });
await page.waitForSelector('#enter-silent:not([disabled])', { timeout: 30000 });
await page.click('#enter-silent');
await page.waitForTimeout(4200);

// Puntos del recorrido: [sección, fracción dentro de la sección]
const points = [
  ['hero', 0], ['about', 0.15], ['about', 0.5], ['about', 0.95], ['inside', 0.05], ['inside', 0.25], ['inside', 0.45],
  ['inside', 0.7], ['inside', 0.9], ['strings', 0.15], ['strings', 0.6], ['project', 0.5], ['listen', 0.2], ['listen', 0.6], ['contact', 0.2], ['contact', 0.75],
];
let n = 1;
for (const [id, f] of points) {
  await page.evaluate(([id, f]) => {
    const el = document.getElementById(id);
    const top = el.getBoundingClientRect().top + window.scrollY;
    const y = top + f * Math.max(el.offsetHeight - innerHeight, el.offsetHeight * 0.6);
    window.__bp.lenis.scrollTo(y, { immediate: true, force: true });
  }, [id, f]);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/${String(n++).padStart(2, '0')}-${id}-${f}.png` });
}
fs.writeFileSync(`${out}/console.log`, logs.join('\n'));
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
