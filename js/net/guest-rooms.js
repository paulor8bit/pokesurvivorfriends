/* Rooms over the host's temporary tunnel. Saves remain in localStorage. */
(() => {
  const listeners = new Set(), signals = new Set(), pending = new Map();
  let ws = null, opening = null, uid = null, room = null, name = '', nextId = 0;
  let serverBase = location.origin, choice = null;
  const emit = what => listeners.forEach(fn => { try { fn(what); } catch (e) { console.warn(e); } });
  const clearRoom = () => { const had = !!room; room = null; choice = null; if (had) emit('room-closed'); };
  function setServer(base) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Enlace de sala inválido.');
    if (serverBase === url.origin) return;
    if (room) throw new Error('Sal de tu sala antes de entrar en otra.');
    const old = ws; ws = null; uid = null; opening = null; choice = null;
    old?.close();
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Conexión cambiada.')); }
    pending.clear(); serverBase = url.origin;
  }
  function applyRoom(data) {
    room = { ...data, isHost: data.host === uid };
    emit('room');
  }
  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN && uid) return Promise.resolve();
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (!/^https?:$/.test(location.protocol)) { reject(new Error('Abre el enlace completo de invitación en el navegador.')); return; }
      const url = new URL('/rooms', serverBase); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = ws = new WebSocket(url.href);
      const timer = setTimeout(() => { socket.close(); reject(new Error('No se pudo conectar. Comprueba que el anfitrión sigue conectado.')); }, 12000);
      let ready = false;
      socket.onmessage = e => {
        if (ws !== socket) return;
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
        if (!ready) reject(new Error('No se pudo conectar. Comprueba que el anfitrión sigue conectado.'));
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
  const catalog = () => Object.keys(G.DB.save.owned || {}).map(Number).filter(dex => G.DEX_BY[dex]).map(dex => ({ dex, shiny: G.DB.ownsShiny(dex) }));
  const member = () => ({ name, ...(choice || { dex: G.DB.save.partner, source: 'local', shiny: !!G.DB.save.partnerShiny && G.DB.ownsShiny(G.DB.save.partner) }) });
  async function enter(k, data) {
    try {
      const defaults = G.Bots.state();
      const slots = Array.from({ length: data.mode === 'rogue' ? 1 : 3 }, (_, i) => i < defaults.slots && defaults.party[i] ? { kind: 'bot', dex: defaults.party[i] } : { kind: 'friend' });
      const r = await request(k, { ...data, member: member(), ...(k === 'create' ? { catalog: catalog(), slots } : {}) });
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
    room = null; choice = null; emit('room'); setServer(location.origin);
  }
  function stop() { if (ws) ws.close(); room = null; choice = null; emit('room'); }
  async function choosePokemon(value) {
    if (!G.DEX_BY[value.dex]) return { ok: false, error: 'Elige tu Pokémon antes de entrar.' };
    if (value.source === 'local' && !G.DB.owns(value.dex)) return { ok: false, error: 'Ese Pokémon no está en tu colección.' };
    const previous = choice;
    choice = { dex: value.dex, source: value.source, shiny: !!value.shiny };
    if (!room) return { ok: true };
    try {
      const r = await request('member', { member: member(), ...(room.isHost ? { catalog: catalog() } : {}) });
      if (!r.ok) choice = previous;
      return r;
    } catch (e) { choice = previous; return { ok: false, error: e.message }; }
  }
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
    setName, createRoom(options = {}) { setServer(location.origin); choice = options.choice || null; return enter('create', { mode: ['arena', 'rogue'].includes(options.mode) ? options.mode : 'survival' }); },
    joinRoom: code => enter('join', { code }), leaveRoom, stop, setServer, choosePokemon,
    roomCatalog: code => request('catalog', { code }), catalog,
    get serverBase() { return serverBase; }, get choice() { return choice; },
    async setOpen(open) { return request('open', { open }); },
    setSlots: (slots, mode) => request('slots', { slots, ...(mode ? { mode } : {}) }), startRun: seed => request('start', { seed }), finishRun: () => request('finish'),
    refreshMember() { if (room?.open && !room.run) request('member', { member: member(), ...(room.isHost ? { catalog: catalog() } : {}) }).catch(() => {}); },
    sendPeer(to, payload) { if (ws?.readyState === WebSocket.OPEN && ws.bufferedAmount < 2 * 1024 * 1024) ws.send(JSON.stringify({ k: 'peer', to, payload })); },
    onSignal(fn) { signals.add(fn); }, offSignal(fn) { signals.delete(fn); },
    on(fn) { listeners.add(fn); }, off(fn) { listeners.delete(fn); },
    get me() { return name && uid ? { uid, name } : null; }, get uid() { return uid; }, get room() { return room; },
    get started() { return !!uid; }, get friends() { return []; }, get invites() { return []; },
    now: Date.now, start: async () => 'off', refreshPresence() {}, setPlaying() {}, publishProfile() {},
    profileData, getProfile: async () => null
  };
})();
