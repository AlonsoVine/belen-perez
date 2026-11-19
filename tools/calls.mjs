// Draw calls per pass at a few positions: node tools/calls.mjs
import { chromium } from 'playwright';
const views = [['hero', 'hero', 0], ['inside', 'inside', 0.36], ['coda', 'coda-space', 0.55]];
const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:5173/', { waitUntil: 'commit' });
await page.waitForSelector('#enter-silent:not([disabled])', { timeout: 120000 });
await page.click('#enter-silent');
await page.waitForTimeout(4000);
for (const [name, id, f] of views) {
  const y = await page.evaluate(([id, f]) => { const el = document.getElementById(id); return el.getBoundingClientRect().top + scrollY + f * Math.max(el.offsetHeight - innerHeight, 0); }, [id, f]);
  await page.evaluate((y) => window.__bp.lenis.scrollTo(y, { immediate: true, force: true }), y);
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const st = window.__bp.stage, r = st.renderer, i = r.info; i.autoReset = false; i.reset();
    const out = {};
    const sm = r.shadowMap; sm.enabled = true;
    // render sin sombras para aislar
    st.composer.render(0.016); out.all = { calls: i.render.calls, tris: i.render.triangles };
    i.reset(); const au = [st.key.shadow.autoUpdate, st.fLight.shadow.autoUpdate];
    st.key.shadow.autoUpdate = false; st.fLight.shadow.autoUpdate = false;
    st.composer.render(0.016); out.noShadowUpdate = { calls: i.render.calls, tris: i.render.triangles };
    [st.key.shadow.autoUpdate, st.fLight.shadow.autoUpdate] = au; i.autoReset = true;
    return out;
  });
  console.log(name, JSON.stringify(r));
}
await browser.close();
