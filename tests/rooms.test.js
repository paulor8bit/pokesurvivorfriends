const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocket } = require('ws');
const { createGameServer } = require('../server/game-server');

async function setup(t) {
  const game = createGameServer(); game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const base = `http://127.0.0.1:${game.server.address().port}`;
  t.after(() => game.close());
  return { game, base, async client() {
    const ws = new WebSocket(base.replace('http', 'ws') + '/rooms');
    const queue = [], waiters = [];
    ws.on('message', raw => {
      const m = JSON.parse(raw.toString());
      const i = waiters.findIndex(w => w.match(m));
      if (i >= 0) { const w = waiters.splice(i, 1)[0]; clearTimeout(w.timer); w.resolve(m); } else queue.push(m);
    });
    function next(match) {
      const i = queue.findIndex(match); if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const item = { match, resolve, timer: setTimeout(() => reject(new Error('Message timeout')), 3000) }; waiters.push(item);
      });
    }
    const hello = await next(m => m.k === 'hello');
    let id = 0;
    return { ws, uid: hello.uid, next, rpc(k, data = {}) { const n = ++id; ws.send(JSON.stringify({ k, id: n, ...data })); return next(m => m.k === 'result' && m.id === n); } };
  } };
}
const mon = name => ({ name, dex: 25, shiny: false });

test('serves game files, keeps checkout and scripts private, no stale tunnel metadata', async t => {
  const s = await setup(t);
  assert.equal((await fetch(s.base + '/')).status, 200);
  const compressed = await fetch(s.base + '/js/boot.js', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(compressed.status, 200); assert.equal(compressed.headers.get('content-encoding'), 'gzip');
  assert.match(await compressed.text(), /localStorage/);
  assert.equal((await fetch(s.base + '/CREDITS.md')).status, 200);
  assert.equal((await fetch(s.base + '/LICENSE')).status, 200);
  const head = await fetch(s.base + '/js/boot.js', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal((await head.text()).length, 0);
  for (const p of ['/package.json', '/.git/config', '/server/game-server.js', '/tools/play-online.js', '/node_modules/ws/package.json', '/js/../../package.json', '/assets/%00.png']) {
    assert.equal((await fetch(s.base + p)).status, 404, p);
  }
  s.game.setPublicUrl('https://example.trycloudflare.com');
  const r = await fetch(s.base + '/api/server');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await r.json(), { online: true, publicUrl: 'https://example.trycloudflare.com' });
});

test('room membership is atomic, limited to four, and only the host can close entry', async t => {
  const s = await setup(t), host = await s.client();
  const created = await host.rpc('create', { member: mon('Anfitrião') });
  assert.equal(created.ok, true); assert.match(created.room.id, /^[A-F0-9]{12}$/);
  const guests = await Promise.all(Array.from({ length: 4 }, () => s.client()));
  const results = await Promise.all(guests.map((c, i) => c.rpc('join', { code: created.room.id, member: mon('Amigo ' + i) })));
  assert.equal(results.filter(r => r.ok).length, 3);
  const guest = guests[results.findIndex(r => r.ok)];
  assert.equal((await guest.rpc('open', { open: false })).ok, false);
  assert.equal((await host.rpc('open', { open: false })).ok, true);
  const late = await s.client();
  assert.match((await late.rpc('join', { code: created.room.id, member: mon('Atrasado') })).error, /empezado/);
});

test('peer identity cannot be spoofed and messages cannot leave their room or bypass host', async t => {
  const s = await setup(t), host = await s.client(), a = await s.client(), b = await s.client(), outsider = await s.client();
  const { room } = await host.rpc('create', { member: mon('Host') });
  for (const c of [a, b]) assert.equal((await c.rpc('join', { code: room.id, member: mon('Guest') })).ok, true);
  assert.equal((await outsider.rpc('peer', { to: host.uid, payload: { d: {} } })).ok, false);
  assert.equal((await a.rpc('peer', { to: b.uid, payload: { d: {} } })).ok, false);
  a.ws.send(JSON.stringify({ k: 'peer', to: host.uid, from: outsider.uid, payload: { f: outsider.uid, d: { k: 'f' } } }));
  const received = await host.next(m => m.k === 'peer');
  assert.equal(received.from, a.uid); assert.equal(received.payload.d.k, 'f');
});

test('leaving frees a slot; host disconnect removes the room and rejects old invites', async t => {
  const s = await setup(t), host = await s.client(), a = await s.client();
  const { room } = await host.rpc('create', { member: mon('Host') });
  await a.rpc('join', { code: room.id.match(/.{4}/g).join('-'), member: mon('Guest') });
  await a.rpc('leave');
  await a.rpc('join', { code: room.id, member: mon('Guest') });
  host.ws.close();
  await a.next(m => m.k === 'room-closed');
  assert.equal((await a.rpc('join', { code: room.id, member: mon('Guest') })).ok, false);
});

test('validates names and Pokémon and rejects cross-origin browser sockets', async t => {
  const s = await setup(t), a = await s.client();
  assert.equal((await a.rpc('create', { member: mon('<script>') })).ok, false);
  assert.equal((await a.rpc('create', { member: { name: 'Guest', dex: -1 } })).ok, false);
  const bad = new WebSocket(s.base.replace('http', 'ws') + '/rooms', { origin: 'https://unrelated.example' });
  const [err] = await once(bad, 'error'); assert.ok(err);
});
