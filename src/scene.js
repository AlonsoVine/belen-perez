import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { buildViolin, plateZ, halfWidth, DIM } from './violin.js';
import { dotTexture } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0), PLATE_UP = new THREE.Vector3(0, 0.35, 1).normalize();

// Recorrido de cámara. Cada parada se ancla a una sección (fracción 0 = arriba, 1 = abajo).
// dip: fundido a negro en el tramo hacia la siguiente parada {c: centro, w: anchura}
const makeStops = (A) => {
  const fb = A.fholeBass, lb = A.label, o = A.openBass;
  const zIn = plateZ(o.x, o.y, 1) - DIM.plate - 0.07; // justo bajo la tapa
  return [
  { at: ['hero', 0], pos: V(2.9, 0.6, 10.4), tgt: V(0.1, 1.3, 0), roll: -0.3, fov: 34, shift: 0.16 },
  { at: ['about', 0.45], pos: V(2.05, -0.55, 2.05), tgt: V(-0.05, -0.05, 0.45), roll: -0.1, fov: 40, shift: -0.2 },
  { at: ['about', 1], pos: V(o.x - 0.35, o.y - 0.35, o.z + 0.9), tgt: o.clone(), roll: 0, fov: 44, shift: 0 },
  // entrada: la cámara baja en vertical y cruza la tapa por el ojo de la efe (sin fundidos)
  { at: ['inside', 0], pos: V(o.x, o.y, o.z + 0.22), tgt: V(o.x, o.y + 0.02, -0.6), roll: 0, fov: 50, shift: 0, through: true },
  { at: ['inside', 0.1], up: PLATE_UP, pos: V(o.x, o.y, zIn), tgt: V(o.x + 0.1, o.y + 0.25, -0.6), roll: 0, fov: 56, shift: 0 },
  { at: ['inside', 0.36], up: PLATE_UP, pos: V(0.08, -1.32, -0.03), tgt: V(-0.12, 0.7, 0.05), roll: 0, fov: 56, shift: 0 },
  { at: ['inside', 0.72], up: PLATE_UP, pos: V(lb.x + 0.3, lb.y + 0.36, 0.06), tgt: V(lb.x, lb.y, lb.z), roll: -0.06, fov: 58, shift: 0 },
  // salida: bajo el ojo de la efe, mirando la luz que entra, y fuera por el mismo hueco
  { at: ['inside', 0.9], pos: V(o.x, o.y, zIn), tgt: V(o.x * 0.3, o.y + 0.55, o.z + 0.3), roll: 0, fov: 56, shift: 0, through: true },
  { at: ['strings', 0], pos: V(o.x - 0.05, o.y - 0.12, o.z + 0.42), tgt: V(0, o.y + 0.9, 0.5), roll: 0, fov: 50, shift: 0 },
  { at: ['strings', 0.2], pos: V(-0.42, -1.15, 1.0), tgt: V(0, 1.6, 0.52), roll: 0, fov: 40, shift: 0 },
  { at: ['strings', 0.95], pos: V(0.3, 0.35, 0.92), tgt: V(0, 2.8, 0.45), roll: 0, fov: 40, shift: 0 },
  { at: ['project', 0.5], pos: V(-4.6, 1.9, 6.4), tgt: V(0.0, 1.05, 0), roll: 0.06, fov: 30, shift: -0.22 },
  { at: ['listen', 0.5], pos: V(-2.6, -1.8, 7.6), tgt: V(0, 0.8, 0), roll: 0.03, fov: 30, shift: 0.24 },
  // final: el violín entero, girando despacio sobre sí mismo
  { at: ['contact', 0.4], pos: V(0, 1.2, 11.6), tgt: V(0, 1.15, 0), roll: 0, fov: 32, shift: 0.34, spin: true },
  { at: ['coda-space', 0.55], pos: V(0, 0.95, 12.2), tgt: V(0, 0.95, 0), roll: 0, fov: 32, shift: 0, spin: true },
  ];
};
let STOPS = [];

