const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { createGameServer } = require('./game-server');

async function ensureCloudflared({ runtimeDir, binaryPath, signal } = {}) {
  const supplied = binaryPath || process.env.CLOUDFLARED_PATH;
  if (supplied && fs.existsSync(supplied)) return supplied;
  const platform = { win32: 'windows', linux: 'linux' }[process.platform];
  const arch = { x64: 'amd64', arm64: 'arm64', ia32: '386' }[process.arch];
  if (!platform || !arch) throw new Error('Esta plataforma precisa de uma instalação própria do cloudflared.');
  const asset = `cloudflared-${platform}-${arch}${process.platform === 'win32' ? '.exe' : ''}`;
  const dest = path.join(runtimeDir, asset);
  if (fs.existsSync(dest)) return dest;
  await fs.promises.mkdir(runtimeDir, { recursive: true });
  const response = await fetch('https://github.com/cloudflare/cloudflared/releases/latest/download/' + asset,
    { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(180000)]) : AbortSignal.timeout(180000) });
  if (!response.ok || !response.body) throw new Error('Não foi possível preparar o acesso online. Confira sua internet e tente novamente.');
  const temp = dest + '.download';
  try { await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temp), { signal }); await fs.promises.rename(temp, dest); }
  catch (e) { await fs.promises.rm(temp, { force: true }).catch(() => {}); throw e; }
  if (process.platform !== 'win32') await fs.promises.chmod(dest, 0o755);
  return dest;
}

// Shared by the desktop app and the optional browser launcher. Only the game
// files are public; all desktop controls stay in Electron's main process.
function createOnlineSession({ root = path.resolve(__dirname, '..'), runtimeDir = path.join(root, '.runtime'),
  binaryPath, port = 8787, onState = () => {}, spawnTunnel = spawn, prepareTunnel = ensureCloudflared } = {}) {
  let game = null, tunnel = null, timer = null, starting = null, stopping = false, generation = 0;
  const abort = new AbortController();
  let state = { phase: 'starting', localUrl: '', publicUrl: '', message: 'Abrindo o jogo…' };
  function report(phase, message, publicUrl = '') {
    state = { ...state, phase, message, publicUrl };
    try { onState({ ...state }); } catch { /* UI may already be closed */ }
  }
  async function start() {
    if (stopping) return;
    if (starting) return starting;
    if (tunnel && ['connecting', 'online'].includes(state.phase)) return;
    starting = (async () => {
      try {
        if (!game) {
          report('starting', 'Abrindo o jogo…');
          const next = createGameServer({ root });
          try {
            await new Promise((resolve, reject) => {
              next.server.once('error', reject);
              next.server.listen(port, '127.0.0.1', () => { next.server.removeListener('error', reject); resolve(); });
            });
          } catch (e) { await next.close(); throw e; }
          game = next;
          state.localUrl = `http://localhost:${game.server.address().port}`;
        }
        if (stopping) return;
        const attempt = ++generation;
        report('preparing', 'Preparando o acesso online. Você já pode jogar solo.');
        const binary = await prepareTunnel({ runtimeDir, binaryPath, signal: abort.signal });
        if (stopping || generation !== attempt) return;
        report('connecting', 'Gerando seu link de convite…');
        const child = tunnel = spawnTunnel(binary, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url',
          `http://127.0.0.1:${game.server.address().port}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let buffer = '', connected = false;
        const fail = message => {
          if (stopping || generation !== attempt) return;
          clearTimeout(timer); timer = null; tunnel = null;
          game.setPublicUrl(''); report('offline', message); child.kill();
        };
        timer = setTimeout(() => fail('O acesso online demorou para responder. Tente novamente; o modo solo continua disponível.'), 90000);
        const output = data => {
          if (stopping || generation !== attempt || child !== tunnel) return;
          buffer = (buffer + data.toString()).slice(-12000);
          const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
          if (match && !connected) {
            connected = true; clearTimeout(timer); timer = null;
            game.setPublicUrl(match[0]); report('online', 'Online sem conta · crie uma sala para convidar seus amigos', match[0]);
          }
        };
        child.stdout.on('data', output); child.stderr.on('data', output);
        child.once('error', () => fail('Não foi possível abrir o acesso online. Tente novamente.'));
        child.once('exit', () => {
          if (child !== tunnel || stopping || generation !== attempt) return;
          clearTimeout(timer); timer = null; tunnel = null;
          game.setPublicUrl(''); report('offline', 'O acesso online foi interrompido. Tente novamente para gerar outro link.');
        });
      } catch (e) {
        if (!stopping) report(game ? 'offline' : 'error', e.code === 'EADDRINUSE'
          ? 'O jogo já está aberto ou a porta está ocupada. Feche a outra janela e tente novamente.' : e.message);
      } finally { starting = null; }
    })();
    return starting;
  }
  async function stop() {
    if (stopping) return;
    stopping = true; generation++; abort.abort(); clearTimeout(timer);
    const child = tunnel; tunnel = null;
    if (child) {
      await new Promise(resolve => {
        let finished = false;
        const finish = () => { if (!finished) { finished = true; clearTimeout(timeout); resolve(); } };
        const timeout = setTimeout(finish, 2000);
        child.once('exit', finish); child.kill();
      });
    }
    // A close during listen/download must also close the newly created server.
    if (starting) await starting;
    if (game) { await game.close(); game = null; }
    report('stopped', 'Jogo encerrado.');
  }
  return { start, stop, get state() { return { ...state }; } };
}
module.exports = { createOnlineSession, ensureCloudflared };
