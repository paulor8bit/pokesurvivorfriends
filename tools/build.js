/* dev.html é a fonte; index.html e o bundle são gerados para distribuição. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { minify } = require('terser');
const root = path.resolve(__dirname, '..');

async function build() {
  const source = fs.readFileSync(path.join(root, 'dev.html'), 'utf8');
  const begin = '<!-- scripts:begin -->', end = '<!-- scripts:end -->';
  const a = source.indexOf(begin), b = source.indexOf(end);
  if (a < 0 || b < a) throw new Error('Faltam as marcas dos scripts em dev.html.');
  const files = [...source.slice(a, b).matchAll(/<script[^>]*src="(js\/[^"?]+\.js)"/g)].map(m => m[1]);
  let code = files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n;\n');
  if (!process.argv.includes('--expose')) {
    const global = 'window.G = window.G || {};';
    if (!code.includes(global)) throw new Error('Inicialização do jogo não encontrada.');
    code = '(() => {\n' + code.replace(global, 'var G = {};') + '\n})();';
  }
  const result = await minify(code, { compress: { passes: 1 }, mangle: true, ecma: 2020, format: { comments: false } });
  if (!result.code) throw new Error('Não foi possível gerar o jogo.');
  const hash = crypto.createHash('sha1').update(result.code).digest('hex').slice(0, 10);
  fs.writeFileSync(path.join(root, 'js/app.min.js'), result.code);
  const html = (source.slice(0, a) + `<script defer src="js/app.min.js?v=${hash}"></script>` + source.slice(b + end.length))
    .replace(/<!-- dev.html:[^>]*-->/, '<!-- Gerado de dev.html por tools/build.js. Edite a fonte. -->');
  fs.writeFileSync(path.join(root, 'index.html'), html);
  fs.writeFileSync(path.join(root, 'version.json'), JSON.stringify({ v: hash, at: new Date().toISOString(),
    ...(process.argv.includes('--forzar') ? { force: true } : {}) }) + '\n');
  console.log(`Jogo gerado: ${files.length} módulos, versão ${hash}.`);
}
build().catch(error => { console.error(error.message); process.exitCode = 1; });
