// ─────────────────────────────────────────────────────────────
//  CONTENIDO EDITABLE · datos tomados del CV de Belén (julio 2026).
//  Lo marcado con  ✎  conviene confirmarlo con ella.
// ─────────────────────────────────────────────────────────────

export const site = {
  name: 'Belén Pérez',
  fullName: 'Belén Pérez Mora',
  role: 'Violinista',
  tagline: 'Cuatro cuerdas. Una sola voz.',
  email: 'blnperezmora@gmail.com', // del CV · ✎ confirmar si prefiere otro para contrataciones
  instagram: 'https://instagram.com/', // ✎
  youtube: 'https://youtube.com/', // ✎
  location: 'Madrid · España', // ✎ confirmar ciudad base
};

export const about = {
  lead: 'El arco no toca la cuerda: la convence.',
  body: [
    'Violinista formada en el Conservatorio Superior de Música de Aragón y en el Prins Claus Conservatorium de Groningen (Países Bajos), donde cursó el Máster de Interpretación e Investigación con Katalin Sebestyén.',
    'Desde 2023 es violín I de la Film Symphony Orchestra, ha sido violín solista de los grandes musicales de Beon Entertainment —El Médico, La Historia Interminable, Los Pilares de la Tierra— y colabora con la Noord Nederlands Orkest. Es cofundadora de Nou Quartet y del Adamo String Quartet.',
  ],
  stats: [
    { value: 4, suffix: '', label: 'musicales como violín solista' },
    { value: 3, suffix: '', label: 'discos grabados' },
    { value: 3, suffix: '', label: 'países en escena' },
  ],
};

// Cada línea de experiencia vive en una de las cuatro cuerdas.
export const experience = [
  {
    string: 'Mi',
    note: 'E5',
    facet: 'Solista · musicales',
    items: [
      { years: '2025 — 2026', role: 'Violín solista titular', place: 'Los Pilares de la Tierra, El Musical', city: 'Teatro EDP Gran Vía, Madrid' },
      { years: '2022 — 2025', role: 'Violín solista titular', place: 'El Médico, El Musical', city: 'Teatre Apolo y gira' },
      { years: '2023 — 2024', role: 'Violinista principal', place: 'La Historia Interminable', city: 'Zaragoza · Barcelona' },
    ],
  },
  {
    string: 'La',
    note: 'A4',
    facet: 'Orquesta',
    items: [
      { years: '2023 — Hoy', role: 'Violín I · titular', place: 'Film Symphony Orchestra', city: 'Giras Henko, Tarab, Toon Story' },
      { years: '2022 — 2026', role: 'Violín I · colaboradora', place: 'Noord Nederlands Orkest', city: 'Groningen · Ámsterdam' },
      { years: '2018 — 2021', role: 'Concertino · solista de segundos', place: 'Orquesta Joven de Andalucía', city: 'Teatro de la Maestranza' },
    ],
  },
  {
    string: 'Re',
    note: 'D4',
    facet: 'Cámara',
    items: [
      { years: '2024 — Hoy', role: 'Cofundadora · violín', place: 'Nou Quartet', city: 'Madrid · Barcelona' },
      { years: '2022', role: 'Cofundadora · violín', place: 'Adamo String Quartet', city: 'Aurora Festival, Groningen' },
      { years: '2015 — Hoy', role: 'Violín', place: 'Ensemble barroco Follia di Spagna', city: 'Huelva · Aranda de Duero' },
    ],
  },
  {
    string: 'Sol',
    note: 'G3',
    facet: 'Formación & docencia',
    items: [
      { years: '2020 — 2022', role: 'Máster en Interpretación', place: 'Prins Claus Conservatorium', city: 'Groningen, Países Bajos' },
      { years: '2016 — 2020', role: 'Grado Superior de Violín', place: 'Conservatorio Superior de Aragón', city: 'Zaragoza' },
      { years: '2018 — 2023', role: 'Profesora de violín y cámara', place: 'Manuel de Falla · Santa María de Yermo', city: 'Zaragoza · Madrid' },
    ],
  },
];

// Repertorio interpretado (según el CV). ✎ Añadir `src` con un mp3 en /public/audio/ cuando haya grabaciones
export const recordings = [
  { title: 'Sonata n.º 1 — Adagio', composer: 'J. S. Bach · Festival Barroco de Tata', duration: '', src: '' },
  { title: 'Concierto para violín n.º 4, KV 218', composer: 'W. A. Mozart · Ceuta International Symphony Orchestra', duration: '', src: '' },
  { title: 'Trío con piano op. 8 n.º 1', composer: 'J. Brahms · con Paul Komen y Elena Rota', duration: '', src: '' },
  { title: 'Metamorphosen (versión septeto)', composer: 'R. Strauss · Orquesta Joven de Andalucía', duration: '', src: '' },
];

