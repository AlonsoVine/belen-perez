// Primer plano del ojo inferior de la efe grave: node tools/eye.mjs <carpeta>
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForSelector('#enter-silent:not([disabled])', { timeout: 90000 });
await p.click('#enter-silent'); await p.waitForTimeout(1500);
await p.addStyleTag({ content: '#content, .nav, .score, .cursor, .grain, body::before { opacity: 0 !important; }' });
const views = [[0.0, -0.12, 0.22, 34], [0.08, -0.05, 0.12, 40], [-0.1, 0.02, 0.16, 40]];
for (let k = 0; k < views.length; k++) {
  await p.evaluate((v) => {
    const st = window.__bp.stage, o = st.v.anchors.openBass, C = o.constructor;
    st.debugCam = { pos: new C(o.x + v[0], o.y + v[1], o.z + v[2]), tgt: o.clone(), fov: v[3] };
  }, views[k]);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/eye${k}.png` });
}
await b.close();
