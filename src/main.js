import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { Stage } from './scene.js';
import { texturesReady } from './violin.js';
import { Sound } from './audio.js';
import { initGallery } from './gallery.js';
import { site, about, experience, recordings, gallery, project, booking } from './content.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ─────────────────────────────────────────────────────────── contenido
function renderContent() {
  $('#hero-loc').textContent = site.location;
  $('#about-lead').innerHTML = about.lead.replace('convence', '<em>convence</em>');
  $('#about-body').innerHTML = about.body.map((p) => `<p>${p}</p>`).join('');
  $('#stats').innerHTML = about.stats.map((s) => `<li><span class="num"><span data-count="${s.value}">0</span><sup>${s.suffix}</sup></span><span class="lbl mono">${s.label}</span></li>`).join('');

  $('#lanes').innerHTML = experience.map((lane, i) => `
    <div class="lane" data-lane="${i}" data-note="${lane.note}">
      <div class="lane__name"><span class="lane__note">${lane.string}</span><span class="lane__facet mono">${lane.facet}</span></div>
      <div class="lane__items">
        ${lane.items.map((it) => `<div class="item"><span class="item__years mono">${it.years}</span><span class="item__role">${it.role}</span><span class="item__place">${it.place} · ${it.city}</span></div>`).join('')}
      </div>
      <div class="lane__string" data-string="${i}"><svg preserveAspectRatio="none" viewBox="0 0 1000 40"><path d="M0 20 Q500 20 1000 20" style="stroke-width:${1 + (3 - i) * 0.5}px"/></svg></div>
    </div>`).join('');

  $('#project-kicker').textContent = `V — ${project.kicker}`;
  $('#project-name').textContent = project.name;
  $('#project-lead').textContent = project.lead;
  $('#project-body').textContent = project.body;
  $('#project-tags').innerHTML = project.tags.map((t) => `<li>${t}</li>`).join('');
  $('#project-link').href = project.link;

  $('#tracks').innerHTML = recordings.map((r, i) => `
    <li class="track" data-i="${i}" data-cursor="Escuchar">
      <span class="track__play" aria-hidden="true">▶</span>
      <span><span class="track__title">${r.title}</span><br/><span class="track__composer mono">${r.composer}</span></span>
      <span class="track__wave">${Array.from({ length: 28 }, (_, k) => `<i style="height:${20 + Math.abs(Math.sin(k * 1.7 + i)) * 70}%"></i>`).join('')}</span>
      <span class="track__dur mono">${r.duration}</span>
    </li>`).join('');

  const shots = gallery.map((g, i) => {
    const r = g.w / g.h, w = `calc(62vh * ${r.toFixed(3)})`;
    return `<figure class="shot" style="width:${w}" data-i="${i}" data-cursor="Ampliar"><img src="${g.src}" alt="${g.alt}" loading="lazy" decoding="async"/><figcaption class="mono">${String(i + 1).padStart(2, '0')} / ${gallery.length}</figcaption></figure>`;
  });
  // la tira se duplica para que el desfile automático dé la vuelta sin cortes (la copia es decorativa)
  $('#gallery-track').innerHTML = shots.join('') + shots.map((s) => s.replace('<figure class="shot"', '<figure class="shot" aria-hidden="true"').replace(/alt="[^"]*"/, 'alt=""')).join('');

  $('#booking-title').textContent = booking.title;
  $('#booking-lead').textContent = booking.lead;
  $('#formats').innerHTML = booking.formats.map((f, i) => `<li class="format"><span class="format__n mono">0${i + 1}</span><h3 class="format__name">${f.name}</h3><p class="format__desc">${f.desc}</p></li>`).join('');
  $('#event-type').innerHTML = booking.formats.map((f) => `<option>${f.name}</option>`).join('') + '<option>Otro</option>';
  $('#mail').textContent = site.email;
  $('#mail').href = `mailto:${site.email}`;
  $('#ig').href = site.instagram;
  $('#yt').href = site.youtube;
  $('#year').textContent = new Date().getFullYear();
}

// ─────────────────────────────────────────────────────────── arranque
renderContent();
const sound = new Sound();
let stage = null;
try {
  stage = new Stage($('#gl'));
} catch (e) {
  console.warn('WebGL no disponible', e);
  document.body.classList.add('no-webgl');
}

const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, wheelMultiplier: 0.9, smoothWheel: !reduced });
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => {
  lenis.raf(t * 1000);
  if (stage) {
    stage.setScroll(lenis.scroll);
    const st = stage.render();
    onFrame(st);
  }
});
gsap.ticker.lagSmoothing(0);

