import * as THREE from 'three';

// Ruido 1D/2D barato y determinista para las vetas de la madera
function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}
function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}
function fbm(x, oct = 4) {
  let a = 0.5, s = 0;
  for (let i = 0; i < oct; i++) { s += a * noise1(x); x *= 2.03; a *= 0.5; }
  return s;
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Abeto (tapa): veta recta y fina a lo largo del instrumento, barnizado ámbar
export function spruceTexture() {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const wob = fbm(y * 0.004 + x * 0.0005) * 14;
        const gx = (x + wob) * 0.09;
        const ring = Math.pow(Math.abs(Math.sin(gx * Math.PI)), 6);
        const fine = fbm(gx * 3.1 + y * 0.002) * 0.25;
        const v = 1 - ring * 0.55 - fine * 0.4;
        const i = (y * w + x) * 4;
        // ámbar dorado
        img.data[i] = 186 * v + 20;
        img.data[i + 1] = 108 * v + 12;
        img.data[i + 2] = 44 * v + 6;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

// Arce flameado (fondo, aros, voluta): "llamas" transversales y tono rojizo
export function mapleTexture() {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const flame = Math.sin((y + Math.sin(x * 0.012) * 26 + fbm(x * 0.01) * 30) * 0.11);
        const f = 0.5 + 0.5 * flame;
        const grain = fbm(x * 0.05 + y * 0.004) * 0.3;
        const v = 0.62 + f * 0.38 - grain * 0.35;
        const i = (y * w + x) * 4;
        img.data[i] = 150 * v + 18;
        img.data[i + 1] = 62 * v + 8;
        img.data[i + 2] = 26 * v + 4;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

// Madera sin barnizar del interior: abeto envejecido, veta fina y recta, polvo y oxidación
export function rawWoodTexture() {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      const tone = 0.85 + fbm(x * 0.004) * 0.3;
      for (let y = 0; y < h; y++) {
        const gx = (x + fbm(y * 0.004 + x * 0.001) * 6) * 0.42;
        const late = Math.pow(Math.abs(Math.sin(gx * Math.PI * 0.5)), 14); // anillos de verano (finos y oscuros)
        const fine = fbm(gx * 4.0 + y * 0.03) * 0.12;
        const ox = fbm(y * 0.002 + 13.7) * 0.18;
        const v = tone * (1 - late * 0.32 - fine - ox);
        const i = (y * w + x) * 4;
        img.data[i] = 196 * v;
        img.data[i + 1] = 158 * v;
        img.data[i + 2] = 112 * v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

// Ébano: negro profundo con poro finísimo
export function ebonyTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#0b0807';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = `rgba(40,30,24,${0.04 + hash(i) * 0.06})`;
      ctx.lineWidth = 0.4 + hash(i + 3) * 0.8;
      const x = hash(i + 9) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 3, h * 0.3, x - 3, h * 0.6, x + 2, h);
      ctx.stroke();
    }
  });
}
// La etiqueta del luthier, pegada dentro del fondo (se lee por la efe)
export function labelTexture(name) {
  const draw = (ctx, w, h) => {
    ctx.fillStyle = '#ddd0b0';
    ctx.fillRect(0, 0, w, h);
    // manchas de envejecimiento (foxing)
    for (let i = 0; i < 60; i++) {
      const g = ctx.createRadialGradient(hash(i) * w, hash(i + 1) * h, 0, hash(i) * w, hash(i + 1) * h, 20 + hash(i + 2) * 130);
      g.addColorStop(0, `rgba(140,96,48,${0.08 + hash(i + 5) * 0.1})`);
      g.addColorStop(1, 'rgba(140,96,48,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.strokeStyle = '#3a2a1c';
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, w - 52, h - 52);
    ctx.lineWidth = 1;
    ctx.strokeRect(36, 36, w - 72, h - 72);
    ctx.fillStyle = '#2b1d12';
    ctx.textAlign = 'center';
    ctx.font = 'italic 92px "Instrument Serif", Georgia, serif';
    ctx.fillText(name, w / 2, h * 0.5);
    ctx.font = '30px "Instrument Serif", Georgia, serif';
    ctx.fillText('V I O L I N I S T A   ·   F E C I T   A N N O   M M X X V I', w / 2, h * 0.75);
    ctx.font = 'italic 26px "Instrument Serif", Georgia, serif';
    ctx.fillText('— resonancia —', w / 2, h * 0.24);
  };
  const t = canvasTex(1024, 384, draw);
  // redibuja con la tipografía real en cuanto esté cargada (evita la "Z" de la fuente de reserva)
  if (document.fonts) Promise.all([document.fonts.load('italic 92px "Instrument Serif"'), document.fonts.load('30px "Instrument Serif"')]).then(() => {
    const ctx = t.image.getContext('2d'); draw(ctx, t.image.width, t.image.height); t.needsUpdate = true;
  });
  return t;
}

// Canto de las efes: testa de abeto (anillos que cruzan el grosor), oscurecida arriba por el barniz
export function fwallTexture() {
  return canvasTex(256, 64, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = y / h;
      const ring = Math.pow(Math.abs(Math.sin((x + fbm(y * 0.05 + x * 0.01) * 3) * 0.55)), 10);
      const top = 1 - Math.min(1, v / 0.4); // barniz que baja por el corte
      const k = (1 - ring * 0.08) * (1 - top * 0.75);
      const i = (y * w + x) * 4;
      img.data[i] = 88 * k; img.data[i + 1] = 56 * k; img.data[i + 2] = 32 * k; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}

// Sprite suave para partículas de resina/polvo
export function dotTexture() {
  return canvasTex(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,236,200,1)');
    g.addColorStop(0.3, 'rgba(255,200,140,0.5)');
    g.addColorStop(1, 'rgba(255,180,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// Arce de puente: madera pálida con los radios medulares ("motitas") característicos
export function bridgeTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = fbm(x * 0.02 + fbm(y * 0.01) * 2) * 0.12;
      const v = 0.92 - g;
      const i = (y * w + x) * 4;
      img.data[i] = 226 * v; img.data[i + 1] = 196 * v; img.data[i + 2] = 152 * v; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // radios medulares: guiones cortos, algo más oscuros o brillantes, en ladrillo
    for (let k = 0; k < 2600; k++) {
      const x = hash(k * 1.7) * w, y = hash(k * 3.1 + 2) * h;
      const len = 3 + hash(k + 9) * 9, th = 0.8 + hash(k + 4) * 1.4;
      ctx.fillStyle = hash(k + 7) > 0.35 ? `rgba(120,78,40,${0.18 + hash(k) * 0.25})` : `rgba(255,240,215,${0.2 + hash(k) * 0.3})`;
      ctx.fillRect(x, y, len, th);
    }
  });
}

// Entorchado de las cuerdas: espiras finas (mapa de normales). u = a lo largo, v = alrededor
export function windingNormal() {
  return canvasTex(64, 64, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // una espira por repetición, inclinada una vuelta completa en v
      const ph = ((x / w + y / h) % 1) * Math.PI * 2;
      const nx = Math.sin(ph) * 0.85;
      const i = (y * w + x) * 4;
      img.data[i] = 128 + nx * 127; img.data[i + 1] = 128; img.data[i + 2] = 128 + Math.cos(ph) * 40 + 80; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, false);
}
