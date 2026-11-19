// CPU cost of stage.render() and draw calls at several scroll positions: node tools/cost.mjs
import { chromium } from 'playwright';
const views = [['hero', 'hero', 0], ['about', 'about', 0.5], ['inside', 'inside', 0.36], ['strings', 'strings', 0.5], ['gallery', 'listen', 0.95], ['coda', 'coda-space', 0.55]];
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(process.argv[2] || 'http://localhost:5173/', { waitUntil: 'commit' });
await page.waitForSelector('#enter-silent:not([disabled])', { timeout: 120000 });
await page.click('#enter-silent');
await page.waitForTimeout(5000);
await page.evaluate(() => {
  const st = window.__bp.stage, c = st.composer, orig = c.render.bind(c);
  window.__ms = [];
  c.render = (dt) => { const t = performance.now(); orig(dt); window.__ms.push(performance.now() - t); };
});
for (const [name, id, f] of views) {
  const y = await page.evaluate(([id, f]) => { const el = document.getElementById(id); return el.getBoundingClientRect().top + scrollY + f * Math.max(el.offsetHeight - innerHeight, 0); }, [id, f]);
  await page.evaluate((y) => window.__bp.lenis.scrollTo(y, { immediate: true, force: true }), y);
  await page.waitForTimeout(2500);
  await page.evaluate(() => (window.__ms.length = 0));
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const m = window.__ms.slice().sort((a, b) => a - b), i = window.__bp.stage.renderer.info;
    return { n: m.length, cpuMed: m.length ? +m[m.length >> 1].toFixed(2) : -1, cpuMax: m.length ? +m[m.length - 1].toFixed(1) : -1, calls: i.render.calls, tris: i.render.triangles, progs: i.programs.length };
  });
  console.log(name, JSON.stringify(r));
}
await browser.close();