// ─────────────────────────────────────────────────────────── precarga
function loader() {
  const path = $('.loader__wave path');
  const pct = $('#pct');
  const state = { p: 0, amp: 30 };
  let raf;
  const draw = () => {
    const t = performance.now() / 1000;
    let d = 'M0 40';
    for (let x = 0; x <= 600; x += 4) {
      const env = Math.sin((x / 600) * Math.PI);
      // dos frecuencias que se van afinando entre sí (batimiento)
      const beat = Math.sin(x * 0.06 + t * 9) + Math.sin(x * (0.06 + (1 - state.p) * 0.025) + t * 9.6);
      d += ` L${x} ${40 + beat * state.amp * env * 0.5}`;
    }
    path.setAttribute('d', d);
    raf = requestAnimationFrame(draw);
  };
  draw();
  const ready = Promise.all([
    document.fonts.ready,
    texturesReady,
    new Promise((r) => { const i = $('.about__photo img'); if (i.complete) r(); else { i.onload = r; i.onerror = r; } }),
    new Promise((r) => setTimeout(r, 1600)),
  ]);
  gsap.to(state, { p: 0.85, duration: 1.6, ease: 'power2.out', onUpdate: () => (pct.textContent = String(Math.round(state.p * 100)).padStart(3, '0')) });
  ready.then(() => {
    if (stage) stage.renderer.compile(stage.scene, stage.camera);
    gsap.to(state, {
      p: 1, amp: 6, duration: 0.9, ease: 'power3.out',
      onUpdate: () => (pct.textContent = String(Math.round(state.p * 100)).padStart(3, '0')),
      onComplete: () => {
        $('#loader').classList.add('is-ready');
        $('#enter').disabled = false; $('#enter-silent').disabled = false;
      },
    });
  });
  const go = (withSound) => {
    if (withSound) { setSound(true); sound.chord(['G3', 'D4', 'A4', 'E5'], 0.09); }
    gsap.to('#loader', {
      clipPath: 'inset(0 0 100% 0)', duration: 1.3, ease: 'expo.inOut',
      onComplete: () => { $('#loader').remove(); cancelAnimationFrame(raf); },
    });
    document.body.classList.remove('is-loading');
    lenis.start();
    intro();
  };
  $('#enter').addEventListener('click', () => go(true));
  $('#enter-silent').addEventListener('click', () => go(false));
}

function intro() {
  if (stage) gsap.to(stage, { intro: 1, duration: reduced ? 0 : 3.2, ease: 'power2.inOut', delay: 0.2 });
  const tl = gsap.timeline({ delay: 0.55 });
  tl.from('.hero__word .char', { yPercent: 110, rotate: 6, duration: 1.5, ease: 'expo.out', stagger: 0.05 })
    .from('.hero__kicker .line-in', { yPercent: 120, duration: 1, ease: 'expo.out' }, 0.2)
    .from('.hero__tag', { opacity: 0, y: 20, filter: 'blur(8px)', duration: 1.4, ease: 'power3.out' }, 0.6)
    .from('.hero__foot > *', { opacity: 0, y: 12, duration: 1, stagger: 0.1, ease: 'power3.out' }, 0.9)
    .from('.nav > *', { opacity: 0, y: -12, duration: 1, stagger: 0.08, ease: 'power3.out' }, 0.8);
}

// ─────────────────────────────────────────────────────────── sonido
function setSound(on) {
  const v = sound.toggle(on);
  $('#sound').setAttribute('aria-pressed', String(v));
  $('.nav__sound-label').textContent = v ? 'Sonando' : 'Sonido';
}
$('#sound').addEventListener('click', () => setSound(!sound.enabled));

// ─────────────────────────────────────────────────────────── animaciones con scroll
function splitHero() {
  $$('.hero__word').forEach((w) => {
    w.innerHTML = [...w.textContent].map((c) => `<span class="char">${c}</span>`).join('');
  });
}

