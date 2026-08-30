// Hämtar Inter och Fraunces från Google Fonts en gång och lägger dem i fonts/,
// så att inga besökares IP-adresser går till Google när sidan laddas.
//
//   node scripts/fetch-fonts.mjs
//
// Kör om det här bara när vikterna nedan ska ändras eller Google släpper en
// ny version av teckensnitten. Bara delmängderna latin och latin-ext hämtas.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
const SUBSETS = ['latin', 'latin-ext'];
const CSS_URL = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap';

// Google serverar woff2 bara till webbläsare som stöder det.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const get = url => fetch(url, { headers: { 'User-Agent': UA } });

const res = await get(CSS_URL);
if (!res.ok) throw new Error(`${res.status} för css2-URL:en`);
const css = await res.text();

// Varje @font-face föregås av en kommentar som namnger delmängden.
const blocks = [...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
  .filter(([, subset]) => SUBSETS.includes(subset));

// Både Inter och Fraunces är variabla, så alla vikter delar samma fil per delmängd.
const urlToFile = new Map();
const rules = [];

for (const [, subset, block] of blocks) {
  const family = /font-family:\s*'([^']+)'/.exec(block)[1];
  const weight = /font-weight:\s*(\d+)/.exec(block)[1];
  const url = /url\((https:\/\/[^)]+)\)/.exec(block)[1];
  const range = /unicode-range:\s*([^;]+);/.exec(block)[1];

  if (!urlToFile.has(url)) urlToFile.set(url, `${family.toLowerCase()}-${subset}.woff2`);

  rules.push(`@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('${urlToFile.get(url)}') format('woff2');
  unicode-range: ${range};
}`);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, 'fonts.css'),
  `/* Genererad av scripts/fetch-fonts.mjs — redigera inte för hand. */\n\n${rules.join('\n\n')}\n`
);

for (const [url, file] of urlToFile) {
  const r = await get(url);
  if (!r.ok) throw new Error(`${r.status} för ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.subarray(0, 4).toString('latin1') !== 'wOF2') throw new Error(`${file} är inte woff2`);
  fs.writeFileSync(path.join(OUT, file), buf);
  console.log(`${file}  ${(buf.length / 1024).toFixed(0)} KB`);
}

console.log(`\n${rules.length} @font-face-regler -> ${urlToFile.size} filer`);
