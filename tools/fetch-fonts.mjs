// Descarga las tipografías de Google Fonts (sólo subconjuntos latin y latin-ext) a public/fonts y genera src/fonts.css.
// Se autoalojan: sin conexión a terceros ni cadena CSS->fuente en el camino crítico.   node tools/fetch-fonts.mjs
import fs from 'node:fs';
const CSS = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@300;400;500&family=JetBrains+Mono:wght@400&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const css = await (await fetch(CSS, { headers: { 'User-Agent': UA } })).text();
fs.mkdirSync('public/fonts', { recursive: true });
const seen = new Map(); // url -> archivo (Inter Tight variable repite la misma URL para cada peso)
let out = '/* Generado por tools/fetch-fonts.mjs (Google Fonts, licencia OFL), autoalojado */\n';
for (const m of css.matchAll(/\/\* ([\w-]+) \*\/\s*@font-face \{([^}]*)\}/g)) {
  const [, subset, body] = m;
  if (subset !== 'latin' && subset !== 'latin-ext') continue;
  const get = (k) => body.match(new RegExp(k + ':\s*([^;]+);'))[1].trim();
  const fam = get('font-family').replace(/'/g, ''), style = get('font-style'), weight = get('font-weight');
  const url = body.match(/url\(([^)]+)\)/)[1];
  let file = seen.get(url);
  if (!file) {
    const base = `${fam.toLowerCase().replace(/ /g, '-')}-${style}-${subset}`;
    file = `${base}${[...seen.values()].includes(base + '.woff2') ? '-' + weight : ''}.woff2`;
    fs.writeFileSync('public/fonts/' + file, Buffer.from(await (await fetch(url)).arrayBuffer()));
    seen.set(url, file);
  }
  out += `@font-face { font-family: '${fam}'; font-style: ${style}; font-weight: ${weight}; font-display: swap; src: url('/fonts/${file}') format('woff2'); unicode-range: ${get('unicode-range')}; }\n`;
}
fs.writeFileSync('src/fonts.css', out);
console.log(out); console.log([...seen.values()].map((f) => f + ' ' + fs.statSync('public/fonts/' + f).size).join('\n'));
