// Starts a local game and an account-free, temporary Cloudflare Quick Tunnel.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { createGameServer } = require('../server/game-server');
const ROOT = path.resolve(__dirname, '..');
const RUNTIME = path.join(ROOT, '.runtime');
let tunnel = null, game = null, stopping = false;

function openBrowser(url) {
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  const child = spawn(command, args, { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => console.log('Abra no navegador: ' + url)); child.unref();
}
async function cloudflared() {
  if (process.env.CLOUDFLARED_PATH) return process.env.CLOUDFLARED_PATH;
  const platform = process.platform === 'win32' ? 'windows' : process.platform === 'linux' ? 'linux' : '';
  const arch = { x64: 'amd64', arm64: 'arm64', ia32: '386' }[process.arch];
  if (!platform || !arch) throw new Error('Instale cloudflared e informe CLOUDFLARED_PATH.');
  const asset = `cloudflared-${platform}-${arch}${process.platform === 'win32' ? '.exe' : ''}`;
  const dest = path.join(RUNTIME, asset);
  if (fs.existsSync(dest)) return dest;
  fs.mkdirSync(RUNTIME, { recursive: true });
  console.log('Baixando o túnel oficial da Cloudflare (somente na primeira vez)…');
  const response = await fetch('https://github.com/cloudflare/cloudflared/releases/latest/download/' + asset, { signal: AbortSignal.timeout(180000) });
  if (!response.ok || !response.body) throw new Error('Não foi possível baixar o túnel. Tente novamente.');
  const temp = dest + '.download';
  try { await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temp)); fs.renameSync(temp, dest); }
  catch (e) { fs.rmSync(temp, { force: true }); throw e; }
  if (process.platform !== 'win32') fs.chmodSync(dest, 0o755);
  return dest;
}
async function stop(code = 0) {
  if (stopping) return; stopping = true;
  if (tunnel) tunnel.kill();
  if (game) await game.close();
  for (const file of ['Link Online.txt', 'Abrir Jogo Online.url']) fs.rmSync(path.join(ROOT, file), { force: true });
  process.exit(code);
}
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
async function main() {
  const binary = await cloudflared();
  game = createGameServer();
  const port = Number(process.env.PORT) || 8787;
  await new Promise((resolve, reject) => { game.server.once('error', reject); game.server.listen(port, '127.0.0.1', resolve); });
  const local = `http://localhost:${port}`;
  console.log('Preparando link online gratuito, sem conta…');
  // HTTP/2 also works on networks that block QUIC/UDP.
  tunnel = spawn(binary, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let published = false, buffer = '';
  const timeout = setTimeout(() => { console.error('O túnel demorou para responder. Confira sua internet e tente novamente.'); stop(1); }, 90000);
  const output = data => {
    buffer = (buffer + data.toString()).slice(-12000);
    const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!match || published) return;
    published = true; clearTimeout(timeout); game.setPublicUrl(match[0]);
    fs.writeFileSync(path.join(ROOT, 'Link Online.txt'), `Jogo online: ${match[0]}\r\nNo seu PC: ${local}\r\nCrie uma sala e copie o convite dentro do jogo.\r\nMantenha este programa aberto.\r\n`);
    fs.writeFileSync(path.join(ROOT, 'Abrir Jogo Online.url'), `[InternetShortcut]\r\nURL=${local}\r\n`);
    console.log(`\nJOGO ONLINE: ${match[0]}\nNO SEU PC: ${local}\n\nClique em Jogar com amigos > Criar sala.\nCopie o convite e envie ao seu amigo.\nMantenha este programa aberto. Ctrl+C encerra o acesso.\n`);
    if (!process.argv.includes('--no-open')) openBrowser(local);
  };
  tunnel.stdout.on('data', output); tunnel.stderr.on('data', output);
  tunnel.on('error', e => { clearTimeout(timeout); console.error('Não foi possível iniciar o túnel: ' + e.message); stop(1); });
  tunnel.on('exit', code => {
    clearTimeout(timeout);
    if (!stopping) { console.error('O túnel foi encerrado. ' + (published ? 'Abra o iniciador para gerar outro link.' : buffer.slice(-1800))); stop(code || 1); }
  });
}
main().catch(e => { console.error('\n' + e.message); stop(1); });
