// Regenera o bloco gerado de sw.js: lista de áudios + CACHE_NAME derivado do conteúdo dos assets.
// Uso: node scripts/build-sw.js          (escreve)
//      node scripts/build-sw.js --check  (sai com 1 se sw.js estiver desatualizado)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const swPath = path.join(root, 'sw.js');
const BEGIN = '// <generated>';
const END = '// </generated>';

function buildBlock() {
  const audio = fs.readdirSync(path.join(root, 'assets', 'audio'))
    .filter(f => f.endsWith('.mp3')).sort().map(f => 'assets/audio/' + f);
  // index.html/css/js são network-first no SW; só assets estáticos entram no hash (evita reconstruir a cada edição).
  const staticDirs = ['assets/fonts'];
  const staticFiles = fs.readdirSync(path.join(root, 'assets')).filter(f => fs.statSync(path.join(root, 'assets', f)).isFile()).map(f => 'assets/' + f);
  const fonts = staticDirs.flatMap(d => fs.readdirSync(path.join(root, d)).sort().map(f => d + '/' + f));
  const shell = ['manifest.json', ...staticFiles.sort(), ...fonts];
  const h = crypto.createHash('sha1');
  [...shell, ...audio].forEach(f => { h.update(f); h.update(fs.readFileSync(path.join(root, f))); });
  const name = 'naumteria-studio-' + h.digest('hex').slice(0, 10);
  return [
    BEGIN,
    `const CACHE_NAME = '${name}';`,
    'const AUDIO_ASSETS = [',
    ...audio.map(f => `  '${f}',`),
    '];',
    END,
  ].join('\n');
}

const src = fs.readFileSync(swPath, 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
const a = src.indexOf(BEGIN);
const b = src.indexOf(END);
if (a === -1 || b === -1) { console.error('marcadores <generated> ausentes em sw.js'); process.exit(2); }
const next = src.slice(0, a) + buildBlock() + src.slice(b + END.length);
if (process.argv.includes('--check')) {
  if (next !== src) { console.error('sw.js desatualizado: rode "npm run build:sw"'); process.exit(1); }
  process.exit(0);
}
fs.writeFileSync(swPath, next);
console.log('sw.js atualizado');