function reveals() {
  // títulos por líneas
  $$('[data-split]').forEach((el) => {
    if (el.classList.contains('hero__tag')) return;
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
    gsap.from(split.lines, {
      yPercent: 105, duration: 1.3, ease: 'expo.out', stagger: 0.09,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  // hero se desvanece al bajar
  gsap.to('.hero__inner', {
    yPercent: -30, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero__foot', { opacity: 0, scrollTrigger: { trigger: '#hero', start: 'top top', end: '30% top', scrub: true } });

  // II · arco
  const about = gsap.timeline({ scrollTrigger: { trigger: '#about', start: 'top 60%', end: 'top top', scrub: 1 } });
  about.to('.about__photo-mask', { clipPath: 'inset(0% 0 0 0)', ease: 'none' })
    .to('.about__photo img', { scale: 1, ease: 'none' }, 0)
    .from('.about__body p', { opacity: 0, y: 30, stagger: 0.2 }, 0.2)
    .from('.stats li', { opacity: 0, y: 20, stagger: 0.1 }, 0.4);
  gsap.to('.about__photo img', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '#about', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.about__sticky > *', { opacity: 0, y: -40, stagger: 0.05, ease: 'power1.in', scrollTrigger: { trigger: '#about', start: 'bottom 185%', end: 'bottom 125%', scrub: true } });
  $$('[data-count]').forEach((el) => {
    const n = +el.dataset.count;
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(o, { v: n, duration: 2.2, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v)) }),
    });
  });

  // III · resonancia: frases que aparecen una a una
  const lines = $$('.inside__line');
  const it = gsap.timeline({ scrollTrigger: { trigger: '#inside', start: 'top top', end: 'bottom bottom', scrub: true } });
  it.to('.inside__kicker', { opacity: 1, duration: 0.3 }, 0.6);
  it.to('.inside__hud', { opacity: 1, duration: 0.3 }, 0.8);
  lines.forEach((l, k) => {
    const s = 0.9 + k * 1.05;
    it.fromTo(l, { autoAlpha: 0, filter: 'blur(14px)', y: 30 }, { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 0.45, ease: 'power2.out' }, s);
    if (k < lines.length - 1) it.to(l, { autoAlpha: 0, filter: 'blur(6px)', y: -30, duration: 0.32, ease: 'power2.in' }, s + 0.6);
  });
  it.to('.inside__line--sig, .inside__kicker, .inside__hud', { opacity: 0, duration: 0.4 }, 5.4);

  // IV · cuerdas
  const st = gsap.timeline({ scrollTrigger: { trigger: '#strings', start: 'top top', end: 'bottom bottom', scrub: true } });
  st.from('.strings__head', { opacity: 0, y: 40, duration: 0.5 }, 0);
  $$('.lane').forEach((lane, k) => {
    st.from(lane.querySelector('.lane__string'), { scaleX: 0, transformOrigin: 'left center', duration: 0.6, ease: 'power2.out' }, 0.2 + k * 0.35)
      .from(lane.querySelector('.lane__name'), { opacity: 0, x: -20, duration: 0.4 }, 0.3 + k * 0.35)
      .to(lane.querySelectorAll('.item'), { opacity: 1, y: 0, stagger: 0.12, duration: 0.4 }, 0.5 + k * 0.35)
      .add(() => lane.classList.toggle('is-on', st.scrollTrigger.direction > 0), 0.5 + k * 0.35);
  });
  st.to('.strings__sticky > *', { opacity: 0, y: -40, duration: 0.5 }, 3.2);
  st.to({}, { duration: 0.2 });

  // V · proyecto
  gsap.from('.project__card', {
    opacity: 0, y: 80, rotateX: 8, transformPerspective: 900, duration: 1.4, ease: 'expo.out',
    scrollTrigger: { trigger: '#project', start: 'top 40%' },
  });
  gsap.to('.project__card', { opacity: 0, y: -60, ease: 'none', scrollTrigger: { trigger: '#project', start: 'bottom 110%', end: 'bottom 70%', scrub: true } });

  // VI · escucha
  gsap.from('.track', { opacity: 0, y: 40, stagger: 0.1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '#tracks', start: 'top 80%' } });
  const track = $('#gallery-track');
  // la tira desfila sola, despacio; al pasar el ratón (o enfocar con teclado) se detiene con suavidad
  {
    const strip = $('#gallery');
    const SPEED = 28; // px por segundo
    let x = 0, v = reduced ? 0 : SPEED, target = v, visible = false;
    const hold = () => { target = 0; }, go = () => { target = reduced ? 0 : SPEED; };
    strip.addEventListener('pointerenter', hold); strip.addEventListener('pointerleave', go);
    strip.addEventListener('focusin', hold); strip.addEventListener('focusout', go);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(strip);
    gsap.ticker.add((_, dtMs) => {
      if (!visible) return;
      const dt = Math.min(dtMs, 50) / 1000;
      v += (target - v) * (1 - Math.exp(-dt * 3));
      const half = track.children[gallery.length]?.offsetLeft || track.scrollWidth / 2;
      x = (x + v * dt) % half;
      track.style.transform = `translate3d(${-x}px,0,0)`;
    });
  }
  initGallery({ photos: gallery, lenis, openButtons: [$('#gallery-open')], strip: $('#gallery') });
  $$('.shot img').forEach((img) => gsap.to(img, { xPercent: 3, ease: 'none', scrollTrigger: { trigger: '#gallery', start: 'top bottom', end: 'bottom top', scrub: true } }));

  // VII · contacto
  gsap.from('.format', { opacity: 0, y: 40, stagger: 0.1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '#formats', start: 'top 85%' } });
  gsap.from('.form > *', { opacity: 0, y: 30, stagger: 0.08, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '#booking-form', start: 'top 85%' } });
  gsap.from('.contact__mail', { opacity: 0, yPercent: 40, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '#mail', start: 'top 92%' } });
}

