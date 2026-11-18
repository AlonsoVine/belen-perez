// Procesa las fotos del violín real de Belén → texturas + contorno + máscara de efes.
// node tools/prep-violin.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const read = (p) => 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64');
const imgs = {
  front: read('imgs/DSC_0040.JPG.jpeg'),
  back: read('imgs/DSC_0047.JPG.jpeg'),
  scroll: read('imgs/DSC_0061.JPG.jpeg'),
  ff: read('imgs/DSC_0067.JPG.jpeg'),
  inner: read('imgs/images.jpg'),
  efes: 'data:image/png;base64,' + fs.readFileSync('imgs/efes.png').toString('base64'),
};
fs.mkdirSync('public/tex', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
const result = await page.evaluate(async (imgs) => {
  const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
  const data = (img) => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return { c, x, d: x.getImageData(0, 0, c.width, c.height), w: c.width, h: c.height };
  };
  const isBody = (d, i) => {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx > 50 && (mx - mn) / mx > 0.3 && r >= b; // madera barnizada: saturada y cálida
  };
  // Contorno por filas (requiere una racha de píxeles de cuerpo)
  const rows = (im) => {
    const { d, w, h } = im; const out = [];
    for (let y = 0; y < h; y++) {
      let l = -1, r = -1, run = 0;
      for (let x = 0; x < w; x++) { if (isBody(d.data, (y * w + x) * 4)) { run++; if (run === 10) { l = x - 9; break; } } else run = 0; }
      run = 0;
      for (let x = w - 1; x >= 0; x--) { if (isBody(d.data, (y * w + x) * 4)) { run++; if (run === 10) { r = x + 9; break; } } else run = 0; }
      out.push(l >= 0 && r > l ? [l, r] : null);
    }
    return out;
  };
  const extent = (R, minW) => {
    let top = R.findIndex((v) => v && v[1] - v[0] > minW);
    let bot = R.length - 1 - [...R].reverse().findIndex((v) => v && v[1] - v[0] > minW);
    return { top, bot };
  };

  // ── FONDO: contorno completo (sin barbada que lo tape)
  const B = data(await load(imgs.back));
  const RB = rows(B.data ? B : B);
  const eb = extent(RB, 300);
  // fondo: el borde inferior real está por debajo del último ancho > 300
  let botB = eb.bot;
  for (let y = eb.bot; y < Math.min(B.h, eb.bot + 200); y++) if (RB[y] && RB[y][1] - RB[y][0] > 40) botB = y;
  let maxWB = 0, cxs = [];
  for (let y = eb.top; y <= botB; y++) if (RB[y]) { maxWB = Math.max(maxWB, RB[y][1] - RB[y][0]); cxs.push((RB[y][0] + RB[y][1]) / 2); }
  cxs.sort((a, b) => a - b);
  const cxB = cxs[cxs.length >> 1];
  const LB = botB - eb.top;
  const N = 240, profile = [];
  for (let k = 0; k <= N; k++) {
    const y = Math.round(eb.top + (k / N) * LB);
    let hw = 0, cnt = 0;
    for (let dy = -3; dy <= 3; dy++) { const v = RB[y + dy]; if (v) { hw += ((v[1] - v[0]) / 2); cnt++; } }
    profile.push(cnt ? hw / cnt / LB : 0);
  }
  profile[0] = 0; profile[N] = 0;

  // ── TAPA
  const F = data(await load(imgs.front));
  const RF = rows(F);
  const ef = extent(RF, 300);
  let maxWF = 0, cf = [];
  for (let y = ef.top; y < ef.top + (ef.bot - ef.top) * 0.6; y++) if (RF[y]) { maxWF = Math.max(maxWF, RF[y][1] - RF[y][0]); cf.push((RF[y][0] + RF[y][1]) / 2); }
  cf.sort((a, b) => a - b);
  const cxF = cf[cf.length >> 1];
  // ancho de bout inferior del fondo como referencia de escala (en la tapa la barbada estorba abajo)
  let maxWBupper = 0; for (let y = eb.top; y < eb.top + LB * 0.6; y++) if (RB[y]) maxWBupper = Math.max(maxWBupper, RB[y][1] - RB[y][0]);
  const LF = LB * (maxWF / maxWBupper);
  const topF = ef.top;

  // Quitar cuerdas (líneas claras finas) y sedas verdes de la tapa
  const fd = F.d.data, W = F.w;
  const L = (i) => fd[i] * 0.3 + fd[i + 1] * 0.59 + fd[i + 2] * 0.11;
  const y0s = Math.round(topF + LF * 0.2), y1s = Math.round(topF + LF * 0.78);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = y0s; y < y1s; y++) {
      for (let x = Math.round(cxF - maxWF * 0.22); x < cxF + maxWF * 0.22; x++) {
        const i = (y * W + x) * 4, il = (y * W + x - 9) * 4, ir = (y * W + x + 9) * 4;
        const green = fd[i + 1] > fd[i] + 8;
        if (L(i) > Math.max(L(il), L(ir)) + 22 || green) {
          for (let c = 0; c < 3; c++) fd[i + c] = (fd[il + c] + fd[ir + c]) / 2;
        }
      }
    }
  }
  F.x.putImageData(F.d, 0, 0);

  // Máscara de efes: oscuro, dentro del cuerpo, fuera del eje central → 2 componentes mayores
  const mask = new Uint8Array(F.w * F.h);
  const fy0 = Math.round(topF + LF * 0.33), fy1 = Math.round(topF + LF * 0.72);
  for (let y = fy0; y < fy1; y++) {
    const v = RF[y]; if (!v) continue;
    for (let x = v[0] + 40; x < v[1] - 40; x++) {
      if (Math.abs(x - cxF) < maxWF * 0.115) continue;
      const i = (y * W + x) * 4;
      if (L(i) < 60 && Math.abs(x - v[0]) > maxWF * 0.07 && Math.abs(v[1] - x) > maxWF * 0.07) mask[y * F.w + x] = 1;
    }
  }
  // componentes conexas
  const lab = new Int32Array(F.w * F.h); let next = 1; const sizes = [0];
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p] || lab[p]) continue;
    const st = [p]; lab[p] = next; let s = 0;
    while (st.length) {
      const q = st.pop(); s++;
      const qx = q % F.w, qy = (q / F.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = qx + dx, ny = qy + dy; const n = ny * F.w + nx;
        if (nx >= 0 && ny >= 0 && nx < F.w && ny < F.h && mask[n] && !lab[n]) { lab[n] = next; st.push(n); }
      }
    }
    sizes.push(s); next++;
  }
  const order = sizes.map((s, i) => [s, i]).slice(1).sort((a, b) => b[0] - a[0]).slice(0, 2).map((v) => v[1]);
  const keep = new Uint8Array(F.w * F.h);
  const topRow = {};
  for (let p = 0; p < keep.length; p++) if (order.includes(lab[p])) { keep[p] = 1; const y = (p / F.w) | 0; if (!(lab[p] in topRow)) topRow[lab[p]] = y; }
  // las efes son simétricas: recorta suciedad por encima del ojo superior más bajo
  const clipTop = Math.max(...Object.values(topRow));
  for (let p = 0; p < clipTop * F.w; p++) keep[p] = 0;
  // cierre morfológico (rellena motas de polvo dentro de la efe)
  const dil = (src, r) => { const o = new Uint8Array(src.length); for (let y = r; y < F.h - r; y++) for (let x = r; x < F.w - r; x++) { if (!src[y * F.w + x]) continue; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) o[(y + dy) * F.w + x + dx] = 1; } return o; };
  const ero = (src, r) => { const o = new Uint8Array(src.length); for (let y = r; y < F.h - r; y++) for (let x = r; x < F.w - r; x++) { let ok = 1; for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r; dx++) if (!src[(y + dy) * F.w + x + dx]) { ok = 0; break; } o[y * F.w + x] = ok; } return o; };
  const closedRaw = ero(dil(keep, 6), 5);

  // ── Efes VECTORIALES: se miden sobre la foto (ojos = círculo inscrito máximo, tallo = eje + ancho
  // suavizados) y se redibujan con curvas limpias, como cortadas a cuchilla. Luego se rellena con madera
  // la sombra fotografiada que quede fuera del nuevo corte.
  const vec = document.createElement('canvas'); vec.width = F.w; vec.height = F.h;
  const vx = vec.getContext('2d'); vx.fillStyle = '#fff'; vx.strokeStyle = '#fff';
  const fFit = [];
  {
    // Plantilla: efe clásica (imgs/efes.png) → máscara blanca sobre transparente
    const T = await load(imgs.efes);
    const tc = document.createElement('canvas'); tc.width = T.width; tc.height = T.height;
    const tx = tc.getContext('2d'); tx.drawImage(T, 0, 0);
    const td = tx.getImageData(0, 0, tc.width, tc.height);
    const tm = new Uint8Array(tc.width * tc.height);
    for (let i = 0; i < tm.length; i++) { const r = td.data[i * 4], g = td.data[i * 4 + 1], bl = td.data[i * 4 + 2], al = td.data[i * 4 + 3]; const on = al > 128 && r * 0.3 + g * 0.59 + bl * 0.11 < 128; tm[i] = on; td.data[i * 4] = td.data[i * 4 + 1] = td.data[i * 4 + 2] = 255; td.data[i * 4 + 3] = on ? 255 : 0; }
    tx.putImageData(td, 0, 0);
    // ojos de la plantilla: máximo de la transformada de distancia arriba y abajo
    const tw = tc.width, th = tc.height, D = new Float32Array(tw * th);
    for (let i = 0; i < D.length; i++) D[i] = tm[i] ? 1e6 : 0;
    for (let y = 1; y < th; y++) for (let x = 1; x < tw - 1; x++) { const i = y * tw + x; if (D[i]) D[i] = Math.min(D[i], D[i - 1] + 1, D[i - tw] + 1, D[i - tw - 1] + 1.414, D[i - tw + 1] + 1.414); }
    for (let y = th - 2; y >= 0; y--) for (let x = tw - 2; x > 0; x--) { const i = y * tw + x; if (D[i]) D[i] = Math.min(D[i], D[i + 1] + 1, D[i + tw] + 1, D[i + tw + 1] + 1.414, D[i + tw - 1] + 1.414); }
    let ty0 = th, ty1 = 0; for (let i = 0; i < tm.length; i++) if (tm[i]) { const y = (i / tw) | 0; ty0 = Math.min(ty0, y); ty1 = Math.max(ty1, y); }
    const best = (ya, yb) => { let m = -1, bx = 0, by = 0; for (let y = Math.round(ya); y < Math.round(yb); y++) for (let x = 0; x < tw; x++) { const v = D[y * tw + x]; if (v > m) { m = v; bx = x; by = y; } } return { x: bx, y: by, r: m }; };
    const tH = ty1 - ty0, tU = best(ty0, ty0 + tH * 0.3), tL = best(ty1 - tH * 0.3, ty1 + 1);
    console.log('template eyes', JSON.stringify(tU), JSON.stringify(tL));
    // ojos medidos sobre la foto original de su violín (px de DSC_0040)
    const targets = [
      { side: -1, U: [817, 1373], L: [557, 1777] },
      { side: 1, U: [1183, 1377], L: [1427, 1777] },
    ];
    for (const tg of targets) {
      // semejanza (con espejo para la efe aguda) que lleva los ojos de la plantilla a los medidos
      const mir = tg.side > 0 ? -1 : 1;
      const sU = [tU.x * mir, tU.y], sL = [tL.x * mir, tL.y];
      const vs = [sL[0] - sU[0], sL[1] - sU[1]], vt = [tg.L[0] - tg.U[0], tg.L[1] - tg.U[1]];
      const k = Math.hypot(...vt) / Math.hypot(...vs);
      const ang = Math.atan2(vt[1], vt[0]) - Math.atan2(vs[1], vs[0]);
      const ca = Math.cos(ang) * k, sa = Math.sin(ang) * k;
      // matriz: p' = R·k·(M·p) + t,  M = diag(mir, 1)
      const a11 = ca * mir, a12 = -sa, a21 = sa * mir, a22 = ca;
      const t1 = tg.U[0] - (a11 * tU.x + a12 * tU.y), t2 = tg.U[1] - (a21 * tU.x + a22 * tU.y);
      vx.setTransform(a11, a21, a12, a22, t1, t2);
      vx.drawImage(tc, 0, 0);
      vx.setTransform(1, 0, 0, 1, 0, 0);
      const corners = [[0, 0], [tw, 0], [0, th], [tw, th]].map(([x, y]) => [a11 * x + a12 * y + t1, a21 * x + a22 * y + t2]);
      const xs = corners.map((q) => q[0]), ysq = corners.map((q) => q[1]);
      // unión con la caja de la componente fotografiada (para limpiar su sombra)
      const id = order.find((o) => { let sx = 0, n = 0; for (let p = 0; p < lab.length; p += 7) if (lab[p] === o) { sx += p % F.w; n++; } return (sx / n < cxF ? -1 : 1) === tg.side; });
      let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ysq), ymax = Math.max(...ysq);
      for (let p = 0; p < lab.length; p++) if (lab[p] === id) { const x = p % F.w, y = (p / F.w) | 0; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
      const bx0 = Math.floor(xmin) - 10, by0 = Math.floor(ymin) - 10;
      fFit.push({ id, bx0, by0, bw: Math.ceil(xmax - xmin) + 21, bh: Math.ceil(ymax - ymin) + 21 });
    }
  }
  const vd = vx.getImageData(0, 0, F.w, F.h).data;
  const closed = new Uint8Array(F.w * F.h);
  for (let p = 0; p < closed.length; p++) closed[p] = vd[p * 4 + 3] > 127 ? 1 : 0;
  // relleno de la efe fotografiada que queda fuera del corte nuevo: interpolación por columnas
  // (la veta del abeto es vertical, así que las líneas de veta continúan sin borrones)
  {
    const dd = F.d.data, unk = new Uint8Array(F.w * F.h);
    const R = 22;
    for (const f of fFit) for (let y = f.by0 - 30; y < f.by0 + f.bh + 30; y++) for (let x = f.bx0 - 30; x < f.bx0 + f.bw + 30; x++) {
      const p = y * F.w + x; if (closed[p]) continue;
      let near = 0;
      for (let d = -R; d <= R && !near; d += 2) if (closedRaw[p + d] || closedRaw[p + d * F.w]) near = 1;
      if (!near) for (let d = -14; d <= 14 && !near; d += 7) for (let e = -14; e <= 14 && !near; e += 7) if (closedRaw[p + d + e * F.w]) near = 1;
      if (!near) { const i = p * 4; const l = dd[i] * 0.3 + dd[i + 1] * 0.59 + dd[i + 2] * 0.11; if (l < 70) for (let d = -10; d <= 10 && !near; d += 2) if (closed[p + d] || closed[p + d * F.w]) near = 1; }
      if (near) unk[p] = 1;
    }
    const src = new Uint8ClampedArray(dd);
    for (const f of fFit) for (let x = f.bx0 - 30; x < f.bx0 + f.bw + 30; x++) {
      let y = f.by0 - 30;
      while (y < f.by0 + f.bh + 30) {
        const p = y * F.w + x;
        if (!unk[p]) { y++; continue; }
        // tramo de desconocidos/corte en la columna
        const a = y; while (y < F.h && (unk[y * F.w + x] || closed[y * F.w + x])) y++;
        const top = a - 1, bot = y; // píxeles conocidos
        for (let yy = a; yy < bot; yy++) {
          const q = yy * F.w + x; if (!unk[q]) continue;
          const t = (yy - top) / (bot - top);
          // media de 3 píxeles de veta a cada extremo + un poco de vecino lateral
          for (let ch = 0; ch < 3; ch++) {
            let A = 0, B = 0;
            for (let k = 0; k < 3; k++) { A += src[((top - k) * F.w + x) * 4 + ch]; B += src[((bot + k) * F.w + x) * 4 + ch]; }
            dd[q * 4 + ch] = (A / 3) * (1 - t) + (B / 3) * t;
          }
        }
      }
    }
    // suavizado horizontal muy leve sólo en lo rellenado (evita columnas "rayadas")
    const s2 = new Uint8ClampedArray(dd);
    for (let p = F.w; p < unk.length - F.w; p++) if (unk[p]) for (let ch = 0; ch < 3; ch++) dd[p * 4 + ch] = (s2[(p - 1) * 4 + ch] + 2 * s2[p * 4 + ch] + s2[(p + 1) * 4 + ch]) / 4;
    F.x.putImageData(F.d, 0, 0);
  }
  // contornos (marching squares) para el canto de madera del corte en 3D
  const fLoops = fFit.map((f) => {
    const st = 2, gx = Math.ceil((f.bw + 28) / st), gy = Math.ceil((f.bh + 28) / st), ox = f.bx0 - 14, oy = f.by0 - 14;
    const v = (i, j) => closed[(oy + j * st) * F.w + ox + i * st] || 0;
    const adj = new Map(); const key = (p) => p[0].toFixed(1) + ',' + p[1].toFixed(1);
    const link = (a, b) => { const ka = key(a), kb = key(b); if (!adj.has(ka)) adj.set(ka, { p: a, n: [] }); if (!adj.has(kb)) adj.set(kb, { p: b, n: [] }); adj.get(ka).n.push(kb); adj.get(kb).n.push(ka); };
    const TABLE = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 0], [1, 2]], 6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 10: [[0, 1], [2, 3]], 11: [[2, 1]], 12: [[1, 3]], 13: [[1, 0]], 14: [[0, 3]] };
    for (let j = 0; j < gy - 1; j++) for (let i = 0; i < gx - 1; i++) {
      const s = v(i, j) | (v(i + 1, j) << 1) | (v(i + 1, j + 1) << 2) | (v(i, j + 1) << 3);
      const E = TABLE[s]; if (!E) continue;
      const pts = [[i + 0.5, j], [i + 1, j + 0.5], [i + 0.5, j + 1], [i, j + 0.5]];
      for (const [a, b] of E) link(pts[a], pts[b]);
    }
    let bestLoop = [];
    const seen = new Set();
    for (const [k0] of adj) {
      if (seen.has(k0)) continue;
      const loop = []; let k = k0, prev = null;
      while (k && !seen.has(k)) { seen.add(k); const nd = adj.get(k); loop.push(nd.p); const nx = nd.n.find((m) => m !== prev && !seen.has(m)); prev = k; k = nx; }
      if (loop.length > bestLoop.length) bestLoop = loop;
    }
    const P = bestLoop.map(([i, j]) => [ox + i * st, oy + j * st]);
    const S = P.map((_, i) => { let x = 0, y = 0; for (let k = -2; k <= 2; k++) { const q = P[(i + k + P.length) % P.length]; x += q[0]; y += q[1]; } return [x / 5, y / 5]; });
    return S.filter((_, i) => i % 2 === 0);
  });

  // ── Borrar de la foto las piezas que ya existen en 3D (diapasón, cordal, puente, barbada)
  // para que bajo ellas sólo quede la tapa de abeto.
  {
    const dd = F.d.data;
    const lumAt = (x, y) => { const i = (y * W + x) * 4; return dd[i] * 0.3 + dd[i + 1] * 0.59 + dd[i + 2] * 0.11; };
    const satAt = (x, y) => { const i = (y * W + x) * 4; const mx = Math.max(dd[i], dd[i + 1], dd[i + 2]), mn = Math.min(dd[i], dd[i + 1], dd[i + 2]); return mx ? (mx - mn) / mx : 0; };
    const band = Math.round(maxWF * 0.19);
    const yA = Math.max(0, topF - 40), yB = Math.round(topF + LF * 0.86);
    const kill = new Uint8Array(W * F.h);
    // ébano (diapasón y cordal): oscuro y poco saturado en la franja central
    for (let y = yA; y < yB; y++) for (let x = cxF - band; x < cxF + band; x++) {
      if (closed[y * W + x]) continue;
      const i0 = (y * W + x) * 4;
      if ((dd[i0] - dd[i0 + 2] < 34 && lumAt(x, y) < 150) || lumAt(x, y) < 55) kill[y * W + x] = 1;
      // reflejos grises del ébano y cuerdas fotografiadas: la madera barnizada siempre es saturada
      else if (satAt(x, y) < 0.36) kill[y * W + x] = 1;
    }
    // puente: claro y poco saturado en su franja
    const bridgeRow = Math.round(topF + 1.954 * (LF / 3.58));
    for (let y = bridgeRow - 70; y < bridgeRow + 70; y++) for (let x = cxF - band; x < cxF + band; x++) {
      if (lumAt(x, y) > 140 && satAt(x, y) < 0.45) kill[y * W + x] = 2;
    }
    // dilatar (bordes y sombras de contacto)
    const dil = kill.slice();
    for (let y = yA + 6; y < yB - 6; y++) for (let x = cxF - band - 6; x < cxF + band + 6; x++) {
      const p = y * W + x; if (!kill[p]) continue;
      for (let d = -6; d <= 6; d++) { if (!closed[p + d] && !dil[p + d]) dil[p + d] = kill[p]; if (!closed[p + d * W] && !dil[p + d * W]) dil[p + d * W] = kill[p]; }
    }
    // relleno por espejo horizontal desde el borde más cercano (la veta del abeto es vertical: casa perfecta)
    for (let y = yA; y < yB; y++) {
      let x = cxF - band - 8;
      while (x < cxF + band + 8) {
        if (dil[y * W + x] !== 1) { x++; continue; }
        const a = x; while (x < cxF + band + 8 && dil[y * W + x] === 1) x++;
        const b = x - 1, mid = (a + b) / 2, span = b - a + 1;
        for (let xx = a; xx <= b; xx++) {
          let src = xx < mid ? a - 1 - (xx - a) : b + 1 + (b - xx);
          src = Math.max(0, Math.min(W - 1, src));
          const t = Math.abs(xx - mid) / (span / 2 + 1); // mezcla suave en la costura central
          const s2 = xx < mid ? b + 1 + (xx - a) : a - 1 - (b - xx);
          const i = (y * W + xx) * 4, j = (y * W + src) * 4, j2 = (y * W + Math.max(0, Math.min(W - 1, s2))) * 4;
          const wgt = 0.5 + 0.5 * Math.min(1, t * 1.2);
          for (let c = 0; c < 3; c++) dd[i + c] = dd[j + c] * wgt + dd[j2 + c] * (1 - wgt);
        }
      }
    }
    // puente: relleno vertical con la madera de justo encima
    for (let x = cxF - band - 8; x < cxF + band + 8; x++) {
      let y = bridgeRow - 80;
      while (y < bridgeRow + 80) {
        if (dil[y * W + x] !== 2) { y++; continue; }
        const a = y; while (y < bridgeRow + 80 && dil[y * W + x] === 2) y++;
        const h = y - a;
        for (let yy = a; yy < y; yy++) { const i = (yy * W + x) * 4, j = ((yy - h - 3) * W + x) * 4; for (let c = 0; c < 3; c++) dd[i + c] = dd[j + c]; }
      }
    }
    // suavizado vertical del relleno (la veta del abeto es recta): borra la cuadrícula del parcheado
    {
      const src = new Uint8ClampedArray(dd);
      const R = 34;
      for (let x = cxF - band - 10; x < cxF + band + 10; x++) {
        for (let y = yA + R; y < yB - R; y++) {
          let near = 0;
          for (let d = -10; d <= 10 && !near; d += 5) if (dil[y * W + x + d]) near = 1;
          if (!near) continue;
          let r = 0, g = 0, b = 0, n = 0;
          for (let k = -R; k <= R; k += 2) { const j = ((y + k) * W + x) * 4; r += src[j]; g += src[j + 1]; b += src[j + 2]; n++; }
          const i = (y * W + x) * 4;
          dd[i] = r / n; dd[i + 1] = g / n; dd[i + 2] = b / n;
        }
      }
    }
    // barbada: se sustituye por la madera de más arriba (desplazamiento vertical)
    const chinTop = Math.round(topF + LF * 0.865), off = Math.round(LF * 0.2);
    for (let y = chinTop - 10; y < F.h; y++) for (let x = Math.round(cxF - maxWF * 0.36); x < cxF + maxWF * 0.36; x++) {
      const i = (y * W + x) * 4, j = ((y - off) * W + x) * 4;
      const edge = Math.min(1, (maxWF * 0.36 - Math.abs(x - cxF)) / 40);
      const fade = Math.min(1, (y - chinTop + 10) / 20) * Math.max(0, edge);
      for (let c = 0; c < 3; c++) dd[i + c] = dd[i + c] * (1 - fade) + dd[j + c] * fade;
    }
    F.x.putImageData(F.d, 0, 0);
  }

  // Geometría de cada efe en unidades del modelo (1 = 100 mm, cuerpo de 3,58)
  const ppu = LF / 3.58;
  const toU = (x, y) => [(x - cxF) / ppu, 1.79 - (y - topF) / ppu];
  const fholes = [];
  for (const id of order) {
    const segs = [];
    let ymin = 1e9, ymax = 0;
    for (let p = 0; p < closed.length; p++) if (closed[p] && lab[p] === id) { const y = (p / F.w) | 0; ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
    // en el cierre morfológico algunos píxeles no tienen etiqueta: recorre la máscara cerrada por filas dentro de la caja del componente
    let xmin = 1e9, xmax = 0;
    for (let p = 0; p < closed.length; p++) if (lab[p] === id) { const x = p % F.w; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); }
    for (let y = ymin; y <= ymax; y += 4) {
      // tramos contiguos dentro de la caja
      let x = xmin - 6;
      while (x <= xmax + 6) {
        while (x <= xmax + 6 && !closed[y * F.w + x]) x++;
        if (x > xmax + 6) break;
        const a = x;
        while (x <= xmax + 6 && closed[y * F.w + x]) x++;
        const [ua, uy] = toU(a, y), [ub] = toU(x, y);
        segs.push([+uy.toFixed(4), +ua.toFixed(4), +ub.toFixed(4)]);
      }
    }
    const side = toU((xmin + xmax) / 2, 0)[0] > 0 ? 1 : -1;
    const box = { x0: toU(xmin, 0)[0], x1: toU(xmax, 0)[0], y0: toU(0, ymax)[1], y1: toU(0, ymin)[1] };
    const loop = (fLoops[fFit.findIndex((f) => f.id === id)] || []).map(([x, y]) => toU(x, y).map((v) => +v.toFixed(4)));
    fholes.push({ side, segs, box, loop });
  }
  // máscara invertida (blanco = agujero) para la luz que entra
  const holesCanvas = document.createElement('canvas'); holesCanvas.width = F.w; holesCanvas.height = F.h;
  const hx = holesCanvas.getContext('2d'); const hd = hx.createImageData(F.w, F.h);
  for (let p = 0; p < closed.length; p++) { const v = closed[p] ? 255 : 0; hd.data[p * 4] = hd.data[p * 4 + 1] = hd.data[p * 4 + 2] = v; hd.data[p * 4 + 3] = 255; }
  hx.putImageData(hd, 0, 0);

  // recorte común: caja del cuerpo + margen
  const crop = (cx, top, Lb, maxW) => {
    const m = Lb * 0.02;
    return { x: Math.round(cx - maxW / 2 - m), y: Math.round(top - m), w: Math.round(maxW + 2 * m), h: Math.round(Lb + 2 * m) };
  };
  const cF = crop(cxF, topF, LF, maxWF * (maxWB / maxWBupper));
  const cB = crop(cxB, eb.top, LB, maxWB);
  const cropCanvas = (src, c, outW) => {
    const k = outW / c.w;
    const o = document.createElement('canvas'); o.width = outW; o.height = Math.round(c.h * k);
    o.getContext('2d').drawImage(src, c.x, c.y, c.w, c.h, 0, 0, o.width, o.height);
    return o;
  };
  const exportCrop = (src, c, outW, type = 'image/jpeg', q = 0.9) => cropCanvas(src, c, outW).toDataURL(type, q);
  // Silueta de las efes: desenfoque + umbral (curvas limpias, como cortadas a cuchilla) + 1 px de antialias
  const smoothMask = (cv, r, inv = false) => {
    const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height;
    const x = o.getContext('2d'); x.filter = `blur(${r}px)`; x.drawImage(cv, 0, 0); x.filter = 'none';
    const d = x.getImageData(0, 0, o.width, o.height);
    for (let i = 0; i < d.data.length; i += 4) { const v = (inv ? d.data[i] > 150 : d.data[i] > 105) ? 255 : 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    const o2 = document.createElement('canvas'); o2.width = cv.width; o2.height = cv.height;
    const x2 = o2.getContext('2d'); x2.filter = 'blur(1.2px)'; x2.drawImage(o, 0, 0);
    return o2;
  };

  // Relleno de bordes: el fondo blanco de la foto se sustituye por madera vecina
  // (así un pequeño desajuste del mapeo nunca muestra blanco).
  const pad = (cv, iters = 50) => {
    const x = cv.getContext('2d'); const w = cv.width, h = cv.height;
    const im = x.getImageData(0, 0, w, h); const d = im.data;
    const bg = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      bg[p] = (mx > 150 && (mx - mn) / mx < 0.2) ? 1 : 0;
    }
    for (let it = 0; it < iters; it++) {
      const nb = bg.slice();
      for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) {
        const p = y * w + xx; if (!bg[p]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (const q of [p - 1, p + 1, p - w, p + w]) if (!bg[q]) { r += d[q * 4]; g += d[q * 4 + 1]; b += d[q * 4 + 2]; n++; }
        if (n) { d[p * 4] = r / n; d[p * 4 + 1] = g / n; d[p * 4 + 2] = b / n; nb[p] = 0; }
      }
      bg.set(nb);
    }
    x.putImageData(im, 0, 0);
    return cv;
  };

  // Mapa de normales a partir del detalle fino de la foto (paso alto de la luminancia)
  const normalMap = (cv, strength = 2.2, blurR = 6) => {
    const w = cv.width, h = cv.height;
    const src = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const lum = new Float32Array(w * h);
    for (let p = 0; p < w * h; p++) lum[p] = (src[p * 4] * 0.3 + src[p * 4 + 1] * 0.59 + src[p * 4 + 2] * 0.11) / 255;
    // desenfoque de caja separable
    const blur = (a, r) => {
      const t = new Float32Array(a.length), o = new Float32Array(a.length);
      for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { t[y * w + x] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
      for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = s / (2 * r + 1); s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
      return o;
    };
    const low = blur(lum, blurR), fine = blur(lum, 1);
    const H = new Float32Array(w * h);
    for (let p = 0; p < w * h; p++) H[p] = fine[p] - low[p];
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const ox = o.getContext('2d'); const od = ox.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const dx = (H[y * w + Math.min(w - 1, x + 1)] - H[y * w + Math.max(0, x - 1)]) * strength;
      const dy = (H[Math.min(h - 1, y + 1) * w + x] - H[Math.max(0, y - 1) * w + x]) * strength;
      // poros y vetas oscuras = hundidas
      let nx = dx, ny = -dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      od.data[p * 4] = (nx * 0.5 + 0.5) * 255; od.data[p * 4 + 1] = (ny * 0.5 + 0.5) * 255; od.data[p * 4 + 2] = (nz * 0.5 + 0.5) * 255; od.data[p * 4 + 3] = 255;
    }
    ox.putImageData(od, 0, 0);
    return o;
  };
  // máscara a canvas (blanco = madera, negro = agujero)
  const mc = document.createElement('canvas'); mc.width = F.w; mc.height = F.h;
  const mx = mc.getContext('2d'); const md = mx.createImageData(F.w, F.h);
  for (let p = 0; p < closed.length; p++) { const v = closed[p] ? 0 : 255; md.data[p * 4] = md.data[p * 4 + 1] = md.data[p * 4 + 2] = v; md.data[p * 4 + 3] = 255; }
  mx.putImageData(md, 0, 0);

  // Voluta
  const S = await load(imgs.scroll);
  const sc = { x: 380, y: 420, w: 1360, h: 2380 };
  const FF = await load(imgs.ff);

  const topC = pad(cropCanvas(F.c, cF, 1400));
  const backC = pad(cropCanvas(B.c, cB, 1400));
  const scrollC = pad(cropCanvas(S, sc, 1024), 80);
  // Tiras de arce flameado del propio fondo: para aros (zona con barniz) y mástil (zona gastada)
  const strip = (cv, x, y, w, h, outW, outH) => {
    const o = document.createElement('canvas'); o.width = outW; o.height = outH;
    o.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, outW, outH);
    return o;
  };
  // Aros: columnas de arce de la parte alta del fondo, apiladas a escala real (≈6,4 px/mm);
  // las llamas atraviesan el aro como en un violín de verdad. Fundido suave entre columnas.
  // Madera del interior: franja de veta recta de la foto oscura (a la derecha de la efe)
  const IN = await load(imgs.inner);
  const innerC = document.createElement('canvas'); innerC.width = 512; innerC.height = 384;
  innerC.getContext('2d').drawImage(IN, 20, 505, 300, 225, 0, 0, 512, 384);
  const ribC = document.createElement('canvas'); ribC.width = 256; ribC.height = 2048;
  {
    const rx = ribC.getContext('2d');
    const cols = [330, 520, 710, 880], sh = 420, oh = 512, fade = 48;
    cols.forEach((x0, k) => {
      const t = document.createElement('canvas'); t.width = 256; t.height = oh + fade;
      const tx = t.getContext('2d');
      tx.drawImage(backC, x0, 230, 190, sh + fade * sh / oh, 0, 0, 256, oh + fade);
      if (k > 0) {
        tx.globalCompositeOperation = 'destination-in';
        const g = tx.createLinearGradient(0, 0, 0, oh + fade); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(fade / (oh + fade), 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,1)');
        tx.fillStyle = g; tx.fillRect(0, 0, 256, oh + fade);
      }
      rx.drawImage(t, 0, k * oh - (k > 0 ? fade : 0));
    });
  }
  // Mástil: zona gastada y clara del fondo, sin repetir (136 × 60 mm ≈ 870 × 385 px)
  const neckC = strip(backC, 630, 800, 270, 780, 384, 1024);
  return {
    front: topC.toDataURL('image/jpeg', 0.92),
    frontN: normalMap(topC, 2.6, 5).toDataURL('image/jpeg', 0.9),
    backN: normalMap(backC, 2.0, 6).toDataURL('image/jpeg', 0.9),
    scrollN: normalMap(scrollC, 2.4, 6).toDataURL('image/jpeg', 0.9),
    rib: ribC.toDataURL('image/jpeg', 0.9),
    inner: innerC.toDataURL('image/jpeg', 0.9),
    innerN: normalMap(innerC, 2.2, 4).toDataURL('image/jpeg', 0.9),
    ribN: normalMap(ribC, 2.0, 5).toDataURL('image/jpeg', 0.9),
    neck: neckC.toDataURL('image/jpeg', 0.9),
    neckN: normalMap(neckC, 1.6, 5).toDataURL('image/jpeg', 0.9),
    backPadded: backC.toDataURL('image/jpeg', 0.92),
    scrollPadded: scrollC.toDataURL('image/jpeg', 0.92),
    frontMask: exportCrop(smoothMask(mc, 14, true), cF, 1400, 'image/png'),
    holes: exportCrop(smoothMask(holesCanvas, 14), cF, 1400, 'image/png'),
    back: exportCrop(B.c, cB, 1400),
    scroll: exportCrop(S, sc, 1024),
    meta: {
      profile,
      fholes,
      front: { cx: cxF, top: topF, L: LF, crop: cF, img: [F.w, F.h] },
      back: { cx: cxB, top: eb.top, L: LB, crop: cB, img: [B.w, B.h] },
      scroll: { crop: sc, img: [S.width, S.height] },
      debug: { maxWF, maxWB, maxWBupper, LB, ebTop: eb.top, botB },
    },
  };
}, imgs);

const save = (name, url) => fs.writeFileSync(name, Buffer.from(url.split(',')[1], 'base64'));
save('public/tex/top.jpg', result.front);
save('public/tex/top-n.jpg', result.frontN);
save('public/tex/back-n.jpg', result.backN);
save('public/tex/scroll-n.jpg', result.scrollN);
save('public/tex/rib.jpg', result.rib);
save('public/tex/inner.jpg', result.inner);
save('public/tex/inner-n.jpg', result.innerN);
save('public/tex/rib-n.jpg', result.ribN);
save('public/tex/neck.jpg', result.neck);
save('public/tex/neck-n.jpg', result.neckN);
save('public/tex/top-mask.png', result.frontMask);
save('public/tex/top-holes.png', result.holes);
save('public/tex/back.jpg', result.backPadded);
save('public/tex/scroll.jpg', result.scrollPadded);
fs.writeFileSync('src/violin-data.json', JSON.stringify(result.meta));
console.log(JSON.stringify(result.meta.debug), JSON.stringify(result.meta.front), JSON.stringify(result.meta.back));
await browser.close();
