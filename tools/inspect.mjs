// Primeros planos del modelo con cámara libre: node tools/inspect.mjs <carpeta>
import { chromium } from 'playwright';
import fs from 'node:fs';

const out = process.argv[2] || 'inspect';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForSelector('#enter-silent:not([disabled])', { timeout: 60000 });
await page.click('#enter-silent');
await page.waitForTimeout(1500);
// oculta la interfaz para ver sólo el 3D
await page.addStyleTag({ content: '#content, .nav, .score, .cursor, .grain { opacity: 0 !important; }' });

const views = {
  front: { pos: [0, 0.9, 9], tgt: [0, 0.9, 0], fov: 38 },
  threeq: { pos: [3.2, 1.4, 4.6], tgt: [0, 0.6, 0], fov: 38 },
  side: { pos: [7, 1.0, 0.2], tgt: [0, 1.0, 0], fov: 40 },
  back: { pos: [-1.5, 0.8, -8], tgt: [0, 0.8, 0], fov: 38 },
  headSide: { pos: [-2.2, 3.7, 0.15], tgt: [0, 3.65, 0.12], fov: 32 },
  headFront: { pos: [0.6, 4.6, 2.1], tgt: [0, 3.6, 0.2], fov: 32 },
  bridge: { pos: [0.9, -0.55, 1.15], tgt: [0, -0.17, 0.5], fov: 34 },
  fingerboard: { pos: [0.7, 1.6, 1.4], tgt: [0, 1.4, 0.45], fov: 38 },
  neckBack: { pos: [-0.9, 2.4, -1.2], tgt: [0, 2.3, 0.1], fov: 40 },
  tail: { pos: [0.7, -1.9, 1.3], tgt: [0, -1.1, 0.35], fov: 36 },
  ribs: { pos: [2.4, -0.2, 0.3], tgt: [0.6, -0.2, 0], fov: 38 },
  fhole: { pos: [-0.65, -0.3, 1.0], tgt: [-0.42, -0.1, 0.25], fov: 34 },
  inside: { pos: [0.08, -1.32, -0.03], tgt: [-0.12, 0.7, 0.05], fov: 70 },
  headBack: { pos: [0.5, 3.9, -1.7], tgt: [0, 3.65, 0.15], fov: 34 },
  headBack2: { pos: [-1.3, 4.6, -0.9], tgt: [0, 3.7, 0.15], fov: 34 },
  joint: { pos: [1.6, 1.85, 0.5], tgt: [0, 1.75, 0.2], fov: 34 },
  label: { pos: [-0.12, 0.25, 0.06], tgt: [-0.42, -0.14, -0.27], fov: 58 },
};
const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(views);
for (const name of only) {
  const v = views[name];
  await page.evaluate((v) => {
    const st = window.__bp.stage;
    st.debugCam = { pos: new st.camera.position.constructor(...v.pos), tgt: new st.camera.position.constructor(...v.tgt), fov: v.fov };
    st.insideOverride = v.inside;
  }, v);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
}
fs.writeFileSync(`${out}/console.log`, logs.join('\n'));
console.log(logs.filter((l) => !l.includes('[debug]')).slice(0, 20).join('\n'));
await browser.close();