// Proyecto musical propio de Belén
export const project = {
  name: 'Nou Quartet', // ✎ confirmar que es el proyecto que quiere destacar
  kicker: 'Proyecto propio',
  lead: 'Un cuarteto de cuerda nacido entre Madrid y Barcelona, del que Belén es cofundadora.',
  body: 'En junio de 2024 Nou Quartet abrió el concierto del Philip Glass Ensemble en Las Noches del Botánico, en el Real Jardín Botánico Alfonso XIII de Madrid.',
  tags: ['Cuarteto de cuerda', 'Madrid · Barcelona', 'Directo'],
  link: '#', // ✎ enlace a la web / redes del cuarteto
};

// Contrataciones (bolos)
export const booking = {
  title: 'Música en directo para tu evento',
  lead: 'Belén está disponible para conciertos, ceremonias y eventos. Cuéntale tu idea y diseñará un repertorio a medida.',
  formats: [
    { name: 'Ceremonias', desc: 'Bodas civiles y religiosas, entradas, firmas y salidas.' },
    { name: 'Eventos privados', desc: 'Cócteles, cenas de gala, aniversarios y celebraciones.' },
    { name: 'Conciertos', desc: 'Recitales, ciclos, festivales y salas, solista o en formación.' },
    { name: 'Estudio', desc: 'Grabaciones de violín para discos, bandas sonoras y publicidad.' },
  ],
};

// Galería (las fotos de concierto llevan la marca de la FSO)
export const gallery = [
  { src: '/img/galeria/retrato-violin.jpg', alt: 'Belén Pérez sosteniendo su violín, retrato de estudio', w: 1066, h: 1600 },
  { src: '/img/galeria/fso-escena-ambar.jpg', alt: 'Belén Pérez tocando con la Film Symphony Orchestra', w: 1600, h: 1066 },
  { src: '/img/galeria/retrato-luz.jpg', alt: 'Retrato de Belén Pérez con el violín, luz lateral', w: 1066, h: 1600 },
  { src: '/img/galeria/fso-escena-azul.jpg', alt: 'Belén Pérez en concierto con la orquesta, luz azul', w: 1600, h: 1066 },
  { src: '/img/galeria/ensayo-bn.jpg', alt: 'Belén Pérez leyendo partitura en un ensayo, en blanco y negro', w: 1202, h: 1600 },
  { src: '/img/galeria/retrato-mirada.jpg', alt: 'Retrato frontal de Belén Pérez', w: 1066, h: 1600 },
  { src: '/img/galeria/fso-escena-naranja.jpg', alt: 'Belén Pérez con la Film Symphony Orchestra, focos naranjas', w: 1600, h: 1066 },
  { src: '/img/galeria/perfil-concierto.jpg', alt: 'Belén Pérez de perfil tocando en penumbra', w: 493, h: 493 },
  { src: '/img/galeria/fso-escena-violeta.jpg', alt: 'Belén Pérez tocando en concierto, luz violeta', w: 1600, h: 1066 },
  { src: '/img/galeria/retrato-sentada.jpg', alt: 'Belén Pérez sentada con su violín', w: 1066, h: 1600 },
  { src: '/img/galeria/backstage.jpg', alt: 'Belén Pérez riendo entre bastidores con otros músicos', w: 1600, h: 1066 },
  { src: '/img/galeria/retrato-perfil.jpg', alt: 'Belén Pérez mirando a un lado con violín y arco', w: 551, h: 740 },
  { src: '/img/galeria/solista-sala.jpg', alt: 'Belén Pérez tocando de pie en una sala', w: 1600, h: 1066 },
  { src: '/img/galeria/retrato-sonrisa.jpg', alt: 'Belén Pérez con su violín, retrato luminoso', w: 1066, h: 1600 },
  { src: '/img/galeria/rodaje.jpg', alt: 'Monitor de rodaje con Belén Pérez tocando', w: 1440, h: 1440 },
];

// rutas relativas a la base del sitio (local y GitHub Pages)
gallery.forEach((g) => { g.src = import.meta.env.BASE_URL + g.src.replace(/^\//, ''); });
