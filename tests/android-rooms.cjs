/* Regression against the actual Java server shipped in the APK, over TCP. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { WebSocket } = require('ws');
const root = path.resolve(__dirname, '..');
const runtime = path.join(root, '.runtime/android-tools');
const classes = path.join(runtime, 'room-tests');
const executable = name => name + (process.platform === 'win32' ? '.exe' : '');
let server;

function jar(group) {
  const dir = path.join(runtime, 'gradle-home/caches/modules-2/files-2.1', group);
  return path.join(dir, fs.readdirSync(dir, { recursive: true }).find(f => f.endsWith('.jar')));
}
before(async () => {
  const javaHome = process.env.JAVA_HOME || path.join(runtime, 'java', fs.readdirSync(path.join(runtime, 'java'))[0]);
  const deps = [jar('org.nanohttpd'), jar('org.json')].join(path.delimiter);
  fs.mkdirSync(classes, { recursive: true });
  const source = 'android/app/src/main/java/';
  const compiled = spawnSync(path.join(javaHome, 'bin', executable('javac')), ['-cp', deps, '-d', classes,
    source + 'fi/iki/elonen/NanoWSD.java', source + 'com/pokesurvivor/android/RoomHub.java',
    source + 'com/pokesurvivor/android/GameServer.java', 'tests/AndroidServerProbe.java'], { cwd: root, encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stderr);
  server = spawn(path.join(javaHome, 'bin', executable('java')), ['-Djava.io.tmpdir=' + runtime, '-cp', [classes, deps].join(path.delimiter),
    'AndroidServerProbe', path.join(root, '.runtime/android-www')], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error('Android server did not start: ' + output)), 10000);
    server.stdout.on('data', data => { output += data; if (output.includes('ANDROID_SERVER_READY')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', data => { output += data; });
    server.once('exit', code => { clearTimeout(timer); reject(Error('Android server exited: ' + code + ' ' + output)); });
  });
});
after(() => { if (server) server.kill(); });

function player(options = {}) {
  const ws = new WebSocket('ws://127.0.0.1:8787/rooms', options);
  const messages = [], waiters = []; let id = 0;
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    const i = waiters.findIndex(w => w.predicate(m));
    if (i < 0) messages.push(m);
    else { const [w] = waiters.splice(i, 1); clearTimeout(w.timer); w.resolve(m); }
  });
  ws.on('error', () => {});
  function next(predicate) {
    const i = messages.findIndex(predicate);
    if (i >= 0) return Promise.resolve(messages.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: setTimeout(() => reject(Error('Room message timeout')), 5000) };
      waiters.push(waiter);
    });
  }
  return { ws, next, async rpc(k, data = {}) {
    const n = ++id; ws.send(JSON.stringify({ k, id: n, ...data })); return next(m => m.k === 'result' && m.id === n);
  } };
}
const member = { name: 'Amigo', dex: 25, shiny: false };

test('Android Arena has only two human slots and cannot reopen a running tournament', async t => {
  const host = player(), friend = player(), extra = player();
  t.after(() => { host.ws.terminate(); friend.ws.terminate(); extra.ws.terminate(); });
  for (const p of [host, friend, extra]) await p.next(m => m.k === 'hello');
  const { room } = await host.rpc('create', { member, mode: 'arena' }); assert.equal(room.mode, 'arena');
  assert.equal((await friend.rpc('join', { code: room.id, member })).ok, true);
  assert.equal((await extra.rpc('join', { code: room.id, member })).ok, false);
  assert.equal((await friend.rpc('start', { seed: 1 })).ok, false);
  assert.equal((await host.rpc('start', { seed: 1 })).ok, true);
  assert.equal((await host.rpc('open', { open: true })).ok, false);
  await friend.rpc('leave'); assert.equal((await extra.rpc('join', { code: room.id, member })).ok, false);
});

test('Android accepts an installed client from localhost and shares only available borrowed choices', async t => {
  const host = player(), app = player({ origin: 'http://localhost:8790' });
  t.after(() => { host.ws.terminate(); app.ws.terminate(); });
  await host.next(m => m.k === 'hello'); await app.next(m => m.k === 'hello');
  const { room } = await host.rpc('create', { member, catalog: [{ dex: 150, shiny: true, coins: 999 }] });
  assert.deepEqual((await app.rpc('catalog', { code: room.id })).catalog, [{ dex: 150, shiny: true }]);
  assert.equal((await app.rpc('join', { code: room.id, member: { ...member, dex: 151, source: 'host' } })).ok, false);
  assert.equal((await app.rpc('join', { code: room.id, member: { ...member, dex: 150, source: 'host' } })).ok, true);
});

test('Android WebSocket upgrade has no HTTP body framing that closes reverse-proxy streams', async t => {
  const peer = player(); t.after(() => peer.ws.terminate());
  const response = await new Promise((resolve, reject) => { peer.ws.once('upgrade', resolve); peer.ws.once('error', reject); });
  assert.equal(response.statusCode, 101);
  assert.equal(response.headers['content-length'], undefined, 'A 101 response must not declare an HTTP body length');
  assert.equal(response.headers['transfer-encoding'], undefined);
  assert.equal((await peer.next(m => m.k === 'hello')).k, 'hello');
  const ordinary = await fetch('http://127.0.0.1:8787/api/server');
  assert.equal(ordinary.status, 200);
  assert.notEqual(ordinary.headers.get('content-length'), null, 'Ordinary HTTP response framing must be preserved');
});

test('Android host survives delayed heartbeat responses while a friend opens the invitation', { timeout: 50000 }, async t => {
  const host = player({ autoPong: false }); t.after(() => host.ws.terminate());
  let pings = 0, secondPing;
  const waiting = new Promise(resolve => { secondPing = resolve; });
  host.ws.on('ping', bytes => {
    pings++;
    if (pings === 2) secondPing();
    const timer = setTimeout(() => { if (host.ws.readyState === WebSocket.OPEN) host.ws.pong(bytes); }, pings === 1 ? 0 : 2000);
    timer.unref();
  });
  await host.next(m => m.k === 'hello');
  const created = await host.rpc('create', { member }); assert.equal(created.ok, true);
  await waiting;
  // Loading the game on a friend's browser must not interrupt the host socket.
  assert.equal((await fetch('http://127.0.0.1:8787/')).status, 200);
  const guest = player(); t.after(() => guest.ws.terminate()); await guest.next(m => m.k === 'hello');
  assert.equal((await guest.rpc('join', { code: created.room.id, member })).ok, true);
  await delay(2500);
  assert.equal(host.ws.readyState, WebSocket.OPEN, 'A short pong delay closed the host and deleted the room');
  assert.equal((await host.rpc('member', { member })).ok, true);
  host.ws.close();
  await guest.next(m => m.k === 'room-closed');
  const late = player(); t.after(() => late.ws.terminate()); await late.next(m => m.k === 'hello');
  assert.equal((await late.rpc('join', { code: created.room.id, member })).ok, false, 'A closed host must still remove the room');
});

test('Android closes an unresponsive peer through heartbeat rather than leaving an idle socket', { timeout: 40000 }, async t => {
  const peer = player({ autoPong: false }); t.after(() => peer.ws.terminate());
  await peer.next(m => m.k === 'hello');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Unresponsive peer stayed connected')), 35000);
    peer.ws.once('close', () => { clearTimeout(timer); resolve(); });
  });
});