// ─────────────────────────────────────────────────────────── navegación
function navigation() {
  const sections = $$('.section');
  const num = $('.nav__num'), title = $('.nav__title');
  const marks = $('.score__marks');
  marks.innerHTML = sections.map(() => '<li></li>').join('');
  const lis = $$('li', marks);
  const placeMarks = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    sections.forEach((s, i) => (lis[i].style.top = `${(Math.min(s.offsetTop, max) / max) * 100}%`));
  };
  placeMarks();
  ScrollTrigger.addEventListener('refresh', placeMarks);
  let current = '';
  sections.forEach((s, i) => {
    ScrollTrigger.create({
      trigger: s, start: 'top 50%', end: 'bottom 50%',
      onToggle: (self) => {
        if (!self.isActive || current === s.id) return;
        current = s.id;
        lis.forEach((l, k) => l.classList.toggle('is-on', k <= i));
        gsap.timeline()
          .to([num, title], { yPercent: -110, duration: 0.35, ease: 'power2.in', stagger: 0.04 })
          .add(() => { num.textContent = s.dataset.movement; title.textContent = s.dataset.title; })
          .fromTo([num, title], { yPercent: 110 }, { yPercent: 0, duration: 0.6, ease: 'expo.out', stagger: 0.04 });
        sound.setDrone(s.id === 'inside' ? 1 : s.id === 'strings' ? 0.25 : 0.55);
        if (s.id === 'inside') sound.chord(['D4', 'A4'], 0.25);
      },
    });
  });
  gsap.to('.score__fill', { scaleY: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });

  const menu = $('#menu'), btn = $('#menu-btn');
  const toggle = (open = !menu.classList.contains('is-open')) => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Cerrar' : 'Índice';
    if (open) { lenis.stop(); gsap.from('.menu__list li a', { yPercent: 100, stagger: 0.05, duration: 0.9, ease: 'expo.out', delay: 0.2 }); } else lenis.start();
  };
  btn.addEventListener('click', () => toggle());
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    e.preventDefault();
    if (menu.classList.contains('is-open')) toggle(false);
    if (id === '#hero') return daCapo();
    lenis.scrollTo(id, { duration: 2.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  }));
  // Da capo: fundido a negro, salto al principio y la cámara vuelve sin recorrer todo el camino (nada de mareos)
  const daCapo = () => {
    const fade = { v: 0 };
    gsap.timeline()
      .to(fade, { v: 1, duration: 0.55, ease: 'power2.in', onUpdate: () => stage && (stage.extraDip = fade.v) })
      .add(() => { lenis.scrollTo(0, { immediate: true, force: true }); if (stage) { stage.cur = null; stage.spin = 0; } sound.pluck && sound.pluck('G3'); })
      .to(fade, { v: 0, duration: 1.3, ease: 'power2.out', delay: 0.15, onUpdate: () => stage && (stage.extraDip = fade.v) });
  };
  const top = $('#totop');
  top.addEventListener('click', daCapo);
  ScrollTrigger.create({
    start: () => innerHeight * 1.2, end: 'max',
    onToggle: (self) => top.classList.toggle('is-on', self.isActive),
    onUpdate: (self) => top.style.setProperty('--p', self.progress.toFixed(3)),
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) toggle(false); });
}

