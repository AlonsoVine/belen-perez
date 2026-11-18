import { chromium } from 'playwright';
const args = process.argv[2] === 'gpu' ? ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() !== 'debug') console.log(`[${m.type()}]`, m.text()); });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
const t0 = Date.now();
const info = await page.evaluate(async () => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const r = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a';
  let frames = 0; const s = performance.now();
  await new Promise((res) => { const f = () => { frames++; if (performance.now() - s < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  return { r, fps: frames / 3 };
});
console.log(info, 'ms', Date.now() - t0);
await browser.close();
