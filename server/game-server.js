// Temporary rooms: no accounts, database, or saved player data on the server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { gzip: gzipCallback } = require('node:zlib');
const { promisify } = require('node:util');
const compress = promisify(gzipCallback);
const { WebSocketServer, WebSocket } = require('ws');
const { catalogOf, choiceOf, originAllowed, slotsOf, freeSlot, roomView } = require('./room-catalog');

function createGameServer({ root = path.resolve(__dirname, '..') } = {}) {
  const rooms = new Map(), clients = new Map();
  let publicUrl = '';
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
  const send = (ws, msg) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 4 * 1024 * 1024) { ws.terminate(); return; }
    ws.send(JSON.stringify(msg));
  };
  const view = roomView;
  const broadcast = room => {
    for (const uid of room.members.keys()) send(clients.get(uid).ws, { k: 'room', room: view(room) });
  };
  function leave(client) {
    const room = rooms.get(client.room);
    client.room = null;
    if (!room) return;
    if (room.host === client.uid) {
      rooms.delete(room.id);
      for (const uid of room.members.keys()) {
        const other = clients.get(uid);
        if (other) { other.room = null; send(other.ws, { k: 'room-closed' }); }
      }
    } else { room.members.delete(client.uid); broadcast(room); }
  }
  function member(client, input, room) {
    const name = typeof input?.name === 'string' ? input.name.trim().normalize('NFC') : '';
    if (!/^[\p{L}\p{N}_ -]{2,20}$/u.test(name)) throw new Error('Usa un apodo de 2 a 20 letras o números.');
    const dex = Number(input.dex);
    if (!Number.isInteger(dex) || dex < 1 || dex > 1025) throw new Error('Elige tu Pokémon antes de entrar.');
    return { uid: client.uid, name, dex, ...choiceOf(input, room) };
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end(); return; }
    if (pathname === '/api/server') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json');
      res.end(req.method === 'HEAD' ? '' : JSON.stringify({ online: true, publicUrl })); return;
    }
    if (pathname === '/') pathname = '/index.html';
    // Never expose the checkout, dependencies, launchers, logs or private files.
    const allowed = /^\/(?:assets|css|js)\/[\w/ .@+-]+$/i.test(pathname) ||
      /^\/(?:index\.html|dev\.html|sw\.js|manifest\.webmanifest|favicon\.ico|version\.json|CREDITS\.md|LICENSE|LICENSE-NONCOMMERCIAL\.md)$/.test(pathname);
    const filename = path.resolve(root, '.' + pathname);
    if (!allowed || !filename.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
    try {
      const real = await fs.promises.realpath(filename);
      if (!real.startsWith(root + path.sep)) { res.writeHead(404).end(); return; }
      const stat = await fs.promises.stat(real);
      if (!stat.isFile()) { res.writeHead(404).end(); return; }
      const type = mime[path.extname(real).toLowerCase()] || (pathname === '/LICENSE' ? 'text/plain; charset=utf-8' : 'application/octet-stream');
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache');
      const gzip = /gzip/.test(req.headers['accept-encoding'] || '') && /text|json/.test(type);
      // readFile also works for Electron's virtual ASAR paths. Streaming those
      // paths can close the response before data is read in a packaged app.
      const contents = await fs.promises.readFile(real);
      const body = gzip ? await compress(contents) : contents;
      if (gzip) { res.setHeader('Content-Encoding', 'gzip'); res.setHeader('Vary', 'Accept-Encoding'); }
      res.setHeader('Content-Length', body.length);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404).end(); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    const originOk = originAllowed(req.headers.origin, req.headers.host);
    if (req.url !== '/rooms' || !originOk || clients.size >= 64) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', ws => {
    const client = { uid: randomBytes(12).toString('hex'), ws, room: null, since: Date.now(), count: 0, alive: true };
    clients.set(client.uid, client);
    send(ws, { k: 'hello', uid: client.uid });
    ws.on('pong', () => { client.alive = true; });
    ws.on('error', () => ws.terminate());
    ws.on('close', () => { leave(client); clients.delete(client.uid); });
    ws.on('message', (raw, binary) => {
      let m;
      try {
        if (binary) throw new Error('Mensaje inválido.');
        if (Date.now() - client.since > 1000) { client.since = Date.now(); client.count = 0; }
        if (++client.count > 200) { ws.close(1008, 'Too many messages'); return; }
        m = JSON.parse(raw.toString());
        if (!m || typeof m !== 'object') throw new Error('Mensaje inválido.');
        const room = rooms.get(client.room);
        const reply = data => send(ws, { k: 'result', id: m.id, ...data });
        switch (m.k) {
          case 'create': {
            const info = member(client, m.member);
            if (room) throw new Error('Sal de tu sala antes de crear otra.');
            if (rooms.size >= 32) throw new Error('Hay demasiadas salas. Inténtalo más tarde.');
            let id; do { id = randomBytes(6).toString('hex').toUpperCase(); } while (rooms.has(id));
            info.slot = 0;
            const catalog = catalogOf(m.catalog);
            const next = { id, host: client.uid, open: true, catalog, slots: slotsOf(m.slots, catalog), run: null, members: new Map([[client.uid, info]]) };
            client.room = id; rooms.set(id, next); reply({ ok: true, room: view(next) }); break;
          }
          case 'join': {
            const next = rooms.get(String(m.code || '').replace(/[\s-]/g, '').toUpperCase());
            if (room) throw new Error('Sal de tu sala antes de entrar en otra.');
            if (!next) throw new Error('Esa sala ya no existe. Pide un nuevo enlace.');
            if (!next.open) throw new Error('La partida de esa sala ya ha empezado.');
            if (next.members.size >= 4) throw new Error('La sala está llena (máximo 4).');
            const info = member(client, m.member, next);
            info.slot = freeSlot(next);
            client.room = next.id; next.members.set(client.uid, info);
            reply({ ok: true, room: view(next) }); broadcast(next); break;
          }
          case 'leave': leave(client); reply({ ok: true }); break;
          case 'catalog': {
            const next = rooms.get(String(m.code || '').replace(/[\s-]/g, '').toUpperCase());
            if (!next) throw new Error('Esa sala ya no existe. Pide un nuevo enlace.');
            if (!next.open) throw new Error('La partida de esa sala ya ha empezado.');
            reply({ ok: true, catalog: next.catalog }); break;
          }
          case 'member': {
            if (!room) throw new Error('No estás en una sala.');
            if (!room.open || room.run) throw new Error('La partida de esa sala ya ha empezado.');
            if (room.host === client.uid && Array.isArray(m.catalog)) room.catalog = catalogOf(m.catalog);
            room.members.set(client.uid, { ...member(client, m.member, room), slot: room.members.get(client.uid).slot }); broadcast(room); reply({ ok: true }); break;
          }
          case 'slots': {
            if (!room || room.host !== client.uid) throw new Error('Sólo el anfitrión puede cambiar los huecos.');
            const next = slotsOf(m.slots, room.catalog);
            for (const info of room.members.values()) if (info.slot && next[info.slot - 1].kind === 'bot' && JSON.stringify(next[info.slot - 1]) !== JSON.stringify(room.slots[info.slot - 1])) throw new Error('Ese hueco está ocupado por un jugador.');
            room.slots = next; broadcast(room); reply({ ok: true }); break;
          }
          case 'start': {
            if (!room || room.host !== client.uid) throw new Error('Sólo el anfitrión puede empezar.');
            if (room.run) throw new Error('La partida ya está en marcha.');
            const seed = Number(m.seed);
            if (!Number.isInteger(seed) || seed < 0 || seed > 0x7fffffff) throw new Error('Mensaje inválido.');
            room.run = { id: randomBytes(8).toString('hex'), seed }; room.open = true;
            broadcast(room); reply({ ok: true, room: view(room) }); break;
          }
          case 'finish': {
            if (!room || room.host !== client.uid) throw new Error('Sólo el anfitrión puede terminar.');
            room.run = null; room.open = true; broadcast(room); reply({ ok: true }); break;
          }
          case 'open': {
            if (!room || room.host !== client.uid) throw new Error('Sólo el anfitrión puede empezar.');
            room.open = m.open === true; broadcast(room); reply({ ok: true }); break;
          }
          case 'peer': {
            const target = clients.get(m.to);
            if (!room || !target || target.room !== room.id || target.uid === client.uid ||
                (client.uid !== room.host && target.uid !== room.host)) throw new Error('Conexión inválida.');
            if (!m.payload || typeof m.payload !== 'object') throw new Error('Mensaje inválido.');
            send(target.ws, { k: 'peer', from: client.uid, payload: m.payload }); break;
          }
          default: throw new Error('Mensaje inválido.');
        }
      } catch (e) { send(ws, { k: 'result', id: m?.id, ok: false, error: e.message }); }
    });
  });
  const heartbeat = setInterval(() => {
    for (const c of clients.values()) { if (!c.alive) c.ws.terminate(); else { c.alive = false; c.ws.ping(); } }
  }, 15000);
  heartbeat.unref();
  server.on('close', () => { clearInterval(heartbeat); wss.close(); });
  return { server, setPublicUrl(url) { publicUrl = url ? new URL(url).origin : ''; },
    close() { for (const c of clients.values()) c.ws.terminate(); return new Promise(resolve => server.close(resolve)); } };
}
if (require.main === module) {
  const { server } = createGameServer();
  const port = Number(process.env.PORT) || 8787;
  server.listen(port, '127.0.0.1', () => console.log(`Jogo: http://localhost:${port}`));
}
module.exports = { createGameServer };