// ─────────────────────────────────────────────────────────── cuerdas tocables
function playableStrings() {
  const lanes = $$('.lane__string');
  const springs = lanes.map(() => ({ y: 0, v: 0, x: 500, active: false }));
  let lastY = null;
  const pluck = (i, x, strength) => {
    const s = springs[i];
    s.x = x; s.v += strength * 22;
    const note = $$('.lane')[i].dataset.note;
    sound.pluck(note, Math.min(1, 0.35 + strength));
    stage?.pluck(3 - i, Math.min(1, 0.4 + strength));
  };
  addEventListener('pointermove', (e) => {
    const y = e.clientY;
    if (lastY !== null) {
      lanes.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.width < 10 || e.clientX < r.left || e.clientX > r.right) return;
        const cy = r.top + r.height / 2;
        if ((lastY - cy) * (y - cy) < 0) {
          const x = ((e.clientX - r.left) / r.width) * 1000;
          pluck(i, x, Math.min(1, Math.abs(y - lastY) / 30));
        }
      });
    }
    lastY = y;
  });
  lanes.forEach((el, i) => el.addEventListener('click', (e) => {
    const r = el.getBoundingClientRect();
    pluck(i, ((e.clientX - r.left) / r.width) * 1000, 0.8);
  }));
  const paths = lanes.map((el) => $('path', el));
  gsap.ticker.add(() => {
    springs.forEach((s, i) => {
      s.v += -s.y * 0.35; s.v *= 0.9; s.y += s.v;
      if (Math.abs(s.y) < 0.01 && Math.abs(s.v) < 0.01) { s.y = 0; s.v = 0; }
      paths[i].setAttribute('d', `M0 20 Q${s.x} ${20 + s.y * 2} 1000 20`);
    });
  });
}

// ─────────────────────────────────────────────────────────── cursor y magnetismo
function cursor() {
  if (!finePointer) return;
  const c = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
  const p = { x: innerWidth / 2, y: innerHeight / 2 }, r = { ...p };
  addEventListener('pointermove', (e) => { p.x = e.clientX; p.y = e.clientY; });
  gsap.ticker.add(() => {
    r.x += (p.x - r.x) * 0.16; r.y += (p.y - r.y) * 0.16;
    dot.style.transform = `translate(${p.x}px,${p.y}px)`;
    ring.style.transform = `translate(${r.x}px,${r.y}px)`;
  });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor], a, button, .lane__string, input, select, textarea');
    c.classList.toggle('is-hover', !!t && !t.dataset.cursor);
    c.classList.toggle('is-label', !!t?.dataset.cursor);
    label.textContent = t?.dataset.cursor || '';
  });
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - b.left - b.width / 2) * 0.3, y: (e.clientY - b.top - b.height / 2) * 0.4, duration: 0.6, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,0.4)' }));
  });
}

// ─────────────────────────────────────────────────────────── escucha y formulario
function listen() {
  let audio = null;
  $$('.track').forEach((tr) => {
    tr.addEventListener('click', () => {
      const r = recordings[+tr.dataset.i];
      if (r.src) {
        if (audio && audio.dataset.src === r.src && !audio.paused) { audio.pause(); return; }
        audio?.pause();
        audio = new Audio(r.src); audio.dataset.src = r.src; audio.play();
      } else {
        if (!sound.enabled) setSound(true);
        sound.chord(['G3', 'D4', 'A4', 'E5'].slice(+tr.dataset.i % 2), 0.12);
        const d = tr.querySelector('.track__dur');
        const old = d.textContent;
        d.textContent = 'Pronto';
        setTimeout(() => (d.textContent = old), 1800);
      }
    });
    tr.addEventListener('pointerenter', () => gsap.to(tr.querySelectorAll('.track__wave i'), { scaleY: () => 0.4 + Math.random() * 1.2, duration: 0.4, stagger: 0.01, yoyo: true, repeat: 1, ease: 'sine.inOut' }));
  });

  $('#booking-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const note = $('#form-note');
    if (!f.get('name') || !/^\S+@\S+\.\S+$/.test(f.get('email') || '')) {
      note.textContent = 'Necesito tu nombre y un email válido.';
      return;
    }
    const subject = `Solicitud · ${f.get('type')}${f.get('date') ? ' · ' + f.get('date') : ''}`;
    const body = `Hola Belén,\n\n${f.get('msg') || ''}\n\nNombre: ${f.get('name')}\nEmail: ${f.get('email')}\nEvento: ${f.get('type')}\nFecha: ${f.get('date') || 'por definir'}`;
    location.href = `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    note.textContent = 'Se abrirá tu correo con la solicitud lista. ¡Gracias!';
    sound.chord(['D4', 'A4', 'E5'], 0.1);
  });
}

// ─────────────────────────────────────────────────────────── por fotograma
function onFrame(st) {
  if (!st) return;
  const inside = st.insideK > 0.5;
  if (inside !== document.body.classList.contains('is-inside')) document.body.classList.toggle('is-inside', inside);
}

// ─────────────────────────────────────────────────────────── init
splitHero();
loader();
reveals();
navigation();
playableStrings();
cursor();
listen();
addEventListener('load', () => { ScrollTrigger.refresh(); stage?.measure(); });
ScrollTrigger.addEventListener('refresh', () => stage?.measure());

// Ganchos para pruebas automatizadas
window.__bp = { stage, lenis, sound };
