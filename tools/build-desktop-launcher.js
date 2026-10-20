const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { verifyDesktop } = require('./verify-desktop');
const root = path.resolve(__dirname, '..');
const config = require('../package.json');
const artifact = path.join(root, 'dist/desktop', `PokeSurvivor-Online-${config.version}-x64.exe`);
const cache = path.join(root, '.runtime');
const payload = path.join(cache, 'desktop-runtime.zip');
const result = path.join(cache, 'PokeSurvivor-Desktop.exe');
const sourceOption = process.argv.find(arg => arg.startsWith('--payload-dir='));
const sourceDirectory = sourceOption ? path.resolve(sourceOption.slice('--payload-dir='.length)) : path.join(root, config.build.directories.output);
fs.mkdirSync(cache, { recursive: true });
if (!process.argv.includes('--reuse-payload')) {
  const unpacked = path.join(sourceDirectory, 'win-unpacked');
  verifyDesktop(unpacked);
  fs.rmSync(payload, { force: true });
  execFileSync(require('7zip-bin').path7za, ['a', '-tzip', '-mx=1', '-mcu=on', payload, '.'], {
    cwd: unpacked, stdio: 'ignore', windowsHide: true,
  });
}
if (!fs.existsSync(payload)) throw new Error('Gere primeiro os arquivos do aplicativo.');
const hash = crypto.createHash('sha256').update(fs.readFileSync(payload)).digest('hex').toUpperCase();
const compiledSource = path.join(cache, 'DesktopBootstrap.cs');
fs.writeFileSync(compiledSource, '\ufeff' + fs.readFileSync(path.join(root, 'electron/windows/Bootstrap.cs'), 'utf8').replace('__PAYLOAD_SHA256__', hash));
execFileSync(path.join(process.env.WINDIR, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'), [
  '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/reference:System.Windows.Forms.dll',
  '/reference:System.Drawing.dll', '/reference:System.IO.Compression.dll',
  '/win32icon:' + path.join(root, 'electron/assets/icon.ico'),
  '/resource:' + payload + ',PokeSurvivor.Payload', '/out:' + result, compiledSource,
], { stdio: 'inherit', windowsHide: true });
fs.mkdirSync(path.dirname(artifact), { recursive: true });
try { fs.copyFileSync(result, artifact); }
catch (error) {
  if (error.code === 'EBUSY') throw new Error('Feche as janelas de inicialização do jogo e gere novamente o iniciador.');
  throw error;
}
console.log('Aplicativo portátil pronto: ' + artifact);