// curva suave que nunca se detiene del todo (evita el "tirón" en cada parada)
const ease = (t) => t * 0.3 + 0.7 * (0.5 - 0.5 * Math.cos(Math.PI * t));
const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function catmull(p0, p1, p2, p3, t, out) {
  const t2 = t * t, t3 = t2 * t;
  return out.set(
    0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
}

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uDip: { value: 0 }, uGrain: { value: 0.06 },
    uVignette: { value: 1.0 }, uAberr: { value: 0.0015 }, uRes: { value: new THREE.Vector2(1, 1) }, uWarm: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uDip, uGrain, uVignette, uAberr, uWarm; uniform vec2 uRes;
    varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r = dot(d,d);
      vec2 off = d * uAberr * smoothstep(0.12, 0.35, r) * 3.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // grade: sombras ligeramente frías, luces cálidas
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col, col * vec3(1.06,0.98,0.9), smoothstep(0.2,0.9,l));
      col = mix(col, col * vec3(0.92,0.97,1.08), 1.0 - smoothstep(0.0,0.25,l));
      col *= mix(vec3(1.0), vec3(1.12,0.95,0.78), uWarm);
      float vig = smoothstep(0.85, 0.15, r * uVignette * 1.6);
      col *= mix(0.35, 1.0, vig);
      float g = rand(vUv * uRes + fract(uTime*7.13)) - 0.5;
      col += g * uGrain;
      col *= 1.0 - uDip;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mobile = window.matchMedia('(max-width: 820px)').matches;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.5 : 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a0807');
    this.scene.fog = new THREE.FogExp2('#0a0807', 0.035);

    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.005, 100);
    this.rig = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), roll: 0, fov: 35, shift: 0 };

    this.buildLights();
    const v = (this.v = buildViolin(r));
    STOPS = makeStops(v.anchors);
    this.scene.add(v.violin);
    this.scene.add(v.bow);
    v.bow.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.buildDust();

    this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.25, 0.4, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);

    this.pointer = new THREE.Vector2();
    this.pointerS = new THREE.Vector2();
    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    });

    this.scrollY = 0;
    this.stopsS = [];
    this.clock = new THREE.Timer();
    this.bowPhase = 0;
    this.intro = 0; // 0..1 entrada inicial
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  buildLights() {
    const s = this.scene;
    this.key = new THREE.SpotLight('#ffcf9a', 60, 30, 0.5, 0.7, 1.6);
    this.key.position.set(4, 6, 7);
    this.key.target.position.set(0, 0.5, 0);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.near = 4; this.key.shadow.camera.far = 18;
    this.key.shadow.bias = -0.0002; this.key.shadow.normalBias = 0.012; this.key.shadow.radius = 3;
    s.add(this.key, this.key.target);
    this.rim = new THREE.DirectionalLight('#aebbd6', 1.7);
    this.rim.position.set(-6, 3, -5);
    s.add(this.rim);
    this.rim2 = new THREE.DirectionalLight('#ff8a3d', 1.0);
    this.rim2.position.set(5, -4, -3);
    s.add(this.rim2);
    this.fill = new THREE.HemisphereLight('#f3d9b8', '#120a06', 0.25);
    s.add(this.fill);
    // Luz que atraviesa las efes hacia el interior
    // las sombras de la tapa dejan pasar esta luz sólo por las efes
    this.fLight = new THREE.SpotLight('#ffd49a', 0, 6, 0.42, 0.8, 0.6);
    this.fLight.position.set(-0.15, 0.25, 2.6);
    this.fLight.target.position.set(0.0, -0.2, -0.3);
    this.fLight.castShadow = true;
    this.fLight.shadow.mapSize.set(2048, 2048);
    this.fLight.shadow.camera.near = 1.2; this.fLight.shadow.camera.far = 4;
    this.fLight.shadow.bias = -0.0004; this.fLight.shadow.normalBias = 0.004; this.fLight.shadow.radius = 2;
    s.add(this.fLight, this.fLight.target);
  }

  buildDust() {
    const n = this.mobile ? 300 : 650;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const inside = i < n * 0.3;
      if (inside) {
        pos[i * 3] = (Math.random() - 0.5) * 1.6;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 3.2;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      } else {
        pos[i * 3] = (Math.random() - 0.5) * 14;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 14 + 1;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      }
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uMap: { value: dotTexture() }, uPx: { value: 1 }, uAlpha: { value: 1 } },
      vertexShader: `attribute float aSeed; uniform float uTime, uPx; varying float vA;
        void main(){
          vec3 p = position;
          float t = uTime * (0.05 + aSeed*0.08);
          p.x += sin(t*2.0 + aSeed*30.0) * 0.25;
          p.y += mod(t + aSeed*10.0, 1.0)*0.6 - 0.3;
          p.z += cos(t*1.7 + aSeed*12.0) * 0.2;
          vec4 mv = modelViewMatrix * vec4(p,1.);
          gl_Position = projectionMatrix * mv;
          float size = (0.35 + aSeed*0.8) * uPx;
          gl_PointSize = size * (18.0 / -mv.z);
          vA = (0.25 + 0.75*fract(aSeed*7.0)) * smoothstep(0.02, 0.6, -mv.z);
        }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uAlpha; varying float vA;
        void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(c.rgb * c.a * vA * uAlpha * 0.6, c.a*vA*uAlpha); }`,
    });
    this.dust = new THREE.Points(g, this.dustMat);
    this.scene.add(this.dust);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.final.uniforms.uRes.value.set(w, h);
    this.dustMat.uniforms.uPx.value = this.renderer.getPixelRatio();
    this.camera.aspect = w / h;
    this.measure();
  }

  measure() {
    const vh = innerHeight;
    this.stopsS = STOPS.map((s) => {
      const el = document.getElementById(s.at[0]);
      if (!el) return 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      return top + s.at[1] * Math.max(el.offsetHeight - vh, 0);
    });
  }

  setScroll(y) { this.scrollY = y; }

  // Devuelve {i, t} del tramo actual
  segment(y) {
    const S = this.stopsS;
    if (y <= S[0]) return { i: 0, t: 0 };
    for (let i = 0; i < S.length - 1; i++) {
      if (y < S[i + 1]) return { i, t: (y - S[i]) / (S[i + 1] - S[i] || 1) };
    }
    return { i: S.length - 2, t: 1 };
  }

  evalPath(y) {
    const { i, t } = this.segment(y);
    const n = STOPS.length;
    const e = ease(THREE.MathUtils.clamp(t, 0, 1));
    const g = (k) => STOPS[THREE.MathUtils.clamp(k, 0, n - 1)];
    const a = g(i), b = g(i + 1);
    // Tramos con fundido: interpolación directa (sin tangentes) para no atravesar cosas raras
    const cut = (s) => !!s.dip || !!s.through;
    const p0 = cut(g(i - 1)) ? a : g(i - 1), p3 = cut(b) ? b : g(i + 2);
    const r = this.rig;
    if (a.dip || a.through) {
      r.pos.lerpVectors(a.pos, b.pos, e);
      r.tgt.lerpVectors(a.tgt, b.tgt, e);
    } else {
      catmull(p0.pos, a.pos, b.pos, p3.pos, e, r.pos);
      catmull(p0.tgt, a.tgt, b.tgt, p3.tgt, e, r.tgt);
    }
    r.up.lerpVectors(a.up || UP, b.up || UP, e).normalize();
    r.roll = THREE.MathUtils.lerp(a.roll, b.roll, e);
    r.fov = THREE.MathUtils.lerp(a.fov, b.fov, e);
    r.shift = THREE.MathUtils.lerp(a.shift, b.shift, e);
    let dip = 0;
    if (a.dip) {
      const d = Math.abs(t - a.dip.c) / (a.dip.w / 2);
      dip = 1 - smooth(0.35, 1, d);
    }
    return { i, t, dip };
  }

  isInside(p) {
    const hw = halfWidth(p.y);
    if (Math.abs(p.x) > hw * 0.98) return false;
    return p.z < plateZ(p.x, p.y, 1) - DIM.plate && p.z > plateZ(p.x, p.y, -1) + DIM.plate;
  }

  // Gestos externos
  pluck(index, strength = 1) {
    const s = this.v.strings[index];
    if (s) s.energy = Math.min(1.4, s.energy + strength);
  }

  render() {
    this.clock.update();
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.getElapsed();
    // el scroll se suaviza antes de mover la cámara (la rueda del ratón llega a saltos);
    // dentro del violín, donde cada píxel de scroll mueve mucho la vista, se suaviza más
    const sRate = 6 - 3.6 * (this.insideK ?? 0);
    if (this.smoothY === undefined || Math.abs(this.scrollY - this.smoothY) > innerHeight * 4) this.smoothY = this.scrollY;
    this.smoothY += (this.scrollY - this.smoothY) * (1 - Math.exp(-dt * sRate));
    const { i, t, dip } = this.evalPath(this.smoothY);
    const target = this.rig;
    const cam = this.camera;

    // Amortiguación crítica sobre el recorrido: la cámara nunca da tirones
    if (!this.cur) this.cur = { pos: target.pos.clone(), tgt: target.tgt.clone(), up: target.up.clone(), roll: target.roll, fov: target.fov, shift: target.shift };
    const r = this.cur;
    // durante los fundidos a negro la cámara salta sin arrastrar (no se ve)
    const k = dip > 0.97 ? 1 : 1 - Math.exp(-dt * (4.2 - 1.6 * (this.insideK ?? 0)));
    r.pos.lerp(target.pos, k);
    r.tgt.lerp(target.tgt, k);
    r.up.lerp(target.up, k).normalize();
    r.roll += (target.roll - r.roll) * k;
    r.fov += (target.fov - r.fov) * k;
    r.shift += (target.shift - r.shift) * k;
    if (this.debugCam) { r.pos.copy(this.debugCam.pos); r.tgt.copy(this.debugCam.tgt); r.fov = this.debugCam.fov ?? 40; r.roll = 0; r.shift = 0; }

    // parallax del puntero (muy contenido; nada dentro del violín)
    this.pointerS.lerp(this.pointer, 1 - Math.pow(0.02, dt));
    const inside = this.isInside(r.pos);
    const par = this.reduced || this.debugCam ? 0 : inside ? 0 : i >= 2 && i <= 10 ? 0.02 : 0.18;
    cam.position.copy(r.pos);
    cam.position.x += this.pointerS.x * par;
    cam.position.y += this.pointerS.y * par * 0.6;

    // entrada inicial: la cámara se acerca desde lejos
    const introK = 1 - ease(this.intro);
    cam.position.addScaledVector(r.pos.clone().sub(r.tgt).normalize(), introK * 3.5);

    cam.up.copy(this.debugCam ? UP : r.up);
    cam.lookAt(r.tgt);
    cam.rotateZ(r.roll);
    cam.fov = r.fov;
    const sh = this.mobile ? 0 : r.shift;
    cam.setViewOffset(this.w, this.h, -sh * this.w * 0.5, 0, this.w, this.h);
    cam.updateProjectionMatrix();

    // violín: deriva suave en las vistas exteriores y giro completo en el final
    const vg = this.v.violin;
    const last = STOPS.length - 2;
    const drift = i <= 0 || i >= 11 ? 1 : 0;
    this.driftK = THREE.MathUtils.lerp(this.driftK ?? 1, drift, 1 - Math.pow(0.02, dt));
    const spinK = i === last - 1 ? smooth(0.2, 0.9, t) : i >= last ? 1 : 0;
    this.spinK = THREE.MathUtils.lerp(this.spinK ?? 0, spinK, 1 - Math.exp(-dt * 2));
    this.spin = this.spin ?? 0;
    if (this.spinK > 0.02) this.spin += dt * 0.32 * this.spinK;
    else {
      const home = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2;
      this.spin += (home - this.spin) * (1 - Math.exp(-dt * 1.5));
    }
    vg.rotation.y = Math.sin(time * 0.25) * 0.12 * this.driftK + this.spin;
    if (this.debugCam) { this.driftK = 0; vg.rotation.y = 0; }
    vg.rotation.x = Math.sin(time * 0.18) * 0.05 * this.driftK;
    vg.position.y = Math.sin(time * 0.5) * 0.06 * this.driftK;

    // arco: reposo → tocando → se retira
    this.updateBow(dt, time, i, t);

    // cuerdas
    const playing = this.bowPlaying ?? 0;
    this.v.strings.forEach((s, k) => {
      s.energy *= Math.pow(0.18, dt);
      const bowed = (k === 1 || k === 2) ? playing * 0.0035 : 0;
      s.uniforms.uAmp.value = s.energy * 0.012 + bowed;
      s.uniforms.uTime.value = time;
    });

    // luces interiores
    // dentro/fuera según la profundidad real de la cámara bajo la tapa (sin retardo temporal)
    const cp = this.camera.position, hwC = halfWidth(cp.y);
    let depthK = 0;
    if (Math.abs(cp.x) < hwC * 0.98 && cp.z > plateZ(cp.x, cp.y, -1)) depthK = THREE.MathUtils.smoothstep(plateZ(cp.x, cp.y, 1) - DIM.plate - cp.z, -0.01, 0.07);
    this.insideK = THREE.MathUtils.lerp(this.insideK ?? 0, depthK, 1 - Math.exp(-dt * 14));
    const nearF = (i >= 2 && i <= 9) || inside ? 1 : 0;
    this.nearF = THREE.MathUtils.lerp(this.nearF ?? 0, nearF, 1 - Math.exp(-dt * 3));
    // dentro: oscuridad; la única luz entra por las efes (sombras de la tapa)
    this.v.innerLight.intensity = 0.22 * this.insideK;
    this.fLight.intensity = (1.2 + 5.8 * this.insideK) * this.nearF;
    this.final.uniforms.uAberr.value = (i >= 2 && i <= 10) ? 0 : 0.0004;
    if (this.v.labelMat) this.v.labelMat.color.copy(this.v.labelBase).multiplyScalar(0.35 + 0.65 * this.insideK);
    this.fLight.castShadow = this.insideK > 0.05;
    this.v.beams.forEach((b) => { b.material.uniforms.uIntensity.value = 0.12 + this.insideK * 0.55; b.material.uniforms.uTime.value = time; });
    this.v.lightSheet.material.opacity = 0.08 + 0.1 * this.insideK;
    this.scene.fog.density = inside ? 0.0 : 0.035;
    this.key.intensity = 60 * (1 - this.insideK * 0.25);
    this.fill.intensity = (0.25 + 0.4 * this.nearF) * (1 - this.insideK * 0.92);
    this.rim.intensity = 1.4 * (1 - this.insideK);
    this.rim2.intensity = 1.0 * (1 - this.insideK);
    this.scene.environmentIntensity = 0.55 * (1 - this.insideK * 0.85);

    this.dustMat.uniforms.uTime.value = time;
    this.final.uniforms.uTime.value = time;
    this.final.uniforms.uDip.value = Math.max(dip, this.extraDip ?? 0);
    this.final.uniforms.uWarm.value = this.insideK * 0.2;
    this.bloom.strength = 0.22 + this.insideK * 0.2;

    this.composer.render(dt);
    return { i, t, inside, insideK: this.insideK };
  }

  updateBow(dt, time, i, t) {
    const bow = this.v.bow;
    const L = bow.userData.length;
    const restPos = V(-2.4, -0.4, -1.0);
    const restQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, -0.3, 1.05));
    // tocando: crin sobre Re/La, a medio camino entre puente y diapasón
    const cy = 0.12;
    const cz = this.v.anchors.stringZAt(cy) + 0.004;
    const playQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0.0, 0.0));
    let k = 0; // 0 reposo, 1 tocando
    if (i === 0) k = ease(t);
    else if (i === 1) k = 1;
    else k = 0;
    let away = 0;
    if (i === 1) away = smooth(0.55, 1, t);
    if (i >= 2) away = 1;
    // golpe de arco: velocidad variable, como una frase
    this.bowPhase += dt * (0.55 + 0.25 * Math.sin(time * 0.6));
    const s = 0.5 - 0.5 * Math.cos(this.bowPhase);
    const contact = THREE.MathUtils.lerp(1.4, L - 0.5, s);
    const playPos = V(-contact, cy, cz);
    bow.position.lerpVectors(restPos, playPos, k);
    bow.quaternion.slerpQuaternions(restQ, playQ, k);
    bow.position.z += away * 2.5;
    bow.position.x -= away * 3;
    bow.visible = away < 0.999;
    const speed = Math.abs(Math.sin(this.bowPhase));
    this.bowPlaying = k > 0.9 ? (0.3 + speed) * (1 - away) : 0;
  }
}
