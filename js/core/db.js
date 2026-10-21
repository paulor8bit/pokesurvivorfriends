/* Persistência local do fork. Mantém as chaves e migrações dos saves existentes. */
G.DB = (() => {
  const K_SES = 'ps.session', K_SAVE = 'ps.save.', K_LOCAL = '_local';
  const VERSION = 3, START_COINS = 500;
  let user = null, key = null, save = null, storageOk = true, readyP = null;
  const leaveHooks = [];
  function read(k) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
    catch { storageOk = false; return null; }
  }
  function write(k, value) {
    try { localStorage.setItem(k, JSON.stringify(value)); return true; }
    catch { storageOk = false; return false; }
  }
  function newSave(name) {
    return {
      v: VERSION,
      name,
      created: Date.now(),
      updated: Date.now(),    // última modificación (para fusionar)
      coins: START_COINS,
      owned: {},              // dex -> { at, from: 'starter'|'gacha'|'wild' }
      shiny: {},              // dex -> { at, from } — variantes shiny conseguidas
      partner: null,          // dex del Pokémon con el que juegas
      partnerShiny: false,    // jugar con su versión shiny (si la tienes)
      starter: null,          // dex que te tocó en el test
      personality: null,      // { trait, scores }
      upgrades: {},           // (antiguo) mejoras de la cuenta; ahora van por Pokémon
      pupg: {},               // dex -> { id -> nivel }: mejoras de cada Pokémon
      dfav: {},               // dex -> fecha: favorito de la colección (negativa = quitado entonces)
      pused: {},              // dex -> partidas jugadas con él (orden "más usados")
      pstart: {},             // dex -> movimiento inicial elegido (Mejoras → Movimiento inicial)
      tickets: { t1: 0, t10: 0 },   // tickets del gacha (x1 y x10)
      pity: {},               // generación del banner -> tiradas sin ★5
      legends: {},            // dex -> fecha: legendarios vencidos en grietas
      arenas: {},             // tipo -> fecha: arenas de grieta ganadas
      arenaTraining: {},      // Pokémon -> poderes comprados e quatro ataques da Arena
      itemsFound: {},         // id -> fecha: objetos equipables encontrados
      evoMoves: {},           // id -> fecha: movimientos evolucionados alguna vez
      ach: {},                // id -> fecha: logros conseguidos
      missions: {},           // misiones del día / semana (systems/progress.js)
      profile: { favs: [], title: '' },   // perfil público: 3 favoritos y título
      bots: { slots: 0, party: [], training: {} }, // afinidade, ataques aprendidos e formação
      stats: { runs: 0, bestTime: 0, bestLevel: 0, totalKills: 0, pulls: 0, coinsEarned: 0, shinies: 0,
               bossesTotal: 0, riftWins: 0, evolutions: 0, missionsDone: 0, groupRuns: 0, bestGroupTime: 0 }
    };
  }

  /** Rellena campos que falten en partidas de versiones anteriores. */
  function migrate(s, name) {
    const base = newSave(name || s.name);
    for (const k in base) if (s[k] == null) s[k] = base[k];
    for (const k in base.stats) if (s.stats[k] == null) s.stats[k] = base.stats[k];
    // v1 -> v2: había un único banner (Kanto) con el pity como número.
    if (typeof s.pity === 'number') s.pity = { 1: s.pity };
    // v2 -> v3: las mejoras eran de la cuenta; pasan al compañero de entonces.
    if (!s.pupgDone) {
      if (s.partner && Object.values(s.upgrades || {}).some(v => v > 0)) {
        s.pupg[s.partner] = Object.assign({}, s.upgrades);
      }
      s.pupgDone = true;
    }
    s.tickets = Object.assign({ t1: 0, t10: 0 }, s.tickets);
    sanitize(s);
    s.v = VERSION;
    return s;
  }

  /**
   * Quita lo imposible de una partida editada a mano (la copia del navegador
   * se puede tocar): números negativos o raros, mejoras por encima del
   * máximo y Pokémon que no existen. Preserva os campos e limites das partidas existentes.
   */
  function sanitize(s) {
    const n = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    s.coins = n(s.coins);
    s.tickets.t1 = n(s.tickets.t1);
    s.tickets.t10 = n(s.tickets.t10);
    if (isObj(s.led)) {
      for (const dev of Object.keys(s.led)) {
        const e = s.led[dev];
        if (!isObj(e)) { delete s.led[dev]; continue; }
        for (const k of Object.keys(e)) {
          if (!CUR[k] || !Array.isArray(e[k])) { delete e[k]; continue; }
          e[k] = [n(e[k][0]), n(e[k][1])];
        }
      }
    } else delete s.led;
    if (G.DEX_BY) for (const coll of ['owned', 'shiny', 'dfav', 'pused']) {
      for (const d of Object.keys(s[coll] || {})) if (!G.DEX_BY[d]) delete s[coll][d];
    }
    for (const coll of ['dfav', 'pused']) {
      if (!isObj(s[coll])) { s[coll] = {}; continue; }
      for (const d of Object.keys(s[coll])) if (!Number.isFinite(+s[coll][d])) delete s[coll][d];
    }
    if (!isObj(s.pstart)) s.pstart = {};
    for (const d of Object.keys(s.pstart)) {
      if (typeof s.pstart[d] !== 'string' || (G.DEX_BY && !G.DEX_BY[d]) || (G.Moves && !G.Moves.BY_ID[s.pstart[d]])) delete s.pstart[d];
    }
    // Preserva equipes antigas e valida o treino permanente de cada parceiro.
    if (!isObj(s.bots)) s.bots = { slots: 0, party: [] };
    s.bots.slots = Math.min(3, n(s.bots.slots));
    const botParty = Array.isArray(s.bots.party) ? s.bots.party : [], usedBots = new Set();
    s.bots.party = Array.from({ length: 3 }, (_, i) => {
      const dex = +botParty[i];
      if (i >= s.bots.slots || !s.owned[dex] || (G.DEX_BY && !G.DEX_BY[dex]) || usedBots.has(dex)) return null;
      usedBots.add(dex); return dex;
    });
    if (!isObj(s.bots.training)) s.bots.training = {};
    for (const dex of Object.keys(s.bots.training)) {
      const p = s.bots.training[dex];
      if (!s.owned[dex] || (G.DEX_BY && !G.DEX_BY[dex]) || !isObj(p)) { delete s.bots.training[dex]; continue; }
      p.xp = Math.min(1e12, n(p.xp));
      const valid = id => typeof id === 'string' && (!G.Moves || (G.Moves.BY_ID[id] && G.Moves.BY_ID[id].kind !== 'buff'));
      p.learned = [...new Set((Array.isArray(p.learned) ? p.learned : []).filter(valid))];
      const seen = new Set();
      p.loadout = (Array.isArray(p.loadout) ? p.loadout : []).slice(0, 4).map(id => {
        if (!valid(id) || seen.has(id)) return null;
        seen.add(id); return id;
      });
    }
    if (!isObj(s.arenaTraining)) s.arenaTraining = {};
    for (const dex of Object.keys(s.arenaTraining)) {
      const p = s.arenaTraining[dex];
      if (!isObj(p) || (G.DEX_BY && !G.DEX_BY[dex])) { delete s.arenaTraining[dex]; continue; }
      const valid = id => typeof id === 'string' && (!G.Moves || (G.Moves.BY_ID[id] && G.Moves.BY_ID[id].kind !== 'buff'));
      p.learned = [...new Set((Array.isArray(p.learned) ? p.learned : []).filter(valid))];
      p.loadout = (Array.isArray(p.loadout) ? p.loadout : []).slice(0, 4).map(id => valid(id) && p.learned.includes(id) ? id : null);
    }
    // Atajos: 4 huecos con un movimiento que exista (o null), sin repetir.
    if (s.pbind && typeof s.pbind === 'object') {
      for (const d of Object.keys(s.pbind)) {
        const l = Array.isArray(s.pbind[d]) ? s.pbind[d].slice(0, 4) : [];
        const seen = new Set();
        s.pbind[d] = [0, 1, 2, 3].map(i => {
          const id = l[i];
          if (typeof id !== 'string' || (G.Moves && !G.Moves.BY_ID[id]) || seen.has(id)) return null;
          seen.add(id); return id;
        });
      }
    } else s.pbind = {};
    // Veto: listas de movimientos que existen, sin repetir, como mucho 3.
    if (s.pban && typeof s.pban === 'object') {
      for (const d of Object.keys(s.pban)) {
        const l = Array.isArray(s.pban[d]) ? s.pban[d] : [];
        s.pban[d] = [...new Set(l.filter(id => typeof id === 'string' && (!G.Moves || G.Moves.BY_ID[id])))].slice(0, 3);
      }
    } else s.pban = {};
    if (G.Upgrades) for (const d of Object.keys(s.pupg || {})) {
      const u = s.pupg[d];
      if (!u || typeof u !== 'object') { delete s.pupg[d]; continue; }
      for (const id of Object.keys(u)) {
        if (!G.Upgrades.BY[id]) delete u[id];
        else u[id] = Math.min(G.Upgrades.BY[id].max, n(u[id]));
      }
    }
  }

  /**
   * Fusiona dos versiones de la misma partida (p. ej. una jugada sin
   * conexión y la de la nube). Nunca se pierde nada conseguido:
   *   - colecciones (owned, shiny): unión
   *   - mejoras y estadísticas: el máximo de cada una
   *   - monedas, compañero, pity...: los de la versión más reciente
   * Es idempotente: fusionar dos veces da lo mismo.
   */
  /*
   * LIBRETA de monedas y tickets (14-10-2026). Antes las monedas y los tickets
   * eran "los de la versión más reciente": si un aparato con datos viejos (el
   * móvil con la pestaña abierta de ayer) guardaba algo, su número ganaba y se
   * perdía lo conseguido en el otro (un jugador pasó de 36 tickets a 3).
   * Ahora cada aparato apunta en save.led[aparato] lo que ha ganado y gastado
   * de cada cosa ([ganado, gastado], sólo crecen) y el saldo es la suma de
   * todos: al fusionar se toma el mayor de cada apunte y no se pierde nada.
   *   led.base: el saldo que había antes de la libreta (o al empezar).
   *   led.old:  cambios de una versión anterior del juego (pestañas sin actualizar).
   */
  const CUR = {
    c: [s => s.coins, (s, v) => { s.coins = v; }],
    t1: [s => s.tickets.t1, (s, v) => { s.tickets.t1 = v; }],
    t10: [s => s.tickets.t10, (s, v) => { s.tickets.t10 = v; }]
  };
  // Este aparato (navegador): un nombre al azar que se queda guardado.
  const DEV = (() => {
    let d = read('ps.dev');
    if (typeof d !== 'string' || !/^[a-z0-9]{6,12}$/.test(d)) { d = 'd' + Math.random().toString(36).slice(2, 10); write('ps.dev', d); }
    return d;
  })();
  const num = v => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
  const balOf = s => { const o = {}; for (const k in CUR) o[k] = num(CUR[k][0](s)); return o; };
  function ledSum(led, k) {
    let t = 0;
    for (const dev in led) { const e = led[dev] && led[dev][k]; if (e) t += num(e[0]) - num(e[1]); }
    return t;
  }
  function addTo(led, dev, k, d) {
    if (!d) return;
    const e = led[dev] = led[dev] || {};
    const p = e[k] = e[k] || [0, 0];
    if (d > 0) p[0] = num(p[0]) + d; else p[1] = num(p[1]) - d;
  }
  /** La libreta de una partida (sin tocarla); lo que no cuadre, a `dev`. */
  function ledOf(s, dev) {
    if (!isObj(s.led)) {
      const b = balOf(s), base = {};
      for (const k in CUR) base[k] = [b[k], 0];
      return { base };
    }
    const led = JSON.parse(JSON.stringify(s.led)), b = balOf(s);
    // Un saldo en negativo (lo mismo gastado en dos aparatos sin conexión) se ve como 0.
    for (const k in CUR) addTo(led, dev, k, b[k] - Math.max(0, ledSum(led, k)));
    return led;
  }
  /** Apunta en la libreta de ESTE aparato lo que ha cambiado desde la última vez. */
  function fold(s) {
    if (!s) return s;
    s.led = ledOf(s, DEV);
    return s;
  }

  function merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    const newer = (a.updated || 0) >= (b.updated || 0) ? a : b;
    const older = newer === a ? b : a;
    const r = JSON.parse(JSON.stringify(newer));
    // Monedas y tickets: el mayor de cada apunte de cada aparato, y el saldo es la suma.
    const la = ledOf(a, 'old'), lb = ledOf(b, 'old'), led = {};
    for (const src of [la, lb]) for (const dev in src) for (const k in src[dev]) {
      const p = ((led[dev] = led[dev] || {})[k] = led[dev][k] || [0, 0]), q = src[dev][k];
      p[0] = Math.max(p[0], num(q[0])); p[1] = Math.max(p[1], num(q[1]));
    }
    r.led = led;
    r.tickets = r.tickets || { t1: 0, t10: 0 };
    for (const k in CUR) CUR[k][1](r, Math.max(0, ledSum(led, k)));
    for (const coll of ['owned', 'shiny']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) {
        if (!r[coll][k] || (older[coll][k].at || 0) < (r[coll][k].at || 0)) r[coll][k] = older[coll][k];
      }
    }
    for (const k in older.upgrades || {}) r.upgrades[k] = Math.max(r.upgrades[k] || 0, older.upgrades[k]);
    r.pupg = r.pupg || {};
    for (const d in older.pupg || {}) {
      const mine = r.pupg[d] = r.pupg[d] || {};
      for (const k in older.pupg[d]) mine[k] = Math.max(mine[k] || 0, older.pupg[d][k]);
    }
    r.pupgDone = r.pupgDone || older.pupgDone;
    // Favoritos: gana lo último que se hizo con cada uno (poner o quitar), en
    // cualquier aparato. Partidas con cada Pokémon: el mayor de los dos.
    r.dfav = r.dfav || {};
    for (const d in older.dfav || {}) if (Math.abs(+older.dfav[d] || 0) > Math.abs(+r.dfav[d] || 0)) r.dfav[d] = older.dfav[d];
    r.pused = r.pused || {};
    for (const d in older.pused || {}) r.pused[d] = Math.max(+r.pused[d] || 0, +older.pused[d] || 0);
    // Movimiento inicial: el de la versión más reciente; si no lo tenía elegido, el de la otra.
    r.pstart = r.pstart || {};
    for (const d in older.pstart || {}) if (!(d in r.pstart)) r.pstart[d] = older.pstart[d];
    r.bots = r.bots || { slots: 0, party: [] };
    r.bots.slots = Math.max(r.bots.slots || 0, older.bots?.slots || 0);
    r.bots.training ||= {};
    for (const [dex, past] of Object.entries(older.bots?.training || {})) {
      const current = r.bots.training[dex];
      if (!current) r.bots.training[dex] = JSON.parse(JSON.stringify(past));
      else {
        current.xp = Math.max(current.xp || 0, past.xp || 0);
        current.learned = [...new Set([...(current.learned || []), ...(past.learned || [])])];
      }
    }
    r.arenaTraining ||= {};
    for (const [dex, past] of Object.entries(older.arenaTraining || {})) {
      const current = r.arenaTraining[dex];
      if (!current) r.arenaTraining[dex] = JSON.parse(JSON.stringify(past));
      else current.learned = [...new Set([...(current.learned || []), ...(past.learned || [])])];
    }
    // Lo conseguido nunca se pierde: unión de legendarios, arenas, objetos, logros...
    for (const coll of ['legends', 'arenas', 'itemsFound', 'evoMoves', 'ach']) {
      r[coll] = r[coll] || {};
      for (const k in older[coll] || {}) if (!r[coll][k]) r[coll][k] = older[coll][k];
    }
    // Misiones del mismo día/semana: el mayor progreso y lo ya recogido.
    const mo = older.missions || {}, mr = r.missions = r.missions || {};
    for (const [per, list] of [['day', 'daily'], ['week', 'weekly']]) {
      if (mr[per] !== mo[per] || !mr[list] || !mo[list]) continue;
      mr[list].forEach((m, i) => {
        const o = mo[list][i];
        if (!o || o.id !== m.id) return;
        m.prog = Math.max(m.prog || 0, o.prog || 0);
        m.claimed = m.claimed || o.claimed;
        m.told = m.told || o.told;
      });
    }
    for (const k in older.stats || {}) r.stats[k] = Math.max(r.stats[k] || 0, older.stats[k] || 0);
    if (r.starter == null) r.starter = older.starter;
    if (r.personality == null) r.personality = older.personality;
    if (r.partner == null || !r.owned[r.partner]) { r.partner = older.partner; r.partnerShiny = older.partnerShiny; }
    r.created = Math.min(a.created || Date.now(), b.created || Date.now());
    r.updated = Math.max(a.updated || 0, b.updated || 0);
    return r;
  }

  /** Sustituye el contenido de `save` sin cambiar el objeto (otros módulos lo tienen). */
  // Copia `s` sobre la partida SIN cambiar los objetos de dentro (mejoras,
  // Pokémon...): las pantallas abiertas guardan referencias a ellos. Antes se
  // sustituían y una compra hecha justo después de subir la partida se
  // apuntaba en la copia vieja: se cobraban las monedas y la mejora se perdía.
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);


  function ready() {
    if (readyP) return readyP;
    readyP = Promise.resolve().then(() => {
      const existing = read(K_SAVE + K_LOCAL);
      const previousKey = read(K_SES);
      const previous = !existing && previousKey ? read(K_SAVE + previousKey) : null;
      key = K_LOCAL;
      save = fold(migrate(existing || previous || newSave('Jugador'), 'Jugador'));
      user = save.name || 'Jugador';
      write(K_SES, K_LOCAL);
      commit();
      return true;
    });
    return readyP;
  }
  function commit() {
    if (!save || !key) return false;
    save.updated = Date.now(); fold(save);
    return write(K_SAVE + key, save);
  }
  function setName(name) { if (save) { save.name = user = name; commit(); } }
  function owns(dex) { return !!(save && save.owned[dex]); }

  function grant(dex, from) {
    if (!save.owned[dex]) save.owned[dex] = { at: Date.now(), from };
  }

  function ownsShiny(dex) { return !!(save && save.shiny && save.shiny[dex]); }

  /** Favoritos de la colección. */
  function isFav(dex) { return !!(save && save.dfav && +save.dfav[dex] > 0); }
  function setFav(dex, on) {
    if (!save) return;
    save.dfav = save.dfav || {};
    save.dfav[dex] = on ? Date.now() : -Date.now();
    commit();
  }

  /** Mejoras compradas para un Pokémon: { id -> nivel }. */
  function upgradesOf(dex) {
    if (!save) return {};
    save.pupg = save.pupg || {};
    return save.pupg[dex] || (save.pupg[dex] = {});
  }

  /** Da la versión shiny (y la normal, si no la tenía). Devuelve true si es nueva. */
  function grantShiny(dex, from) {
    grant(dex, from);
    if (save.shiny[dex]) return false;
    save.shiny[dex] = { at: Date.now(), from };
    return true;
  }


  addEventListener('pagehide', () => {
    commit();
    for (const fn of leaveHooks) { try { fn(); } catch { /* a página está fechando */ } }
  });
  return {
    ready, commit, setName, owns, grant, ownsShiny, grantShiny, merge, upgradesOf, isFav, setFav,
    flush: async () => commit(), saveNow: async () => ({ ok: commit(), why: storageOk ? 'local' : 'fail' }),
    onLeave(fn) { leaveHooks.push(fn); }, onSync() {},
    get mode() { return 'local'; }, get localReason() { return 'account-free'; },
    get syncState() { return storageOk ? 'local' : 'offline'; },
    get user() { return user; }, get guest() { return false; }, get localAuto() { return true; },
    get online() { return false; }, get fb() { return null; },
    get save() { return save; }, get loggedIn() { return !!save; }, get storageOk() { return storageOk; },
    START_COINS
  };
})();
