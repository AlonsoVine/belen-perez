// Galería a pantalla completa: mosaico justificado que ocupa todo el espacio
// y visor de foto a foto (teclado, flechas, gestos táctiles).
import gsap from 'gsap';

export function initGallery({ photos, lenis, openButtons = [], strip }) {
  const root = document.createElement('div');
  root.className = 'lightbox';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Galería de fotos');
  root.innerHTML = `
    <div class="lightbox__bar">
      <p class="mono lightbox__title">Galería · <span>${photos.length} fotos</span></p>
      <button class="lightbox__close mono" type="button" aria-label="Cerrar galería">Cerrar <span aria-hidden="true">✕</span></button>
    </div>
    <div class="lightbox__grid" tabindex="-1"></div>
    <div class="viewer" aria-hidden="true">
      <img class="viewer__img" alt="" />
      <p class="viewer__count mono"></p>
      <button class="viewer__nav viewer__nav--prev" type="button" aria-label="Foto anterior">←</button>
      <button class="viewer__nav viewer__nav--next" type="button" aria-label="Foto siguiente">→</button>
      <button class="viewer__back mono" type="button">Volver al mosaico</button>
    </div>`;
  document.body.appendChild(root);

  const grid = root.querySelector('.lightbox__grid');
  const viewer = root.querySelector('.viewer');
  const vImg = viewer.querySelector('.viewer__img');
  const vCount = viewer.querySelector('.viewer__count');
  grid.innerHTML = photos.map((p, i) => `<button class="tile" type="button" data-i="${i}" aria-label="Ver foto ${i + 1}: ${p.alt}"><img src="${p.src}" alt="${p.alt}" loading="lazy" decoding="async"/></button>`).join('');
  const tiles = [...grid.children];

  // ── mosaico justificado: filas que llenan el ancho exacto; la altura se ajusta
  //    para que el conjunto ocupe la pantalla (si no cabe, se desplaza dentro)
  function layout() {
    const W = grid.clientWidth, gap = 8;
    const H = grid.clientHeight;
    // busca la altura de fila que mejor llena el alto disponible
    let best = null;
    for (let target = 140; target <= 520; target += 10) {
      const rows = []; let row = [], sum = 0;
      photos.forEach((p, i) => {
        row.push(i); sum += p.w / p.h;
        if (sum * target + gap * (row.length - 1) >= W) { rows.push({ idx: row, sum }); row = []; sum = 0; }
      });
      if (row.length) rows.push({ idx: row, sum, last: true });
      let total = 0;
      rows.forEach((r) => { r.h = r.last ? Math.min(target * 1.15, (W - gap * (r.idx.length - 1)) / r.sum) : (W - gap * (r.idx.length - 1)) / r.sum; total += r.h; });
      total += gap * (rows.length - 1);
      const score = Math.abs(total - H) + (total > H ? (total - H) * 0.6 : 0);
      if (!best || score < best.score) best = { rows, score };
    }
    let y = 0;
    best.rows.forEach((r) => {
      let x = 0;
      // la última fila, si queda corta, se reparte también a lo ancho
      const scale = r.last ? (W - gap * (r.idx.length - 1)) / (r.sum * r.h) : 1;
      r.idx.forEach((i) => {
        const w = (photos[i].w / photos[i].h) * r.h * scale;
        Object.assign(tiles[i].style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${r.h}px` });
        x += w + gap;
      });
      y += r.h + gap;
    });
    grid.style.setProperty('--content-h', `${y - gap}px`);
  }

  let isOpen = false, current = -1, lastFocus = null;

  function open(startAt = -1) {
    if (isOpen) { if (startAt >= 0) show(startAt); return; }
    isOpen = true; lastFocus = document.activeElement;
    lenis?.stop();
    root.classList.add('is-open');
    layout();
    gsap.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(tiles, { opacity: 0, scale: 0.92, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.9, stagger: { each: 0.03, from: startAt >= 0 ? startAt : 'start' }, ease: 'expo.out' });
    if (startAt >= 0) show(startAt, tiles[startAt]); else root.querySelector('.lightbox__close').focus();
  }
  function close() {
    if (!isOpen) return;
    hide(true);
    gsap.to(root, { autoAlpha: 0, duration: 0.4, ease: 'power2.in', onComplete: () => { root.classList.remove('is-open'); isOpen = false; lenis?.start(); lastFocus?.focus?.(); } });
  }

  // ── visor: la foto crece desde su posición en el mosaico hasta llenar la pantalla
  function show(i, fromEl) {
    current = (i + photos.length) % photos.length;
    const p = photos[current];
    vImg.src = p.src; vImg.alt = p.alt;
    vCount.textContent = `${String(current + 1).padStart(2, '0')} / ${photos.length}`;
    viewer.classList.add('is-on'); viewer.setAttribute('aria-hidden', 'false');
    const wasHidden = !viewer.dataset.on; viewer.dataset.on = '1';
    const r = fromEl?.getBoundingClientRect();
    gsap.killTweensOf(vImg);
    if (r && wasHidden) {
      // FLIP: arranca con el tamaño y la posición de la miniatura
      const vw = innerWidth * 0.9, vh = innerHeight * 0.84, ar = p.w / p.h;
      const fw = Math.min(vw, vh * ar), fh = fw / ar;
      gsap.fromTo(vImg, { x: r.left + r.width / 2 - innerWidth / 2, y: r.top + r.height / 2 - innerHeight / 2, scale: Math.max(r.width / fw, r.height / fh) }, { x: 0, y: 0, scale: 1, duration: 0.8, ease: 'expo.out' });
    } else gsap.fromTo(vImg, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
    gsap.to(viewer, { autoAlpha: 1, duration: 0.35 });
    viewer.querySelector('.viewer__nav--next').focus({ preventScroll: true });
  }
  function hide(silent) {
    if (!viewer.dataset.on) return;
    delete viewer.dataset.on;
    viewer.setAttribute('aria-hidden', 'true');
    const t = tiles[current];
    gsap.to(viewer, { autoAlpha: 0, duration: silent ? 0.2 : 0.4, onComplete: () => viewer.classList.remove('is-on') });
    if (!silent && t) t.focus({ preventScroll: true });
  }

  grid.addEventListener('click', (e) => { const t = e.target.closest('.tile'); if (t) show(+t.dataset.i, t); });
  root.querySelector('.lightbox__close').addEventListener('click', close);
  viewer.querySelector('.viewer__back').addEventListener('click', () => hide());
  viewer.querySelector('.viewer__nav--prev').addEventListener('click', () => show(current - 1));
  viewer.querySelector('.viewer__nav--next').addEventListener('click', () => show(current + 1));
  viewer.addEventListener('click', (e) => { if (e.target === viewer) hide(); });
  // gestos
  let sx = 0;
  viewer.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  viewer.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1)); }, { passive: true });
  addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); viewer.dataset.on ? hide() : close(); }
    else if (viewer.dataset.on && e.key === 'ArrowRight') show(current + 1);
    else if (viewer.dataset.on && e.key === 'ArrowLeft') show(current - 1);
  });
  addEventListener('resize', () => { if (isOpen) layout(); });

  openButtons.forEach((b) => b.addEventListener('click', () => open()));
  // en la tira: un clic (no un arrastre) abre esa foto directamente
  if (strip) {
    let downX = 0;
    strip.addEventListener('pointerdown', (e) => { downX = e.clientX; });
    strip.addEventListener('click', (e) => {
      const s = e.target.closest('.shot');
      if (s && Math.abs(e.clientX - downX) < 6) open(+s.dataset.i);
    });
  }
  return { open, close };
}
