// Aísla qué ilumina de más la zona junto al ojo de la efe
import { chromium } from 'playwright';
const out = process.argv[2];
const b = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 600 } });
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await p.waitForSelector('#enter-silent:not([disabled])', { timeout: 90000 });
await p.click('#enter-silent'); await p.waitForTimeout(1500);
await p.addStyleTag({ content: '#content, .nav, .score, .cursor, .grain, body::before { opacity: 0 !important; }' });
await p.evaluate(() => { const st = window.__bp.stage, o = st.v.anchors.openBass, C = o.constructor; st.debugCam = { pos: new C(o.x, o.y - 0.12, o.z + 0.22), tgt: o.clone(), fov: 34 }; });
await p.waitForTimeout(900); await p.screenshot({ path: out + '/a-base.png' });
await p.evaluate(() => { const st = window.__bp.stage; st._f = st.fLight.intensity; st.fLight.visible = false; });
await p.waitForTimeout(500); await p.screenshot({ path: out + '/b-nofLight.png' });
await p.evaluate(() => { const st = window.__bp.stage; st.fLight.visible = true; const m = st.v.M.top; m.userData.cc = m.clearcoat; m.clearcoat = 0; m.sheen = 0; });
await p.waitForTimeout(500); await p.screenshot({ path: out + '/c-noCoat.png' });
await p.evaluate(() => { const st = window.__bp.stage; const m = st.v.M.top; m.clearcoat = 0.3; m.sheen = 0.12; m.envMapIntensity = 0; });
await p.waitForTimeout(500); await p.screenshot({ path: out + '/d-noEnv.png' });
await b.close();
