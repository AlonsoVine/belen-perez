import * as THREE from 'three';
import VD from './violin-data.json';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ebonyTexture, labelTexture, windingNormal, fwallTexture } from './textures.js';
// (la madera cruda y el puente son procedurales pero caros: se hornean en public/tex con tools/bake-procedural.mjs)

// ─────────────────────────────────────────────────────────────────────────
//  El violín de Belén, reconstruido a partir de sus fotografías.
//  Unidades: 1 = 100 mm. Cuerpo (356 mm) centrado en el origen, a lo largo
//  de +Y (voluta arriba). La tapa mira hacia +Z. +X = lado de la Mi (agudo).
// ─────────────────────────────────────────────────────────────────────────

const L = 3.58;
export const DIM = {
  yTop: L / 2,
  yBot: -L / 2,
  rib: 0.15,
  archTop: 0.155,
  archBack: 0.145,
  plate: 0.028,
  bridgeY: -0.164,
  nutY: 3.1,
  fbEndY: 0.42,
};

// Con ?bake (sólo en desarrollo) se parte de las fotos en bruto (tools/raw) y se generan la máscara de las efes y la
// tapa con el filo corregido; tools/bake-top.mjs las guarda en public/tex. En producción se cargan ya horneadas.
const BAKE = import.meta.env.DEV && new URLSearchParams(location.search).has('bake');
export const manager = new THREE.LoadingManager();
export const texturesReady = new Promise((res) => { manager.onLoad = res; manager.onError = res; });
const loader = new THREE.TextureLoader(manager);
const photo = (url, srgb = true) => {
  // rutas relativas a la base del sitio (funciona igual en local y en GitHub Pages)
  const t = loader.load(import.meta.env.BASE_URL + url.replace(/^\//, ''));
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

// ── Contorno real (medido en la foto del fondo) ──────────────────────────
const PROFILE = (() => {
  const p = VD.profile.slice();
  // suavizado ligero conservando esquinas
  const s = p.map((v, i) => (i === 0 || i === p.length - 1 ? 0 : (p[i - 1] + 2 * v + p[i + 1]) / 4));
  return s;
})();
const NP = PROFILE.length - 1;

export function halfWidth(y) {
  const v = (DIM.yTop - y) / L;
  if (v <= 0 || v >= 1) return 0;
  const f = v * NP, i = Math.floor(f), t = f - i;
  return (PROFILE[i] * (1 - t) + PROFILE[Math.min(i + 1, NP)] * t) * L;
}

export function outlinePoints(scale = 1, n = NP) {
  const right = [];
  for (let k = 0; k <= n; k++) {
    const y = DIM.yTop - (k / n) * L;
    right.push(new THREE.Vector3(halfWidth(y) * scale, y * (1 - (1 - scale) * 0.4), 0));
  }
  // el extremo superior/inferior se redondea para evitar picos
  const left = right.slice(1, -1).reverse().map((p) => new THREE.Vector3(-p.x, p.y, 0));
  return right.concat(left);
}

export function plateZ(x, y, sign = 1) {
  const hw = halfWidth(y);
  const H = sign > 0 ? DIM.archTop : DIM.archBack;
  if (hw <= 1e-4) return sign * DIM.rib;
  const u = THREE.MathUtils.clamp(x / hw, -1, 1);
  const v = (DIM.yTop - y) / L;
  // perfil transversal: meseta central y "canal" cerca del borde
  const a = Math.pow(Math.cos((u * Math.PI) / 2), 1.35) * (1 - 0.08 * Math.pow(Math.abs(u), 8));
  const b = Math.pow(Math.max(Math.sin(Math.PI * v), 0), 0.5);
  return sign * (DIM.rib + H * a * b);
}

// Coordenadas de foto (tapa y fondo)
function photoUV(meta, x, y, mirror) {
  const ppu = meta.L / L;
  const px = meta.cx + (mirror ? -x : x) * 0.992 * ppu;
  const py = meta.top + (DIM.yTop - y * 0.995 - (DIM.yTop * 0.005)) * ppu;
  return [(px - meta.crop.x) / meta.crop.w, 1 - (py - meta.crop.y) / meta.crop.h];
}

// ── Utilidades geométricas ───────────────────────────────────────────────
function ensureFacing(geo, axisSign, axis = 2) {
  const pos = geo.attributes.position, idx = geo.index.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let sum = 0;
  for (let i = 0; i < idx.length; i += 3 * 7) {
    a.fromBufferAttribute(pos, idx[i]); b.fromBufferAttribute(pos, idx[i + 1]); c.fromBufferAttribute(pos, idx[i + 2]);
    sum += b.clone().sub(a).cross(c.clone().sub(a)).getComponent(axis);
  }
  if (Math.sign(sum) !== axisSign) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  geo.computeVertexNormals();
  return geo;
}

function plateGeometry(sign, inset = 0, segU = 90, segV = 200) {
  const pos = [], uv = [], index = [];
  const meta = sign > 0 ? VD.front : VD.back;
  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    const y = DIM.yTop - v * L;
    const hw = halfWidth(y);
    for (let i = 0; i <= segU; i++) {
      const u = (i / segU) * 2 - 1;
      // concentra vértices cerca del borde (donde cambia la curvatura)
      const uu = Math.sign(u) * (1 - Math.pow(1 - Math.abs(u), 1.3));
      const x = uu * hw;
      pos.push(x, y, plateZ(x, y, sign) - sign * inset);
      uv.push(...photoUV(meta, x, y, sign < 0));
    }
  }
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return ensureFacing(g, sign);
}

// Tubo de sección variable (elíptica) a lo largo de una curva
export function variableTube(curve, segs, radial, radiusFn, closed = false) {
  const frames = curve.computeFrenetFrames(segs, closed);
  const pos = [], uv = [], index = [];
  const P = new THREE.Vector3(), V = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, P);
    const N = frames.normals[i], B = frames.binormals[i];
    const [rn, rb] = radiusFn(t);
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      V.copy(P).addScaledVector(N, Math.cos(th) * rn).addScaledVector(B, Math.sin(th) * rb);
      pos.push(V.x, V.y, V.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function taperedBox(y0, y1, widthFn, zTopFn, depthFn, segY = 12, round = 0) {
  const g = new THREE.BoxGeometry(1, 1, 1, round ? 8 : 1, segY, round ? 6 : 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y + 0.5;
    let nx = x * widthFn(t);
    const nz = zTopFn(t) + (z - 0.5) * depthFn(t);
    if (round) nx *= 1 - Math.pow(0.5 - z, 2.2) * round;
    p.setXYZ(i, nx, y0 + (y1 - y0) * t, nz);
  }
  g.computeVertexNormals();
  return g;
}

// ── Cabeza: silueta medida en la foto lateral (píxeles de la foto) ──────
const HEAD = {
  s: 1410, nutPx: 1900, frontPx: 1235, // escala y referencias (px a 1568 de ancho)
  pts: [
    [1235, 2010], [1235, 1900], [1225, 1700], [1190, 1560], [1120, 1380], [1050, 1230], [980, 1100], [925, 1010], [880, 965],
    [960, 955], [1040, 900], [1095, 800], [1115, 680], [1090, 560], [1020, 470], [920, 425], [790, 415], [660, 445],
    [540, 520], [455, 630], [415, 760], [410, 900], [430, 1050], [470, 1190], [530, 1310], [610, 1410], [700, 1500],
    [790, 1590], [850, 1680], [870, 1760], [840, 1850], [790, 1920], [775, 1960], [800, 1995], [850, 2010],
  ],
};
const headYZ = (px, py) => [DIM.nutY + (HEAD.nutPx - py) / HEAD.s, 0.405 - (HEAD.frontPx - px) / HEAD.s];
function headUV(y, z) {
  const px = 1.28 * (HEAD.frontPx - (0.405 - z) * HEAD.s);
  const py = 1.28 * (HEAD.nutPx - (y - DIM.nutY) * HEAD.s);
  const c = VD.scroll.crop;
  return [(px - c.x) / c.w, 1 - (py - c.y) / c.h];
}

// Etiqueta curvada: rejilla que sigue la superficie interior del fondo
function curvedLabel(cx, cy, w, h, offset) {
  const nu = 28, nv = 12, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    const y = cy - w / 2 + u * w, x = cx + h / 2 - v * h;
    pos.push(x, y, plateZ(x, y, -1) + DIM.plate + offset);
    uv.push(u, v);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return ensureFacing(g, 1);
}
// ── Construcción completa ────────────────────────────────────────────────
export function buildViolin(renderer) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const T = {
    top: photo(BAKE ? '/tools/raw/top.jpg' : '/tex/top.webp'), topN: photo('/tex/top-n.webp', false),
    topMask: photo(BAKE ? '/tools/raw/top-mask.png' : '/tex/top-alpha.png', false), holes: photo('/tex/top-holes.png', false),
    back: photo('/tex/back.webp'), backN: photo('/tex/back-n.webp', false),
    scroll: photo('/tex/scroll.webp'), scrollN: photo('/tex/scroll-n.webp', false),
    rib: photo('/tex/rib.webp'), ribN: photo('/tex/rib-n.webp', false),
    neck: photo('/tex/neck.webp'), neckN: photo('/tex/neck-n.webp', false),
    raw: photo('/tex/raw.webp'), ebony: ebonyTexture(),
  };
  Object.values(T).forEach((t) => (t.anisotropy = aniso));
  for (const k of ['rib', 'ribN']) { T[k].wrapS = T[k].wrapT = THREE.MirroredRepeatWrapping; }
  for (const k of ['neck', 'neckN']) T[k].wrapS = T[k].wrapT = THREE.ClampToEdgeWrapping;
  T.raw.wrapS = T.raw.wrapT = THREE.RepeatWrapping;
  T.raw.repeat.set(2, 5);
  // interior: abeto oscuro real (franja de foto), a escala (~62 × 47 mm por tesela)
  T.inner = photo('/tex/inner.webp'); T.innerN = photo('/tex/inner-n.webp', false);
  for (const k of ['inner', 'innerN']) { T[k].wrapS = T[k].wrapT = THREE.MirroredRepeatWrapping; T[k].repeat.set(3.4, 7.6); }
  T.innerObj = T.inner.clone(); T.innerObj.repeat.set(1.5, 3); T.innerObj.needsUpdate = true;
  T.bridge = photo('/tex/bridge.webp'); T.bridge.wrapS = T.bridge.wrapT = THREE.RepeatWrapping; T.bridge.repeat.set(1, 1);
  T.wind = windingNormal();
  T.fwall = fwallTexture(); T.fwall.wrapT = THREE.ClampToEdgeWrapping;

  // Barniz antiguo: satinado, no plástico. Relieve real sacado de las fotos.
  const aged = { clearcoat: 0.3, clearcoatRoughness: 0.42, sheen: 0.12, sheenColor: new THREE.Color('#ff9b52'), sheenRoughness: 0.7 };
  const nrm = (t, s) => ({ normalMap: t, normalScale: new THREE.Vector2(s, s) });
  const M = {
    top: new THREE.MeshPhysicalMaterial({ map: T.top, ...nrm(T.topN, 0.9), alphaMap: T.topMask, alphaTest: 0.5, roughness: 0.58, ...aged }),
    back: new THREE.MeshPhysicalMaterial({ map: T.back, ...nrm(T.backN, 0.8), roughness: 0.55, ...aged }),
    head: new THREE.MeshPhysicalMaterial({ map: T.scroll, ...nrm(T.scrollN, 0.9), roughness: 0.55, ...aged }),
    pegboxIn: new THREE.MeshStandardMaterial({ color: '#2a170c', roughness: 0.85 }),
    headEdge: new THREE.MeshPhysicalMaterial({ map: T.rib, ...nrm(T.ribN, 0.6), color: '#e8c9a8', roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
    rib: new THREE.MeshPhysicalMaterial({ map: T.rib, ...nrm(T.ribN, 0.7), roughness: 0.52, ...aged }),
    neck: new THREE.MeshPhysicalMaterial({ map: T.neck, ...nrm(T.neckN, 0.5), roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.28 }),
    fwall: new THREE.MeshStandardMaterial({ map: T.fwall, roughness: 0.82, envMapIntensity: 0.25, side: THREE.DoubleSide }),
    edgeTop: new THREE.MeshPhysicalMaterial({ map: T.top, ...nrm(T.topN, 0.9), roughness: 0.55, ...aged, color: '#b8916a' }),
    edgeBack: new THREE.MeshPhysicalMaterial({ map: T.back, ...nrm(T.backN, 0.9), roughness: 0.55, ...aged }),
    innerTop: new THREE.MeshStandardMaterial({ map: T.inner, normalMap: T.innerN, normalScale: new THREE.Vector2(0.6, 0.6), color: '#c9b39b', alphaMap: T.topMask, alphaTest: 0.5, roughness: 0.95, side: THREE.BackSide, envMapIntensity: 0.12 }),
    inner: new THREE.MeshStandardMaterial({ map: T.inner, normalMap: T.innerN, normalScale: new THREE.Vector2(0.6, 0.6), color: '#c9b39b', roughness: 0.95, side: THREE.BackSide, envMapIntensity: 0.12 }),
    raw: new THREE.MeshStandardMaterial({ map: T.innerObj, color: '#d8c2a6', roughness: 0.92, envMapIntensity: 0.2 }),
    ebony: new THREE.MeshPhysicalMaterial({ map: T.ebony, roughness: 0.46, clearcoat: 0.22, clearcoatRoughness: 0.5, envMapIntensity: 0.55 }),
    bridge: new THREE.MeshStandardMaterial({ map: T.bridge, color: '#e6cfa6', roughness: 0.55 }),
    chin: new THREE.MeshPhysicalMaterial({ map: T.raw, color: '#b0573a', roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.2 }),
    dark: new THREE.MeshStandardMaterial({ color: '#070403', roughness: 0.9 }),
    light: new THREE.MeshBasicMaterial({ color: '#ffd59a', alphaMap: T.holes, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, toneMapped: false, opacity: 0.85 }),
    pearl: new THREE.MeshPhysicalMaterial({ color: '#f6f1ea', roughness: 0.12, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 }),
    silver: new THREE.MeshStandardMaterial({ color: '#d8d4cd', metalness: 1, roughness: 0.22 }),
    tuner: new THREE.MeshStandardMaterial({ color: '#2a2622', metalness: 0.8, roughness: 0.32 }),
    silk: new THREE.MeshStandardMaterial({ color: '#1f5a4e', roughness: 0.75 }),
    hair: new THREE.MeshStandardMaterial({ color: '#cfc4ae', roughness: 0.92, envMapIntensity: 0.25, side: THREE.DoubleSide }),
    stick: new THREE.MeshPhysicalMaterial({ color: '#4a2210', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }),
  };

  // detalle de veta de abeto (líneas de verano finas, rectas a lo largo) sobre la tapa y su canto
  const spruceDetail = (m) => {
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vPL;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPL = position;');
      sh.fragmentShader = 'varying vec3 vPL;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float gx = vPL.x * 560.0 + sin(vPL.y * 2.3 + vPL.x * 7.0) * 2.2 + sin(vPL.y * 11.0) * 0.35;
        float late = pow(abs(sin(gx)), 18.0);
        float fine = pow(abs(sin(gx * 3.1 + 1.7)), 30.0);
        diffuseColor.rgb *= 1.0 - late * 0.13 - fine * 0.05;`);
    };
  };
  spruceDetail(M.top); spruceDetail(M.edgeTop);
  const violin = new THREE.Group();
  violin.name = 'violin';
  let parent = violin;
  const add = (mesh, cast = true, receive = true) => { mesh.castShadow = cast; mesh.receiveShadow = receive; parent.add(mesh); return mesh; };

  // ── Efes: contorno remuestreado y suavizado (sin escalones), y máscara de corte en alta resolución
  //    dibujada con ese mismo contorno → el corte de la tapa y el canto 3D coinciden al milímetro
  for (const f of VD.fholes) {
    const P = f.loop; if (!P || P.length < 10) continue;
    const n = P.length, cum = [0];
    for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + Math.hypot(P[i % n][0] - P[i - 1][0], P[i % n][1] - P[i - 1][1]));
    const tot = cum[n], N = 640, R = [];
    for (let k = 0, j = 0; k < N; k++) {
      const s = (k / N) * tot; while (cum[j + 1] < s) j++;
      const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1), a = P[j], b = P[(j + 1) % n];
      R.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    // giro local: se conservan las puntas (muescas y alas), se suaviza el resto
    const turn = R.map((_, i) => {
      const a = R[(i - 4 + N) % N], b = R[i], c2 = R[(i + 4) % N];
      const u = Math.atan2(b[1] - a[1], b[0] - a[0]), v = Math.atan2(c2[1] - b[1], c2[0] - b[0]);
      let d = Math.abs(v - u); if (d > Math.PI) d = 2 * Math.PI - d; return d;
    });
    const S = R.map((p0, i) => {
      if (turn[i] > 0.9) { const a = R[(i - 1 + N) % N], b = R[(i + 1) % N]; return [p0[0] * 0.5 + (a[0] + b[0]) * 0.25, p0[1] * 0.5 + (a[1] + b[1]) * 0.25]; }
      let x = 0, y = 0, w = 0;
      for (let k = -6; k <= 6; k++) { const q = R[(i + k + N) % N], g = Math.exp(-(k * k) / 8); x += q[0] * g; y += q[1] * g; w += g; }
      return [x / w, y / w];
    });
    f.loop = S;
  }
  if (BAKE) {
    const baked = (window.__bake = {});
    const img0 = T.topMask.image;
    const build = (img) => {
      const W = img.width, H = img.height;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, W, H);
      const toPx = ([x, y]) => { const [u, v] = photoUV(VD.front, x, y, false); return [u * W, (1 - v) * H]; };
      for (const f of VD.fholes) {
        if (!f.loop) continue;
        const pts = f.loop.map(toPx);
        cx.beginPath(); pts.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath();
        // borra el corte antiguo de la foto y cualquier resto suelto alrededor (motas que dejaban agujeros en la tapa)
        cx.save(); cx.strokeStyle = '#fff'; cx.lineWidth = 64; cx.lineJoin = 'round'; cx.stroke(); cx.restore();
        cx.fillStyle = '#fff'; cx.fill();
        cx.globalCompositeOperation = 'source-over';
        cx.save(); cx.fillStyle = '#000'; cx.beginPath(); pts.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath(); cx.fill(); cx.restore();
        // la tapa monta 1-2 px sobre el canto: así no queda rendija entre el corte y su pared
        cx.save(); cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.lineJoin = 'round'; cx.beginPath(); pts.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath(); cx.stroke(); cx.restore();
      }
      const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; t.flipY = T.topMask.flipY;
      M.top.alphaMap = t; M.innerTop.alphaMap = t; M.top.needsUpdate = true; M.innerTop.needsUpdate = true;
      baked.alpha = cv;
    };
    if (img0 && img0.width) build(img0); else T.topMask.onUpdate = () => { T.topMask.onUpdate = null; build(T.topMask.image); };

    // color de la tapa: el filo del corte se oscurece con el barniz (tapa la franja clara que dejaba la foto)
    const paintEdge = (img) => {
      const W = img.width, H = img.height;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
      const toPx = ([x, y]) => { const [u, v] = photoUV(VD.front, x, y, false); return [u * W, (1 - v) * H]; };
      const src = cx.getImageData(0, 0, W, H).data;
      for (const f of VD.fholes) {
        if (!f.loop) continue;
        const pts = f.loop.map(toPx);
        const path = () => { cx.beginPath(); pts.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath(); };
        // color del barniz sano alrededor (muestras a ~55 px del corte)
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < pts.length; i += 6) {
          const a = pts[(i + pts.length - 3) % pts.length], c = pts[(i + 3) % pts.length];
          let nx = c[1] - a[1], ny = -(c[0] - a[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
          // se mira a ambos lados; solo cuentan las muestras con color de barniz (el hueco es oscuro/gris)
          for (const s of [1, -1]) {
            const px = Math.round(pts[i][0] + s * nx * 55), py = Math.round(pts[i][1] + s * ny * 55);
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            const k = (py * W + px) * 4, R = src[k], G = src[k + 1], B = src[k + 2];
            const sat = Math.max(R, G, B) - Math.min(R, G, B);
            if (sat > 40 && R > G) { r += R; g += G; b += B; n++; }
          }
        }
        if (n > 10) {
          // La foto trae alrededor de las efes un reflejo pálido y desteñido. Se iguala el color a gran escala
          // con el del barniz sano (canal a canal), conservando la veta fina, con transición suave hacia fuera.
          const T0 = [r / n, g / n, b / n];
          let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
          pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
          const PAD = 170, FE = 90, RB = 40;
          const rx = Math.max(0, Math.floor(x0 - PAD)), ry = Math.max(0, Math.floor(y0 - PAD));
          const rw = Math.min(W, Math.ceil(x1 + PAD)) - rx, rh = Math.min(H, Math.ceil(y1 + PAD)) - ry;
          const id = cx.getImageData(rx, ry, rw, rh), d = id.data;
          // promedio local (imagen integral) por canal
          const S = [0, 1, 2].map((ch) => {
            const I = new Float64Array((rw + 1) * (rh + 1));
            for (let y = 0; y < rh; y++) { let acc = 0; for (let x = 0; x < rw; x++) { acc += d[(y * rw + x) * 4 + ch]; I[(y + 1) * (rw + 1) + x + 1] = I[y * (rw + 1) + x + 1] + acc; } }
            return I;
          });
          const box = (I, x, y) => {
            const xa = Math.max(0, x - RB), xb = Math.min(rw, x + RB + 1), ya = Math.max(0, y - RB), yb = Math.min(rh, y + RB + 1);
            return (I[yb * (rw + 1) + xb] - I[ya * (rw + 1) + xb] - I[yb * (rw + 1) + xa] + I[ya * (rw + 1) + xa]) / ((xb - xa) * (yb - ya));
          };
          const sm = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
          for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
            const edge = Math.min(x, y, rw - 1 - x, rh - 1 - y);
            const w = sm(0, FE, edge);
            if (w <= 0) continue;
            const k = (y * rw + x) * 4;
            for (let ch = 0; ch < 3; ch++) {
              const lo = Math.max(8, box(S[ch], x, y));
              const ratio = Math.min(1.7, Math.max(0.45, T0[ch] / lo));
              // además se recortan los brillos sueltos de la foto (motas claras junto al corte)
              const v = d[k + ch] * (1 + (ratio - 1) * w);
              d[k + ch] = Math.min(v, v * (1 - w) + T0[ch] * 1.3 * w);
            }
          }
          cx.putImageData(id, rx, ry);
        }
        cx.save(); cx.lineJoin = 'round';
        cx.filter = 'blur(2px)'; cx.strokeStyle = 'rgba(70,30,12,0.55)'; cx.lineWidth = 9; path(); cx.stroke();
        cx.filter = 'none'; cx.strokeStyle = 'rgba(48,20,8,0.9)'; cx.lineWidth = 3.5; path(); cx.stroke();
        cx.restore();
      }
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = T.top.colorSpace; t.flipY = T.top.flipY; t.anisotropy = 8;
      t.wrapS = T.top.wrapS; t.wrapT = T.top.wrapT;
      M.top.map = t; M.top.needsUpdate = true;
      baked.top = cv;
    };
    if (T.top.image && T.top.image.width) paintEdge(T.top.image); else T.top.onUpdate = () => { T.top.onUpdate = null; paintEdge(T.top.image); };
  }
  // (alphaToCoverage desactivado: coste alto con MSAA + sombras)

  // ── Tapa (con las efes recortadas de verdad) y fondo
  add(new THREE.Mesh(plateGeometry(1), M.top));
  // canto de las efes: el grosor de la tapa visto dentro del corte (madera viva, oscurecida por el barniz)
  for (const f of VD.fholes) {
    const L = f.loop; if (!L || L.length < 10) continue;
    const pos = [], uv = [], idx = [];
    let acc = 0;
    L.forEach(([x, y], i) => {
      if (i) acc += Math.hypot(x - L[i - 1][0], y - L[i - 1][1]);
      const zt = plateZ(x, y, 1);
      pos.push(x, y, zt + 0.0004, x, y, zt - DIM.plate);
      uv.push(acc * 0.8, 0, acc * 0.8, 1);
    });
    const n = L.length;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i * 2, j * 2, i * 2 + 1, j * 2, j * 2 + 1, i * 2 + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    add(new THREE.Mesh(g, M.fwall), true, true);
  }
  add(new THREE.Mesh(plateGeometry(1, DIM.plate), M.innerTop));
  add(new THREE.Mesh(plateGeometry(-1), M.back));
  add(new THREE.Mesh(plateGeometry(-1, DIM.plate), M.inner));
  const lightSheet = new THREE.Mesh(plateGeometry(1, DIM.plate + 0.003, 60, 140), M.light);
  lightSheet.renderOrder = 4;
  violin.add(lightSheet);

  // ── Aros: arce flameado de su propio fondo; por dentro, madera cruda
  {
    const pts = outlinePoints(0.982, 300);
    const pos = [], uv = [], index = [];
    let acc = 0;
    pts.forEach((p, i) => {
      if (i) acc += p.distanceTo(pts[i - 1]);
      pos.push(p.x, p.y, -DIM.rib, p.x, p.y, DIM.rib);
      uv.push(0, acc / 2.64, 1, acc / 2.64);
    });
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = i * 2, b = ((i + 1) % n) * 2;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    // normales hacia fuera: compruébalo en el punto más a la derecha
    const nx = g.attributes.normal.getX(0) * pts[0].x + g.attributes.normal.getX(Math.floor(n * 0.25) * 2) * pts[Math.floor(n * 0.25)].x;
    if (nx < 0) { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.computeVertexNormals(); }
    add(new THREE.Mesh(g, M.rib));
    add(new THREE.Mesh(g, M.inner), false, true);
    // contraaros (linings) arriba y abajo
    const lin = new THREE.CatmullRomCurve3(outlinePoints(0.955, 200), true);
    for (const s of [1, -1]) {
      const lp = lin.getSpacedPoints(400).map((p) => new THREE.Vector3(p.x, p.y, s * (DIM.rib - 0.03)));
      add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp, true), 500, 0.022, 6, true), M.raw));
    }
  }

  // ── Cantos: perfil real barrido a lo largo del contorno — canal, reborde levantado, canto redondeado,
  // vuelo de ~2 mm sobre el aro y vuelta por debajo hasta el aro. La foto continúa por encima: sin costura.
  {
    const curve = new THREE.CatmullRomCurve3(outlinePoints(1, 300), true, 'centripetal');
    const N = 1100;
    const P = curve.getSpacedPoints(N).slice(0, N);
    // normales 2D hacia fuera (suavizadas para no cruzarse en las esquinas)
    const area = P.reduce((s, p, i) => { const q = P[(i + 1) % N]; return s + p.x * q.y - q.x * p.y; }, 0);
    const ccw = area > 0 ? 1 : -1;
    let Nn = P.map((p, i) => { const a = P[(i - 1 + N) % N], b = P[(i + 1) % N]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return [ccw * dy / l, -ccw * dx / l]; });
    for (let it = 0; it < 3; it++) Nn = Nn.map((_, i) => { const a = Nn[(i - 1 + N) % N], b = Nn[i], c2 = Nn[(i + 1) % N]; const x = a[0] + 2 * b[0] + c2[0], y = a[1] + 2 * b[1] + c2[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; });
    // [desplazamiento hacia fuera, altura relativa, sobre la superficie de la tapa?]
    const PROF = [[-0.055, 0.0007, 1], [-0.042, -0.0035, 1], [-0.03, -0.0045, 1], [-0.017, 0.0025, 1], [-0.007, 0.0055, 1],
      [0.002, 0.0031, 0], [0.0075, 0.0004, 0], [0.0105, -0.005, 0], [0.011, -0.011, 0], [0.0095, -0.017, 0], [0.006, -0.0225, 0], [0.001, -0.026, 0], [null, -0.028, 0]];
    for (const s of [1, -1]) {
      const meta = s > 0 ? VD.front : VD.back;
      const pos = [], uv = [], idx = [];
      for (let j = 0; j < PROF.length; j++) {
        const [o, dz, onSurf] = PROF[j];
        for (let i = 0; i <= N; i++) {
          const p = P[i % N], [nx, ny] = Nn[i % N];
          let x, y;
          if (o === null) { x = p.x * 0.982; y = p.y * 0.9928; } else { x = p.x + nx * o; y = p.y + ny * o; }
          const zb = onSurf ? plateZ(x, y, s) : s * DIM.rib;
          pos.push(x, y, zb + s * dz);
          const oc = Math.min(o === null ? -0.02 : o, -0.02);
          const [u, v] = photoUV(meta, p.x + nx * oc, p.y + ny * oc, s < 0);
          uv.push(u, v);
        }
      }
      const R = N + 1;
      for (let j = 0; j < PROF.length - 1; j++) for (let i = 0; i < N; i++) { const a = j * R + i, b = a + 1, d = a + R, e = d + 1; idx.push(a, d, b, b, d, e); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      // la cara superior del canto debe mirar hacia fuera del violín (±z)
      if (g.attributes.normal.getZ(2 * R + 5) * s < 0) { const ia = g.index.array; for (let k = 0; k < ia.length; k += 3) { const t = ia[k + 1]; ia[k + 1] = ia[k + 2]; ia[k + 2] = t; } g.computeVertexNormals(); }
      add(new THREE.Mesh(g, s > 0 ? M.edgeTop : M.edgeBack));
    }
  }


  // ── Interior: alma, barra armónica, tacos, etiqueta y firma a lápiz
  const bassF = VD.fholes.find((f) => f.side < 0);
  const trebleF = VD.fholes.find((f) => f.side > 0);
  const interior = new THREE.Group();
  {
    const spX = 0.16, spY = DIM.bridgeY - 0.1;
    const zb = plateZ(spX, spY, -1) + DIM.plate, zt = plateZ(spX, spY, 1) - DIM.plate;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, zt - zb, 24), M.raw);
    post.rotation.x = Math.PI / 2;
    post.position.set(spX, spY, (zt + zb) / 2);
    interior.add(post);
    const bx = -0.17;
    const bar = taperedBox(-1.25, 1.2, () => 0.05, (t) => plateZ(bx, -1.25 + t * 2.45, 1) - DIM.plate, (t) => 0.02 + 0.1 * Math.pow(Math.sin(Math.PI * t), 0.8), 30);
    bar.translate(bx, 0, 0);
    interior.add(new THREE.Mesh(bar, M.raw));
    // tacos superior/inferior y de esquina, de tamaño real
    for (const [x, y, w, h] of [[0, 1.7, 0.36, 0.12], [0, -1.73, 0.36, 0.1]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, DIM.rib * 2 - 0.02), M.raw); b.position.set(x, y, 0); interior.add(b);
    }
    // etiqueta antigua bajo la efe grave, legible a través de ella
    const lx = (bassF.box.x0 + bassF.box.x1) / 2 + 0.09, ly = (bassF.box.y0 + bassF.box.y1) / 2;
    // pegada al fondo: sigue exactamente su abombado
    const lab = new THREE.Mesh(curvedLabel(lx, ly, 0.7, 0.24, 0.0015), new THREE.MeshStandardMaterial({ map: labelTexture('Belén Pérez'), color: '#7a6a52', roughness: 1, envMapIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2 }));
    interior.add(lab);
    interior.userData.label = lab;
    interior.userData.labelMat = lab.material;
    lab.userData.center = new THREE.Vector3(lx, ly, plateZ(lx, ly, -1) + DIM.plate + 0.005);
  }
  interior.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  violin.add(interior);

  // ── Haces de luz bajo cada efe (forma medida)
  const beams = [];
  for (const f of VD.fholes) {
    const rows = new Map();
    f.segs.forEach(([y, a, b]) => { const r = rows.get(y) || [a, b]; rows.set(y, [Math.min(r[0], a), Math.max(r[1], b)]); });
    const ys = [...rows.keys()].sort((a, b) => b - a);
    const shape = f.loop && f.loop.length > 10
      ? new THREE.Shape(f.loop.filter((_, i) => i % 3 === 0).map(([x, y]) => new THREE.Vector2(x, y)))
      : new THREE.Shape(ys.map((y) => new THREE.Vector2(rows.get(y)[0], y)).concat(ys.map((y) => new THREE.Vector2(rows.get(y)[1], y)).reverse()));
    const depth = 0.55;
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 2 });
    const p = g.attributes.position;
    const aD = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = z / depth;
      aD[i] = k;
      p.setXYZ(i, x + k * 0.14 * f.side, y - k * 0.2, plateZ(x, y, 1) - DIM.plate - z * 0.95);
    }
    g.setAttribute('aDepth', new THREE.BufferAttribute(aD, 1));
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uIntensity: { value: 1 }, uTime: { value: 0 } },
      vertexShader: 'attribute float aDepth; varying float vD; varying vec3 vP; void main(){ vD=aDepth; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying float vD; varying vec3 vP; uniform float uIntensity, uTime;
        void main(){ float fl = 0.85 + 0.15*sin(uTime*0.7 + vP.y*6.0); float a = pow(clamp(1.0-vD, 0.0, 1.0), 2.4)*0.12*max(uIntensity, 0.0)*fl; gl_FragColor = vec4(vec3(1.0,0.8,0.55)*a, a); }`,
    }));
    m.renderOrder = 5;
    violin.add(m);
    beams.push(m);
  }

  // ── Diapasón de ébano (abombado, lados rectos) y mástil en "C" de arce flameado
  const FB = { th: 0.055, crown: 0.42 };
  const fbZ = (t) => 0.56 + (0.405 - 0.56) * t; // superficie superior en el eje, t: 0 final → 1 cejuela
  const fbAtY = (y) => fbZ((y - DIM.fbEndY) / (DIM.nutY - DIM.fbEndY));
  // Ángulo del mástil: se conserva la proyección en el puente (≈25 mm) y en la unión con la caja
  // el diapasón queda a ~12 mm del borde de la tapa (6 mm de mástil + diapasón), como en un violín real.
  const PIV = { y: DIM.bridgeY, z: plateZ(0, DIM.bridgeY, 1) + 0.25 };
  const zJoint = plateZ(0, DIM.yTop - 0.03, 1) + 0.125;
  const a0 = Math.atan2(fbAtY(PIV.y) - fbAtY(DIM.yTop), DIM.yTop - PIV.y), a1 = Math.atan2(PIV.z - zJoint, DIM.yTop - PIV.y);
  const zShift = PIV.z - fbAtY(PIV.y); // baja todo el mástil para que la proyección sea la deseada
  const NA = -(a1 - a0), cNA = Math.cos(NA), sNA = Math.sin(NA);
  // coordenadas "del mástil" (y, z) → del violín
  const nk = (y, z) => { const dy = y - PIV.y, dz = z + zShift - PIV.z; return [PIV.y + dy * cNA - dz * sNA, PIV.z + dy * sNA + dz * cNA]; };
  const neckPivot = new THREE.Group(); neckPivot.position.set(0, PIV.y, PIV.z); neckPivot.rotation.x = NA;
  const neckG = new THREE.Group(); neckG.position.set(0, -PIV.y, -PIV.z + zShift); neckPivot.add(neckG); violin.add(neckPivot);
  parent = neckG;
  {
    const segY = 40, segX = 16;
    const pos = [], uv = [], index = [];
    // sección: arco superior + lados + base plana (perímetro cerrado)
    const ring = (w) => {
      const r = [];
      for (let i = 0; i <= segX; i++) { const u = -1 + (2 * i) / segX; r.push([u * w / 2, -((u * w / 2) ** 2) * FB.crown]); }
      r.push([w / 2, -FB.th]); r.push([-w / 2, -FB.th]);
      return r;
    };
    const RN = segX + 3;
    for (let j = 0; j <= segY; j++) {
      const t = j / segY, y = DIM.fbEndY + t * (DIM.nutY - DIM.fbEndY);
      const w = 0.425 + (0.24 - 0.425) * t;
      const r = ring(w);
      for (let i = 0; i < RN; i++) { pos.push(r[i][0], y, fbZ(t) + r[i][1]); uv.push(i / RN, t * 3); }
    }
    for (let j = 0; j < segY; j++) for (let i = 0; i < RN; i++) {
      const a = j * RN + i, b = j * RN + ((i + 1) % RN), c = a + RN, d = b + RN;
      index.push(a, b, c, b, d, c);
    }
    // tapas en los extremos
    const cap = (j, flip) => {
      const base = j * RN, c0 = pos.length / 3;
      const t = j / segY; pos.push(0, DIM.fbEndY + t * (DIM.nutY - DIM.fbEndY), fbZ(t) - FB.th / 2); uv.push(0.5, 0.5);
      for (let i = 0; i < RN; i++) flip ? index.push(c0, base + i, base + ((i + 1) % RN)) : index.push(c0, base + ((i + 1) % RN), base + i);
    };
    cap(0, false); cap(segY, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    // asegura normales hacia fuera (arriba en el centro)
    if (g.attributes.normal.getZ(Math.floor(segX / 2)) < 0) { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const k = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = k; } g.computeVertexNormals(); }
    add(new THREE.Mesh(g, M.ebony));
    parent = violin;

    // Mástil: sección en C bajo el diapasón, con talón que baja hasta el botón del fondo
    const y0 = DIM.yTop - 0.07, y1 = DIM.nutY + 0.03; // la raíz entra en la caja (mortaja del taco superior)
    const segN = 48, segT = 20;
    const npos = [], nuv = [], nidx = [];
    for (let j = 0; j <= segN; j++) {
      const t = j / segN, y = y0 + t * (y1 - y0);
      const zTopL = fbAtY(Math.min(y, DIM.nutY)) - FB.th;
      const [yw, zTop] = nk(y, zTopL);
      const w = 0.27 + (0.225 - 0.27) * t;
      const heel = 1 - THREE.MathUtils.smoothstep(yw, DIM.yTop - 0.02, DIM.yTop + 0.3);
      const zB0 = nk(y, zTopL - 0.15 - 0.03 * (1 - t))[1];
      const zBottom = THREE.MathUtils.lerp(zB0, -DIM.rib - 0.03, heel);
      const ww = w * (1 + heel * 0.25);
      for (let i = 0; i <= segT; i++) {
        const th = -Math.PI / 2 + (i / segT) * Math.PI;
        npos.push(Math.sin(th) * ww / 2, yw, zTop - Math.cos(th) * (zTop - zBottom));
        nuv.push(i / segT, t);
      }
    }
    for (let j = 0; j < segN; j++) for (let i = 0; i < segT; i++) {
      const a = j * (segT + 1) + i, b = a + 1, c = a + segT + 1, d = c + 1;
      nidx.push(a, c, b, b, c, d);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(npos, 3));
    ng.setAttribute('uv', new THREE.Float32BufferAttribute(nuv, 2));
    ng.setIndex(nidx);
    ng.computeVertexNormals();
    // normal en el fondo del mástil debe apuntar a -z
    const mid = Math.floor(segN / 2) * (segT + 1) + Math.floor(segT / 2);
    if (ng.attributes.normal.getZ(mid) > 0) { const idx = ng.index.array; for (let i = 0; i < idx.length; i += 3) { const k = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = k; } ng.computeVertexNormals(); }
    add(new THREE.Mesh(ng, M.neck));

    // cejuela de ébano: 0,6 mm por encima del diapasón bajo las cuerdas
    const nutTop = fbZ(1) + 0.008;
    const nut = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.045, nutTop - (fbZ(1) - FB.th)), M.ebony);
    nut.position.set(0, DIM.nutY + 0.0225, (nutTop + fbZ(1) - FB.th) / 2);
    neckG.add(nut); nut.castShadow = nut.receiveShadow = true;
    violin.userData.nutTop = nutTop; // en coordenadas del mástil
    violin.userData.nk = nk;

    // botón del fondo con su corona de ébano
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.04, 40, 1, false, -Math.PI / 2, Math.PI), M.back);
    btn.rotation.x = Math.PI / 2; btn.position.set(0, DIM.yTop - 0.01, -DIM.rib - 0.012);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.034, 40, 1, false, -Math.PI / 2, Math.PI), M.ebony);
    crown.rotation.x = Math.PI / 2; crown.position.set(0, DIM.yTop - 0.011, -DIM.rib - 0.009);
    add(crown); add(btn);
  }

  // ── Cabeza: clavijero hueco (dos carrilleras + fondo) y voluta maciza
  const headW = 0.24, cheek = 0.045;
  const pegYZ = [];
  parent = neckG;
  {
    const throatPy = 965;
    const scrollPts = HEAD.pts.filter(([, py]) => py <= throatPy + 1);
    const frontPts = HEAD.pts.slice(0, HEAD.pts.findIndex(([px, py]) => px === 880 && py === 965) + 1);
    const backPts = HEAD.pts.slice(HEAD.pts.findIndex(([px, py]) => px === 430 && py === 1050));
    const toShape = (pts) => new THREE.Shape(pts.map(([px, py]) => { const [y, z] = headYZ(px, py); return new THREE.Vector2(z, y); }));
    const extrude = (shape, x0, width, mat, bevel = 0.012) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(width - 2 * bevel, 0.002), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 6 });
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const sz = p.getX(i), sy = p.getY(i), sx = p.getZ(i);
        p.setXYZ(i, x0 - sx, sy, sz);
        const [u, v] = headUV(sy, sz);
        uv.setXY(i, u, v);
      }
      // paredes laterales (lomo del clavijero y de la voluta): arce flameado real, llamas cruzando el ancho
      const side = g.groups.find((gr) => gr.materialIndex === 1);
      if (side && (mat === M.head || Array.isArray(mat))) {
        for (let i = side.start; i < side.start + side.count; i++) {
          uv.setXY(i, (p.getX(i) + headW / 2) / 0.3, (p.getY(i) * 0.8 - p.getZ(i) * 0.6) / 2.64);
        }
      }
      g.computeVertexNormals();
      return add(new THREE.Mesh(g, mat === M.head ? [M.head, M.headEdge] : mat));
    };
    // voluta maciza (por encima de la garganta) + cierre a la altura de la garganta
    const sc = scrollPts.slice();
    sc.push([412, 965]);
    extrude(toShape(sc), headW / 2 - 0.012, headW, M.head);
    // carrilleras del clavijero (silueta del clavijero)
    const box = frontPts.concat([[412, 965]], backPts);
    extrude(toShape(box), headW / 2 - 0.006, cheek, M.head, 0.006);
    extrude(toShape(box), -headW / 2 + cheek - 0.006, cheek, M.head, 0.006);
    // pared trasera y fondo del hueco (oscuros)
    // la pared trasera arranca en la garganta (sin hueco bajo la voluta)
    const bwp = [[400, 940], [412, 985]].concat(backPts);
    const backWall = bwp.map(([px, py]) => [px, py]).concat(bwp.slice().reverse().map(([px, py]) => [px + 85, py]));
    extrude(toShape(backWall), headW / 2 - cheek, headW - 2 * cheek, [M.pegboxIn, M.headEdge], 0.002);
    const floor = [[1235, 2010], [1235, 1880], [800, 1880], [850, 2010]];
    extrude(toShape(floor), headW / 2 - cheek, headW - 2 * cheek, M.pegboxIn, 0.002);

    // espirales talladas a ambos lados + ojo
    const [cy, cz] = headYZ(895, 715);
    const turns = 2.25 * Math.PI * 2, k = Math.log(0.21 / 0.035) / turns;
    for (const sx of [1, -1]) {
      const curve = new THREE.Curve();
      curve.getPoint = (t, tg = new THREE.Vector3()) => {
        const a = Math.PI / 2 - t * turns;
        const r = 0.21 * Math.exp(-k * t * turns);
        return tg.set(sx * headW / 2, cy + Math.sin(a) * r, cz + Math.cos(a) * r);
      };
      const ridge = variableTube(curve, 360, 16, (t) => {
        const r = 0.21 * Math.exp(-k * t * turns);
        return [r * 0.2, 0.02 + 0.028 * t];
      });
      const rp = ridge.attributes.position, ru = ridge.attributes.uv;
      for (let i = 0; i < rp.count; i++) { const [u, v] = headUV(rp.getY(i), rp.getZ(i)); ru.setXY(i, u, v); }
      add(new THREE.Mesh(ridge, M.head));
      const eg = new THREE.SphereGeometry(0.042, 28, 18);
      const ep = eg.attributes.position, eu = eg.attributes.uv;
      for (let i = 0; i < ep.count; i++) { const [u, v] = headUV(cy + ep.getY(i), cz + ep.getZ(i)); eu.setXY(i, u, v); }
      const eye = new THREE.Mesh(eg, M.head);
      eye.scale.set(1.2, 1, 1);
      eye.position.set(sx * (headW / 2 + 0.03), cy, cz);
      add(eye);
    }

    // Clavijas en su sitio exacto (foto lateral): cabeza oval de ébano con punto de nácar
    const pegs = [
      { px: [1040, 1745], side: -1, rot: -0.85 },
      { px: [960, 1515], side: 1, rot: -0.6 },
      { px: [760, 1245], side: -1, rot: -0.1 },
      { px: [578, 1035], side: 1, rot: 0.2 },
    ];
    pegs.forEach((pg, i) => {
      const [y, z] = headYZ(...pg.px);
      pegYZ.push([y, z]);
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.028, headW + 0.06, 18), M.ebony);
      shaft.rotation.z = Math.PI / 2;
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.04, 22), M.ebony);
      collar.rotation.z = Math.PI / 2; collar.position.x = pg.side * (headW / 2 + 0.035);
      // cabeza tipo botón: más redonda que ovalada, de caras algo planas
      const head = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), M.ebony);
      head.scale.set(0.034, 0.078, 0.104);
      head.position.x = pg.side * (headW / 2 + 0.1);
      head.rotation.x = pg.rot;
      // botón (bola) entre el cuello y la cabeza
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), M.ebony);
      knob.scale.set(1.1, 1, 1);
      knob.position.x = pg.side * (headW / 2 + 0.06);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 10), M.pearl);
      dot.position.set(pg.side * (headW / 2 + 0.129), 0, 0);
      // cuerda enrollada en el eje, dentro del hueco
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 16), i % 2 ? M.silk : M.silver);
      wrap.rotation.z = Math.PI / 2; wrap.position.x = [-0.04, 0.03, -0.02, 0.04][i];
      g.add(shaft, collar, knob, head, dot, wrap);
      g.position.set(0, y, z);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      neckG.add(g);
    });
  }
  parent = violin;

  // ── Puente: arco superior calculado (las cuerdas apoyan exactamente encima)
  const bridgeBaseZ = plateZ(0, DIM.bridgeY, 1);
  const BR = { H: 0.305, W: 0.205 };
  const bridgeTop = (x) => BR.H - 1.15 * x * x - 0.03 * x; // lado Mi (x>0) algo más bajo
  {
    const s = new THREE.Shape();
    const W = BR.W;
    s.moveTo(-W, 0); s.lineTo(-W + 0.085, 0);
    s.quadraticCurveTo(-0.07, 0.07, -0.05, 0); s.lineTo(0.05, 0);
    s.quadraticCurveTo(0.07, 0.07, W - 0.085, 0); s.lineTo(W, 0);
    // costado: cintura con la muesca redonda que forma la "oreja" (como un puente real)
    s.bezierCurveTo(W - 0.004, 0.04, W - 0.012, 0.085, W - 0.022, 0.105);
    s.bezierCurveTo(W - 0.045, 0.112, W - 0.082, 0.118, W - 0.084, 0.132);
    s.bezierCurveTo(W - 0.085, 0.146, W - 0.05, 0.15, W - 0.024, 0.162);
    s.bezierCurveTo(W - 0.004, 0.18, W - 0.004, 0.24, 0.195, bridgeTop(0.195));
    for (let i = 1; i <= 30; i++) { const x = 0.195 - (0.39 * i) / 30; s.lineTo(x, bridgeTop(x)); }
    s.bezierCurveTo(-W + 0.004, 0.24, -W + 0.004, 0.18, -W + 0.024, 0.162);
    s.bezierCurveTo(-W + 0.05, 0.15, -W + 0.085, 0.146, -W + 0.084, 0.132);
    s.bezierCurveTo(-W + 0.082, 0.118, -W + 0.045, 0.112, -W + 0.022, 0.105);
    s.bezierCurveTo(-W + 0.012, 0.085, -W + 0.004, 0.04, -W, 0);
    const heart = new THREE.Path();
    heart.moveTo(0, 0.14); heart.bezierCurveTo(0.05, 0.19, 0.04, 0.24, 0, 0.21); heart.bezierCurveTo(-0.04, 0.24, -0.05, 0.19, 0, 0.14);
    s.holes.push(heart);
    for (const sx of [-1, 1]) { const k = new THREE.Path(); k.absellipse(sx * 0.098, 0.192, 0.03, 0.009, 0, Math.PI * 2, false, -sx * 0.3); s.holes.push(k); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 20 });
    g.translate(0, 0, -0.011);
    // se adelgaza hacia arriba (4 mm en los pies, 1,3 mm arriba)
    const gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      gp.setZ(i, gp.getZ(i) * (1 - 0.6 * Math.min(1, gp.getY(i) / BR.H)));
      // pies ajustados al arqueado de la tapa
      const y = gp.getY(i);
      if (y < 0.05) gp.setY(i, y + (plateZ(gp.getX(i), DIM.bridgeY, 1) - bridgeBaseZ) * (1 - y / 0.05));
    }
    g.computeVertexNormals();
    g.rotateX(Math.PI / 2);
    const br = new THREE.Mesh(g, M.bridge);
    br.position.set(0, DIM.bridgeY, bridgeBaseZ - 0.001);
    add(br);
  }

  // ── Cordal de ébano con ceja, agujeros y afinador; botón; barbada central de boj
  const tailTopY = -0.65, tailBotY = -1.74;
  const tz = (t) => plateZ(0, tailBotY + t * (tailTopY - tailBotY), 1) + 0.05 + 0.07 * t; // superficie superior
  const fretTop = tz(1) + 0.032;
  {
    const tp = taperedBox(tailBotY, tailTopY, (t) => 0.17 + 0.28 * Math.pow(t, 1.6), tz, () => 0.045, 18, 0.35);
    // lomo central (estilo Hill)
    const tpp = tp.attributes.position;
    for (let i = 0; i < tpp.count; i++) { const z = tpp.getZ(i), x = tpp.getX(i); tpp.setZ(i, z + 0.012 * Math.max(0, 1 - Math.abs(x) / 0.2)); }
    tp.computeVertexNormals();
    add(new THREE.Mesh(tp, M.ebony));
    const fret = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.4, 6, 12), M.ebony);
    fret.rotation.z = Math.PI / 2;
    fret.position.set(0, tailTopY - 0.016, fretTop - 0.014);
    add(fret);
    [-0.12, -0.04, 0.04].forEach((x) => {
      const h = new THREE.Mesh(new THREE.CircleGeometry(0.014, 16), M.dark);
      h.position.set(x, tailTopY - 0.13, tz(0.88) + 0.013 + 0.012 * Math.max(0, 1 - Math.abs(x) / 0.2));
      add(h, false, false);
    });
    const ft = new THREE.Group();
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 18), M.tuner);
    screw.rotation.x = Math.PI / 2;
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.018), M.tuner);
    lever.position.set(0, 0.04, -0.02);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 20), M.tuner);
    head.rotation.x = Math.PI / 2; head.position.z = 0.035;
    ft.add(screw, lever, head);
    ft.position.set(0.14, tailTopY - 0.13, tz(0.88) + 0.04);
    ft.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    violin.add(ft);

    const endpin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.06, 20), M.ebony);
    endpin.position.set(0, DIM.yBot - 0.025, 0);
    add(endpin);

    // barbada: pieza tallada de verdad. Se apoya en la tapa siguiendo su arqueado,
    // forma un puente sobre el cordal, borde redondeado y cazoleta cóncava en el lado grave.
    {
      const cs = new THREE.Shape();
      cs.moveTo(-0.58, -0.02);
      cs.quadraticCurveTo(0, 0.07, 0.5, 0.02);
      cs.bezierCurveTo(0.6, -0.2, 0.42, -0.58, 0.05, -0.64);
      cs.bezierCurveTo(-0.4, -0.7, -0.66, -0.34, -0.58, -0.02);
      const ox = -0.07, oy = -1.25, NT = 200, SC = 0.8;
      const ring = cs.getSpacedPoints(NT).slice(0, NT).map((p) => new THREE.Vector2(p.x * SC + ox, p.y * SC + oy));
      const C = ring.reduce((a, p) => a.add(p), new THREE.Vector2()).multiplyScalar(1 / NT);
      const dishC = new THREE.Vector2(C.x - 0.11, C.y + 0.02);
      // perfil de la sección: [s (0 centro → 1 borde), z relativa, superior?]
      const prof = [[0, 0, 0], [0.9, 0, 0], [0.97, 0.004, 0], [1, 0.026, 0], [1, 0.07, 1], [0.99, 0.11, 1], [0.965, 0.138, 1], [0.93, 0.152, 1],
        [0.88, 0.156, 1], [0.8, 0.15, 1], [0.66, 0.13, 1], [0.48, 0.11, 1], [0.28, 0.1, 1], [0, 0.097, 1]];
      const under = (x) => 0.006 + 0.085 * Math.exp(-Math.pow(x / 0.26, 2)); // puente sobre el cordal
      const pos = [], uvs = [], idx = [];
      for (let j = 0; j < prof.length; j++) {
        const [s, zr, top] = prof[j];
        for (let i = 0; i <= NT; i++) {
          const P = ring[i % NT];
          const x = C.x + (P.x - C.x) * s, y = C.y + (P.y - C.y) * s;
          let z = plateZ(Math.max(-0.95, Math.min(0.95, x)), Math.max(DIM.yBot + 0.02, y), 1) + under(x) + zr;
          if (top && s < 0.93) {
            const dx = (x - dishC.x) / 0.3, dy = (y - dishC.y) / 0.2;
            z -= 0.06 * Math.pow(Math.max(0, 1 - dx * dx - dy * dy), 0.8) * THREE.MathUtils.smoothstep(0.93 - s, 0, 0.12);
          }
          pos.push(x, y, z);
          uvs.push(x * 0.5 + z * 0.4, y * 1.1);
        }
      }
      const R = NT + 1;
      for (let j = 0; j < prof.length - 1; j++) for (let i = 0; i < NT; i++) {
        const a = j * R + i, b = a + 1, d = a + R, e = d + 1;
        idx.push(a, b, d, b, e, d);
      }
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      cg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      cg.setIndex(idx);
      const cgm = mergeVertices(cg, 1e-5); // sin costura en el cierre del anillo
      cg.copy(cgm);
      cg.computeVertexNormals();
      // la cara superior (último anillo) debe mirar hacia +z
      let top = 0; { const pa = cg.attributes.position; for (let k = 1; k < pa.count; k++) if (pa.getZ(k) > pa.getZ(top)) top = k; }
      if (cg.attributes.normal.getZ(top) < 0) { const ia = cg.index.array; for (let k = 0; k < ia.length; k += 3) { const t = ia[k + 1]; ia[k + 1] = ia[k + 2]; ia[k + 2] = t; } cg.computeVertexNormals(); }
      const chin = new THREE.Mesh(cg, M.chin);
      add(chin);
      // abrazaderas de níquel que bajan por el aro
      const nickel = new THREE.MeshStandardMaterial({ color: '#cfc9bf', metalness: 1, roughness: 0.28 });
      for (const bx of [-0.3, 0.22]) {
        let yy = DIM.yBot;
        for (let y = DIM.yBot; y < DIM.yBot + 0.8; y += 0.002) if (halfWidth(y) >= Math.abs(bx)) { yy = y; break; }
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, DIM.rib * 2 + 0.05, 18), nickel);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(bx, yy - 0.024, 0);
        add(barrel);
      }
    }
  }

  // ── Cuerdas: cejuela → puente (vibran) → ceja del cordal → agujero (seda)
  const SDEF = [
    { name: 'Sol', x: -0.165, nx: -0.081, r: 0.0042, color: '#b8b2a8' },
    { name: 'Re', x: -0.055, nx: -0.027, r: 0.0037, color: '#c9ccd0' },
    { name: 'La', x: 0.055, nx: 0.027, r: 0.0031, color: '#c9ccd0' },
    { name: 'Mi', x: 0.165, nx: 0.081, r: 0.0016, color: '#d8dde2' },
  ];
  const nutTop = violin.userData.nutTop;
  const holeX = [-0.12, -0.04, 0.04, 0.14];
  const strings = SDEF.map((s, i) => {
    const a = new THREE.Vector3(s.nx, ...nk(DIM.nutY + 0.01, nutTop + s.r - 0.001));
    const b = new THREE.Vector3(s.x, DIM.bridgeY, bridgeBaseZ - 0.001 + bridgeTop(s.x) + s.r - 0.002);
    const f = new THREE.Vector3(holeX[i] * 0.98 + s.x * 0.02, tailTopY - 0.016, fretTop + s.r);
    const h = new THREE.Vector3(holeX[i], tailTopY - 0.13, i === 3 ? tz(0.88) + 0.075 : tz(0.88) + 0.016 + 0.012 * Math.max(0, 1 - Math.abs(holeX[i]) / 0.2));
    const uniforms = { uAmp: { value: 0 }, uFreq: { value: 70 + i * 22 }, uTime: { value: 0 } };
    // Sol, Re y La entorchadas (espiras visibles de cerca); Mi de acero liso
    const wound = i < 3;
    const wn = wound ? T.wind.clone() : null;
    if (wn) { wn.repeat.set(Math.round(a.distanceTo(b) * 520), 1); wn.needsUpdate = true; }
    const mat = new THREE.MeshStandardMaterial({ color: s.color, metalness: 1, roughness: wound ? 0.3 : 0.15, ...(wn ? { normalMap: wn, normalScale: new THREE.Vector2(0.9, 0.9) } : {}) });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = 'uniform float uAmp; uniform float uFreq; uniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float env = sin(3.14159 * uv.x);
         transformed.x += uAmp * env * sin(uTime * uFreq);
         transformed.z += uAmp * 0.4 * env * cos(uTime * uFreq * 1.01);`,
      );
    };
    const tube = (p, q, r, m, seg = 4) => add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(p, q), seg, r, 12, false), m), true, false);
    const mesh = tube(a, b, s.r, mat, 200);
    const silkStart = f.clone().lerp(b, 0.16);
    tube(b, silkStart, s.r, mat);
    tube(silkStart, f, s.r * 1.18, M.silk);
    tube(f, h, s.r * 1.18, M.silk);
    // de la cejuela a su clavija (entra en el hueco del clavijero)
    const [py, pz] = pegYZ[[0, 2, 1, 3][i]];
    tube(a, new THREE.Vector3([-0.04, -0.02, 0.03, 0.04][[0, 2, 1, 3][i]], ...nk(py, pz + 0.026)), s.r, mat);
    return { ...s, mesh, uniforms, a, b, energy: 0 };
  });
  violin.userData.stringZ = { nut: nk(DIM.nutY, nutTop)[1], nutY: nk(DIM.nutY, nutTop)[0], bridge: bridgeBaseZ - 0.001 + bridgeTop(0.055) };


  // ── Arco
  const bow = new THREE.Group();
  {
    const BL = 7.3;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      pts.push(new THREE.Vector3(t * BL, 0.16 - 0.08 * Math.sin(Math.PI * t * 0.95) + Math.pow(t, 6) * 0.1, 0));
    }
    const stick = variableTube(new THREE.CatmullRomCurve3(pts), 220, 10, (t) => { const r = 0.042 - 0.016 * t; return [r, r]; });
    bow.add(new THREE.Mesh(stick, M.stick));
    const frog = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.09), M.ebony);
    frog.position.set(0.55, 0.06, 0);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.025, 20), M.pearl);
    eye.position.set(0.55, 0.06, 0.046);
    const eye2 = eye.clone(); eye2.position.z = -0.046; eye2.rotation.y = Math.PI;
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.092), M.pearl);
    slide.position.set(0.55, -0.025, 0);
    const ferrule = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.095), M.silver);
    ferrule.position.set(0.84, 0.04, 0);
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 16), M.ebony);
    button.rotation.z = Math.PI / 2; button.position.set(-0.1, 0.16, 0);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.04, 16), M.silver);
    ring.rotation.z = Math.PI / 2; ring.position.set(-0.03, 0.16, 0);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.5, 16), M.silver);
    wrap.rotation.z = Math.PI / 2; wrap.position.set(1.15, 0.155, 0);
    bow.add(frog, eye, eye2, slide, ferrule, button, ring, wrap);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.07), M.stick);
    head.position.set(BL - 0.02, 0.13, 0); head.rotation.z = -0.25;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.27, 0.072), M.pearl);
    tip.position.set(BL + 0.012, 0.12, 0); tip.rotation.z = -0.25;
    bow.add(head, tip);
    const hairG = new THREE.BoxGeometry(BL - 0.85, 0.006, 0.09, 60, 1, 1);
    hairG.translate((BL - 0.85) / 2 + 0.83, 0, 0);
    bow.add(new THREE.Mesh(hairG, M.hair));
    bow.userData.length = BL;
  }

  const innerLight = new THREE.PointLight('#ffb46a', 0, 3, 1.5);
  innerLight.position.set(0.0, -0.1, 0.0);
  violin.add(innerLight);

  const fMid = (f) => {
    const s = f.segs[Math.floor(f.segs.length * 0.45)];
    const x = (s[1] + s[2]) / 2, y = s[0];
    return new THREE.Vector3(x, y, plateZ(x, y, 1));
  };
  // el punto más "abierto" de la efe (centro del ojo inferior): por ahí entra y sale la cámara
  const fOpen = (f) => {
    let best = null, bd = -1;
    for (const [y, a, b] of f.segs) for (let k = 1; k < 8; k++) {
      const x = a + ((b - a) * k) / 8;
      let d = 1e9; for (const [lx, ly] of f.loop) d = Math.min(d, (lx - x) ** 2 + (ly - y) ** 2);
      if (d > bd) { bd = d; best = [x, y]; }
    }
    return new THREE.Vector3(best[0], best[1], plateZ(best[0], best[1], 1));
  };

  return {
    violin, bow, strings, beams, interior, innerLight, M, lightSheet,
    labelMat: interior.userData.labelMat, labelBase: interior.userData.labelMat.color.clone(),
    anchors: {
      bridgeTop: new THREE.Vector3(0, DIM.bridgeY, violin.userData.stringZ.bridge),
      fholeBass: fMid(bassF),
      fholeTreble: fMid(trebleF),
      openBass: fOpen(bassF),
      label: interior.userData.label.userData.center.clone(),
      scroll: new THREE.Vector3(0, ...nk(...headYZ(895, 715))),
      stringZAt: (y) => {
        const t = (y - DIM.bridgeY) / (violin.userData.stringZ.nutY - DIM.bridgeY);
        const zb = violin.userData.stringZ.bridge, zn = violin.userData.stringZ.nut;
        return zb + t * (zn - zb) + 0.004;
      },
    },
  };
}