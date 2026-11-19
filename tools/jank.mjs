// Frame-time + long-task benchmark with a deterministic scripted scroll.
// node tools/jank.mjs [url] [out.json] [runs]
import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2] || 'http://localhost:5173/';
const outFile = process.argv[3];
const runs = +(process.argv[4] || 1);
const STEP = 30, EVERY = 16; // px por rueda, ms entre pasos

const pct = (a, p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
const stats = (d) => {
  if (!d.length) return null;
  const s = [...d].sort((a, b) => a - b);
  const sum = d.reduce((x, y) => x + y, 0);
  return {
    frames: d.length, avgFps: +(1000 / (sum / d.length)).toFixed(1),
    p50: +pct(s, 50).toFixed(1), p95: +pct(s, 95).toFixed(1), p99: +pct(s, 99).toFixed(1),
    max: +s[s.length - 1].toFixed(1), over25: d.filter((x) => x > 25).length, over50: d.filter((x) => x > 50).length,
  };
};

async function once() {
  const browser = await chromium.launch({ args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.addInitScript(() => {
    window.__lt = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForSelector('#enter-silent:not([disabled])', { timeout: 120000 });
  const loaderDone = await page.evaluate(() => performance.now());
  const wallLoader = Date.now() - t0;
  const ltLoad = await page.evaluate(() => window.__lt.slice());
  if (process.env.JANK_STARTUP) { await browser.close(); return { loaderDoneMs: Math.round(loaderDone), wallLoaderMs: wallLoader, ltLoad: { count: ltLoad.length, totalMs: Math.round(ltLoad.reduce((a, e) => a + e[1], 0)), maxMs: Math.round(Math.max(0, ...ltLoad.map((e) => e[1]))) } }; }
  await page.click('#enter-silent');
  await page.waitForTimeout(4500);
  const limit = await page.evaluate(() => window.__bp.lenis.limit);
  const progs0 = await page.evaluate(() => window.__bp.stage.renderer.info.programs.length);
  const mark = await page.evaluate(() => {
    window.__lt.length = 0;
    window.__rec = []; window.__run = true;
    const f = (t) => { if (!window.__run) return; const l = window.__bp.lenis; window.__rec.push([t, l.scroll / l.limit]); requestAnimationFrame(f); };
    requestAnimationFrame(f);
    return performance.now();
  });
  const steps = Math.ceil(limit / STEP);
  await page.mouse.move(640, 400);
  const s0 = Date.now();
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, STEP);
    await page.waitForTimeout(EVERY);
  }
  await page.waitForTimeout(1500);
  const scrollMs = Date.now() - s0;
  const { rec, lt } = await page.evaluate(() => { window.__run = false; return { rec: window.__rec, lt: window.__lt.slice() }; });
  const progs1 = await page.evaluate(() => window.__bp.stage.renderer.info.programs.length).catch(() => -1);
  await browser.close();
  const dts = [], frac = [];
  for (let i = 1; i < rec.length; i++) { dts.push(rec[i][0] - rec[i - 1][0]); frac.push(rec[i][1]); }
  const worst = dts.map((d, i) => [d, frac[i]]).filter((x) => x[0] > 60).map((x) => `${x[0].toFixed(0)}ms@${(x[1] * 100).toFixed(1)}%`);
  const buckets = [];
  const NB = 10;
  for (let b = 0; b < NB; b++) {
    const d = dts.filter((_, i) => frac[i] >= b / NB && frac[i] < (b + 1) / NB + (b === NB - 1 ? 1 : 0));
    buckets.push({ range: `${b * 10}-${b * 10 + 10}%`, ...stats(d) });
  }
  return {
    limit, scrollMs, programs: [progs0, progs1], loaderDoneMs: Math.round(loaderDone), wallLoaderMs: wallLoader,
    ltLoad: { count: ltLoad.length, totalMs: Math.round(ltLoad.reduce((a, e) => a + e[1], 0)), maxMs: Math.round(Math.max(0, ...ltLoad.map((e) => e[1]))) },
    ltScroll: { count: lt.length, totalMs: Math.round(lt.reduce((a, e) => a + e[1], 0)), maxMs: Math.round(Math.max(0, ...lt.map((e) => e[1]))) },
    scroll: stats(dts), worst, buckets,
  };
}

const results = [];
for (let r = 0; r < runs; r++) {
  const res = await once();
  results.push(res);
  console.log(`--- run ${r + 1}`);
  if (res.ltLoad && !res.scroll) { console.log('startup', JSON.stringify(res)); continue; }
  console.log(`programs ${res.programs} | loader done ${res.loaderDoneMs}ms | longtasks load ${JSON.stringify(res.ltLoad)} | scroll ${JSON.stringify(res.ltScroll)}`);
  console.log('hitches>60ms', res.worst.join(' '));
  console.log('scroll', JSON.stringify(res.scroll));
  res.buckets.forEach((b) => console.log(' ', b.range, `fps ${b.avgFps} p95 ${b.p95} p99 ${b.p99} max ${b.max} >25:${b.over25} >50:${b.over50}`));
}
if (outFile) { fs.mkdirSync(outFile.replace(/[\/][^\/]*$/, ''), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(results, null, 1)); }
