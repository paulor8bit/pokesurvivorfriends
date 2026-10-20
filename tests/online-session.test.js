const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const { PassThrough } = require('node:stream');
const { createOnlineSession } = require('../server/online-session');

function fixture(t, prepare = async () => 'cloudflared') {
  const events = new EventEmitter(), children = [], states = [];
  const session = createOnlineSession({ port: 0, prepareTunnel: prepare,
    spawnTunnel() {
      const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.kill = () => { child.killed = true; setImmediate(() => child.emit('exit', 0)); };
      children.push(child); return child;
    },
    onState(state) { states.push(state); events.emit(state.phase, state); }
  });
  t.after(() => session.stop());
  return { session, children, states, events };
}

test('desktop game is available before its tunnel is ready, and shutdown closes both', async t => {
  const f = fixture(t); await f.session.start();
  assert.equal(f.session.state.phase, 'connecting');
  const local = f.session.state.localUrl;
  assert.equal((await fetch(local)).status, 200);
  f.children[0].stderr.write('https://desktop-test.trycloudflare.com');
  assert.equal(f.session.state.phase, 'online');
  assert.equal((await (await fetch(local + '/api/server')).json()).publicUrl, 'https://desktop-test.trycloudflare.com');
  await f.session.stop(); assert.equal(f.children[0].killed, true);
  await assert.rejects(fetch(local));
});

test('a failed tunnel leaves solo available and retry updates the invitation URL', async t => {
  const f = fixture(t); await f.session.start(); const local = f.session.state.localUrl;
  f.children[0].stderr.write('https://first-test.trycloudflare.com');
  f.children[0].emit('exit', 1);
  assert.equal(f.session.state.phase, 'offline');
  assert.equal((await fetch(local)).status, 200);
  assert.equal((await (await fetch(local + '/api/server')).json()).publicUrl, '');
  await f.session.start(); f.children[1].stdout.write('https://second-test.trycloudflare.com');
  assert.equal(f.session.state.phase, 'online');
  assert.equal(f.session.state.localUrl, local);
  assert.equal((await (await fetch(local + '/api/server')).json()).publicUrl, 'https://second-test.trycloudflare.com');
  f.children[0].stderr.write('https://stale-test.trycloudflare.com');
  assert.equal(f.session.state.publicUrl, 'https://second-test.trycloudflare.com');
});

test('failed preparation is retryable without losing local progress origin', async t => {
  let count = 0;
  const f = fixture(t, async () => { if (++count === 1) throw new Error('Offline'); return 'cloudflared'; });
  await f.session.start(); const local = f.session.state.localUrl;
  assert.equal(f.session.state.phase, 'offline'); assert.equal((await fetch(local)).status, 200);
  await f.session.start(); assert.equal(f.session.state.phase, 'connecting'); assert.equal(f.session.state.localUrl, local);
});

test('closing during preparation cancels the download and closes the local service', async t => {
  let cancelled = false;
  const f = fixture(t, ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { cancelled = true; reject(new Error('Cancelled')); }, { once: true });
  }));
  const prepared = once(f.events, 'preparing');
  const start = f.session.start(); await prepared;
  const local = f.session.state.localUrl;
  await f.session.stop(); await start;
  assert.equal(cancelled, true); assert.equal(f.session.state.phase, 'stopped'); await assert.rejects(fetch(local));
});
