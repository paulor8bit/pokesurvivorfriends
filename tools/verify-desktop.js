const asar = require('@electron/asar');
const crypto = require('node:crypto');
const path = require('node:path');

function verifyDesktop(directory) {
  const archive = path.join(directory, 'resources/app.asar');
  let checked = 0;
  for (const entry of asar.listPackage(archive)) {
    const name = entry.replace(/^[/\\]+/, '');
    const info = asar.statFile(archive, name);
    if (info.files || info.link || info.unpacked) continue;
    const data = asar.extractFile(archive, name);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    if (data.length !== info.size || !info.integrity || hash !== info.integrity.hash) {
      throw new Error(`Arquivo inconsistente no aplicativo: ${name}. Gere novamente o pacote sem editar arquivos durante a montagem.`);
    }
    checked++;
  }
  const manifest = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
  if (manifest.main !== 'electron/main.js') throw new Error('Entrada do aplicativo incorreta.');
  console.log(`Pacote verificado: ${checked} arquivos íntegros.`);
}

module.exports = { verifyDesktop };
if (require.main === module) verifyDesktop(path.resolve(process.argv[2] || 'dist/desktop/win-unpacked'));
