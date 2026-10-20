/* Rooms over the host's temporary tunnel. Saves remain in localStorage. */
(() => {
  const listeners = new Set(), signals = new Set(), pending = new Map();
  let ws = null, opening = null, uid = null, room = null, name = '', nextId = 0;
  const emit = what => listeners.forEach(fn => { try { fn(what); } catch (e) { console.warn(e); } });
  const clearRoom = () => { const had = !!room; room = null; if (had) emit('room-closed'); };
  function applyRoom(data) {
    room = { ...data, isHost: data.host === uid };
    emit('room');
  }
  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN && uid) return Promise.resolve();
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!/^https?:$/.test(location.protocol)) { reject(new Error('Abre el juego con Jogar Online.bat.')); return; }
      const url = new URL('/rooms', location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = ws = new WebSocket(url.href);
      const timer = setTimeout(() => { socket.close(); reject(new Error('No se pudo conectar. Comprueba que el anfitrión sigue conectado.')); }, 12000);
      let ready = false;
      socket.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.k === 'hello') { uid = m.uid; ready = true; clearTimeout(timer); resolve(); }
        else if (m.k === 'room') applyRoom(m.room);
        else if (m.k === 'room-closed') clearRoom();
        else if (m.k === 'peer') signals.forEach(fn => fn(m.from, m.payload));
        else if (m.k === 'result' && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.timer); p.resolve(m); }
      };
      socket.onerror = () => { /* onclose provides a single, actionable error */ };
      socket.onclose = () => {
        clearTimeout(timer);
        if (ws !== socket) return;
        ws = null; uid = null; opening = null;
        if (!ready) reject(new Error('No se pudo conectar. Abre el juego con Jogar Online.bat.'));
        for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Se perdió la conexión con el anfitrión.')); }
        pending.clear(); clearRoom();
      };
    }).catch(e => { opening = null; throw e; });
    return opening;
  }
  async function request(k, data = {}) {
    await connect();
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('La sala no respondió. Inténtalo de nuevo.')); }, 12000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ k, id, ...data }));
    });
  }
  const member = () => ({ name, dex: G.DB.save.partner, shiny: !!G.DB.save.partnerShiny && G.DB.ownsShiny(G.DB.save.partner) });
  async function enter(k, data) {
    try {
      const r = await request(k, { ...data, member: member() });
      if (r.ok) applyRoom(r.room);
      return r;
    } catch (e) { return { ok: false, error: e.message }; }
  }
  function setName(value) {
    name = String(value || '').trim().normalize('NFC');
    if (!/^[\p{L}\p{N}_ -]{2,20}$/u.test(name)) return false;
    try { localStorage.setItem('ps.roomName', name); } catch { /* storage unavailable */ }
    G.DB.setName(name); G.UI.refreshCoins(); return true;
  }
  async function leaveRoom() {
    if (!room) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { await request('leave'); } catch { /* room is removed on disconnect */ }
    }
    room = null; emit('room');
  }
  function stop() { if (ws) ws.close(); room = null; emit('room'); }
  function profileData() {
    const s = G.DB.save, st = s.stats, prof = s.profile || {};
    const medals = G.AchDefs.LIST.filter(a => s.ach && s.ach[a.id])
      .sort((a, b) => (b.tier - a.tier) || (s.ach[b.id] - s.ach[a.id]));
    return {
      name: name || G.DB.user, favs: (prof.favs || []).slice(0, 3).map(f => ({ dex: f.dex, shiny: !!f.shiny })),
      title: prof.title || '', medals: medals.slice(0, 8).map(a => a.id),
      best: { solo: st.bestTime | 0, group: st.bestGroupTime | 0, level: st.bestLevel | 0, bosses: st.bossesTotal | 0,
        legends: Object.keys(s.legends || {}).length, kills: st.totalKills | 0, medals: medals.length }
    };
  }
  G.DB.onLeave(stop);
  G.Social = {
    guestRooms: true, MAX_PLAYERS: 4,
    setName, createRoom: () => enter('create'), joinRoom: code => enter('join', { code }), leaveRoom, stop,
    async setOpen(open) { return request('open', { open }); },
    refreshMember() { if (room) request('member', { member: member() }).catch(() => {}); },
    sendPeer(to, payload) { if (ws?.readyState === WebSocket.OPEN && ws.bufferedAmount < 2 * 1024 * 1024) ws.send(JSON.stringify({ k: 'peer', to, payload })); },
    onSignal(fn) { signals.add(fn); }, offSignal(fn) { signals.delete(fn); },
    on(fn) { listeners.add(fn); }, off(fn) { listeners.delete(fn); },
    get me() { return name && uid ? { uid, name } : null; }, get uid() { return uid; }, get room() { return room; },
    get started() { return !!uid; }, get friends() { return []; }, get invites() { return []; },
    now: Date.now, start: async () => 'off', refreshPresence() {}, setPlaying() {}, publishProfile() {},
    profileData, getProfile: async () => null
  };
})();
