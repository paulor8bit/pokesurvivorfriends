/* Parceiros: exploração próxima, afinidade permanente e quatro ataques por partida. */
G.Bots = (() => {
  const COSTS = [100, 250, 600], MAX = 3, MOVE_LEVELS = [1, 10, 20, 30], TRAIN_COST = 150;
  const COLORS = ['#5fc8ff', '#7ee07a', '#ff8ad8'], TAU = Math.PI * 2;
  let party = [];
  let bench = new Map();
  const costOf = i => COSTS[i] || 0;
  function state() {
    const b = G.DB.save?.bots || {};
    return { slots: Math.max(0, Math.min(MAX, b.slots | 0)), party: (b.party || []).slice(0, MAX) };
  }
  function unlock() {
    const s = G.DB.save, cur = state().slots;
    if (!s) return { ok: false, error: 'Sin partida.' };
    if (cur >= MAX) return { ok: false, error: 'Ya tienes todos los huecos.' };
    if (s.coins < COSTS[cur]) return { ok: false, error: 'Te faltan monedas.' };
    s.coins -= COSTS[cur]; s.bots ||= { slots: 0, party: [] }; s.bots.slots = cur + 1;
    G.DB.commit(); return { ok: true };
  }
  function assign(slot, dex) {
    const s = G.DB.save, st = state();
    if (!s || !Number.isInteger(slot) || slot < 0 || slot >= st.slots ||
        (dex && (!G.DEX_BY[dex] || !G.DB.owns(dex) || st.party.some((d, i) => i !== slot && d === dex)))) return { ok: false };
    s.bots.party[slot] = dex || null;
    if (dex) profile(dex);
    G.DB.commit(); return { ok: true };
  }
  const remove = slot => assign(slot, null);
  function movePool(dex) {
    const mon = G.DEX_BY[dex];
    if (!mon) return [];
    const first = G.baseStartOf(dex);
    const rest = G.Moves.poolFor(mon).filter(id => id !== first && G.Moves.BY_ID[id]?.kind !== 'buff');
    rest.sort((a, b) => Number(mon.types.includes(G.Moves.BY_ID[b].type)) - Number(mon.types.includes(G.Moves.BY_ID[a].type)));
    return [first, ...rest];
  }
  function profile(dex) {
    const s = G.DB.save, pool = movePool(dex);
    if (!s || !pool.length) return null;
    s.bots ||= { slots: 0, party: [] }; s.bots.training ||= {};
    const p = s.bots.training[dex] ||= { xp: 0, learned: [pool[0]], loadout: pool.slice(0, 4) };
    p.xp = Number.isFinite(p.xp) ? Math.max(0, Math.min(1e12, p.xp)) : 0;
    p.learned = [...new Set([pool[0], ...(p.learned || []).filter(id => pool.includes(id))])];
    const seen = new Set(), old = p.loadout || [];
    p.loadout = Array.from({ length: 4 }, (_, i) => {
      let id = old[i];
      if (!pool.includes(id) || seen.has(id)) id = pool.find(m => !seen.has(m));
      seen.add(id); return id;
    });
    return p;
  }
  function affinityOf(dex) {
    let xp = profile(dex)?.xp || 0, level = 1;
    while (level < 999 && xp >= G.Player.xpFor(level)) { xp -= G.Player.xpFor(level); level++; }
    return { level, xp, next: G.Player.xpFor(level) };
  }
  function train(dex, slot, id) {
    if (!G.DB.owns(dex) || !Number.isInteger(slot) || slot < 0 || slot > 3 || !movePool(dex).includes(id)) return { ok: false, error: 'Movimiento no disponible.' };
    const p = profile(dex);
    if (affinityOf(dex).level < MOVE_LEVELS[slot]) return { ok: false, error: 'Necesitas más afinidad.' };
    if (p.loadout.some((m, i) => i !== slot && m === id)) return { ok: false, error: 'Ese ataque ya está equipado.' };
    const cost = p.learned.includes(id) ? 0 : TRAIN_COST;
    if (G.DB.save.coins < cost) return { ok: false, error: 'Te faltan monedas.' };
    G.DB.save.coins -= cost;
    if (!p.learned.includes(id)) p.learned.push(id);
    p.loadout[slot] = id; G.DB.commit(); return { ok: true, cost };
  }
  function learnMoves(bot) {
    const p = profile(bot.dex);
    bot.plan.forEach((id, i) => {
      if (bot.level < MOVE_LEVELS[i] || bot.hasMove(id)) return;
      if (bot.addMove(id)) {
        if (!p.learned.includes(id)) p.learned.push(id);
        if (i) G.FX.dmgText(bot.x, bot.y - bot.bodyH - 12, G.T('Nuevo ataque'), bot.tagColor);
      }
    });
    bot.tag = bot.mon.name + ' · ' + G.T('Nv.') + ' ' + bot.level;
  }
  function gainXp(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    let save = false;
    for (const bot of party) {
      const p = profile(bot.dex), before = affinityOf(bot.dex).level;
      p.xp = Math.min(1e12, p.xp + amount);
      const levels = bot.gainXp(amount);
      if (levels) learnMoves(bot);
      save ||= levels > 0 || affinityOf(bot.dex).level !== before;
    }
    if (save) G.DB.commit();
  }
  function freeSpot(pl, angle, radius, body, others = party) {
    for (let n = 0; n < 32; n++) {
      const a = angle + n * 0.65, r = radius * (n < 12 ? 1 : n < 24 ? 0.65 : 0.35);
      const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r;
      if (G.World.isFree(x, y, body) && others.every(b => Math.hypot(x - b.x, y - b.y) > body + b.r + 36)) return { x, y };
    }
    return { x: pl.x, y: pl.y };
  }
  function begin(pl, slots) {
    party = []; bench.clear();
    const st = state();
    syncSlots(pl, slots || st.party.slice(0, st.slots).map((dex, i) => ({ dex, slot: i + 1 })));
  }
  function syncSlots(pl, slots = []) {
    const previous = party, next = [], used = new Set();
    for (const config of slots.slice(0, 3)) {
      const dex = config.dex, i = config.slot - 1;
      const mon = dex && G.DEX_BY[dex];
      if (!mon || i < 0 || i > 2 || !G.DB.owns(dex) || used.has(dex)) continue;
      used.add(dex);
      const cached = previous.find(b => b.slot === config.slot && b.dex === dex) || bench.get(config.slot + ':' + dex);
      if (cached) { next.push(cached); continue; }
      const bot = new G.Player(mon, {}, false);
      bot.slot = config.slot;
      bot.bot = true; bot.atkMul = 0.6; bot.tagColor = COLORS[i];
      bot.sector = i * TAU / 3 + 0.7;
      Object.assign(bot, freeSpot(pl, bot.sector, 135 + i * 20, bot.r, next));
      bot.plan = profile(dex).loadout.slice();
      bot.ai = { timer: 0, pathTimer: 0, stuck: 0, returning: false, path: [], anchor: { x: pl.x, y: pl.y } };
      bot.aim = pl.aim; learnMoves(bot); G.Sprites.preload([dex], 8000, false); next.push(bot);
    }
    for (const bot of previous) if (!next.includes(bot)) {
      bench.set(bot.slot + ':' + bot.dex, bot);
      G.Projectiles?.clearOrbs(bot);
    }
    party = next;
  }
  function snapshot() {
    return party.map(b => ({ slot: b.slot, dex: b.dex, level: b.level, x: b.x, y: b.y, ang: b.moveAngle,
      walk: b.walking ? 1 : 0, aim: b.aim, hp: b.hp, maxHp: b.maxHp, dead: 0, mag: b.magnet,
      moves: b.moves.map(m => [m.id, m.lvl]), mv: (b.moves.find(m => m.kind === 'orbit') || b.moves[0])?.id, ml: 1 }));
  }
  function receiveFrame(data = []) {
    const next = [];
    for (const n of data.slice(0, 3)) {
      const mon = G.DEX_BY[n.dex]; if (!mon) continue;
      let b = party.find(p => p.slot === n.slot && p.dex === n.dex);
      if (!b) {
        b = new G.Player(mon); b.bot = true; b.remote = true; b.slot = n.slot; b.x = n.x; b.y = n.y;
        b.tagColor = COLORS[n.slot - 1]; G.Sprites.preload([n.dex], 8000, false);
      }
      b.level = n.level; b.tag = mon.name + ' · ' + G.T('Nv.') + ' ' + n.level; b.net = n;
      const key = JSON.stringify(n.moves);
      if (key !== b.netMoves) {
        b.moves = (n.moves || []).filter(m => G.Moves.BY_ID[m[0]]).map(m => G.Moves.instance(m[0], m[1]));
        b.slots = b.moves.map(m => [m]); b.netMoves = key;
      }
      next.push(b);
    }
    for (const b of party) if (!next.includes(b)) G.Projectiles.clearOrbs(b);
    party = next;
  }
  function updateRemote(dt, time) {
    for (const b of party) { const moves = b.moves; b.netUpdate(dt); b.moves = moves; b.slots = moves.map(m => [m]); G.Combat.ghostOrbit(b, dt, time); }
  }
  function clearLine(b, x, y) {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy);
    for (let k = 1; k <= Math.ceil(d / 12); k++) {
      const t = Math.min(1, k * 12 / (d || 1));
      if (!G.World.isFree(b.x + dx * t, b.y + dy * t, b.r)) return false;
    }
    return true;
  }
  /* BFS local limitado, sem cortar cantos nem atravessar obstáculos. */
  function route(b, goal) {
    if (clearLine(b, goal.x, goal.y)) return [goal];
    const ts = G.World.TS, R = 16, N = R * 2 + 1;
    const ox = Math.floor(b.x / ts) - R, oy = Math.floor(b.y / ts) - R;
    const gx = Math.floor(goal.x / ts) - ox, gy = Math.floor(goal.y / ts) - oy;
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return [];
    const parent = new Int16Array(N * N).fill(-1), open = new Int8Array(N * N).fill(-1), q = [R * N + R];
    const start = q[0], end = gy * N + gx; parent[start] = start;
    const can = (x, y) => {
      if (x < 0 || y < 0 || x >= N || y >= N) return false;
      const k = y * N + x;
      if (open[k] < 0) open[k] = G.World.walkable(ox + x, oy + y) && G.World.isFree((ox + x + 0.5) * ts, (oy + y + 0.5) * ts, b.r) ? 1 : 0;
      return !!open[k];
    };
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let h = 0; h < q.length && parent[end] < 0; h++) {
      const k = q[h], x = k % N, y = (k / N) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (!can(nx, ny) || (dx && dy && (!can(x + dx, y) || !can(x, y + dy)))) continue;
        const next = ny * N + nx;
        if (parent[next] >= 0) continue;
        parent[next] = k; q.push(next);
      }
    }
    if (parent[end] < 0) return [];
    const path = [goal];
    for (let k = end; k !== start; k = parent[k]) path.push({ x: (ox + k % N + 0.5) * ts, y: (oy + ((k / N) | 0) + 0.5) * ts });
    return path.reverse();
  }
  function pickGoal(b, pl) {
    const a = b.ai, spread = b.sector + (Math.random() - 0.5) * 1.35;
    let center = pl, radius = 125 + Math.random() * 85;
    if (!a.returning && b.target && Math.hypot(b.target.x - pl.x, b.target.y - pl.y) < 240) {
      center = b.target; radius = b.moves.some(m => ['melee', 'aura', 'spin'].includes(m.kind)) ? 45 : 100;
    }
    let goal = freeSpot(center, spread, radius, b.r, party.filter(p => p !== b));
    if (Math.hypot(goal.x - pl.x, goal.y - pl.y) > 280) goal = freeSpot(pl, spread, 160, b.r, party.filter(p => p !== b));
    a.goal = goal; a.anchor = { x: pl.x, y: pl.y }; a.path = route(b, goal);
    a.timer = 1.5 + Math.random() * 2; a.pathTimer = 0.8;
  }
  function move(b, pl, dt) {
    const a = b.ai, d = Math.hypot(b.x - pl.x, b.y - pl.y);
    if (d > 620 || (a.stuck > 4 && d > 280)) {
      Object.assign(b, freeSpot(pl, b.sector, 160, b.r, party.filter(p => p !== b))); a.timer = 0; a.stuck = 0;
    }
    const returning = a.returning ? d > 190 : d > 310;
    if (returning !== a.returning) { a.returning = returning; a.timer = 0; }
    a.timer -= dt; a.pathTimer -= dt;
    if (!a.goal || a.timer <= 0 || Math.hypot(pl.x - a.anchor.x, pl.y - a.anchor.y) > 65 || (a.stuck > 1.5 && a.pathTimer <= 0)) {
      pickGoal(b, pl);
    } else if (a.pathTimer <= 0) { a.path = route(b, a.goal); a.pathTimer = 0.8; }
    while (a.path.length && Math.hypot(a.path[0].x - b.x, a.path[0].y - b.y) < 12) a.path.shift();
    const goal = a.path[0];
    let vx = goal ? goal.x - b.x : 0, vy = goal ? goal.y - b.y : 0;
    const norm = Math.hypot(vx, vy);
    if (norm) { vx /= norm; vy /= norm; }
    for (const other of [pl, ...party]) {
      if (other === b) continue;
      let dx = b.x - other.x, dy = b.y - other.y, dist = Math.hypot(dx, dy);
      const space = other === pl ? 85 : Math.max(64, b.r + other.r + 30);
      if (dist >= space) continue;
      if (dist < 1) { dx = Math.cos(b.sector); dy = Math.sin(b.sector); dist = 1; }
      const force = (1 - dist / space) * 2.8; vx += dx / dist * force; vy += dy / dist * force;
    }
    const speed = a.returning ? Math.max(b.spd * 1.7, pl.spd * 1.2) : b.spd * 0.8;
    const length = Math.hypot(vx, vy), step = Math.min(speed * dt, norm || speed * dt), oldX = b.x, oldY = b.y;
    if (length > 0.05) {
      const angle = Math.atan2(vy, vx);
      for (const turn of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4]) {
        const x = b.x + Math.cos(angle + turn) * step, y = b.y + Math.sin(angle + turn) * step;
        if (!G.World.isFree(x, y, b.r)) continue;
        b.x = x; b.y = y; break;
      }
    }
    G.World.collide(b);
    b.walking = Math.hypot(b.x - oldX, b.y - oldY) > 0.1;
    if (b.walking) b.moveAngle = Math.atan2(b.y - oldY, b.x - oldX);
    a.stuck = goal && !b.walking ? a.stuck + dt : Math.max(0, a.stuck - dt);
    return speed;
  }
  function update(dt, pl, time) {
    const enemies = G.EnemyMgr.all(), targeted = new Map();
    for (const b of party) {
      if (b.dead) continue;
      let target = null, score = Infinity;
      for (const e of enemies) {
        if (e.dead || Math.hypot(e.x - pl.x, e.y - pl.y) > 330) continue;
        const distance = Math.hypot(e.x - b.x, e.y - b.y), value = distance + (targeted.get(e) || 0) * 130;
        if (distance < 560 && value < score) { target = e; score = value; }
      }
      if (target !== b.target) { b.target = target; b.ai.timer = 0; }
      if (target) { targeted.set(target, (targeted.get(target) || 0) + 1); b.aim = Math.atan2(target.y - b.y, target.x - b.x); }
      const speed = move(b, pl, dt);
      if (b.attackFace > 0) b.attackFace -= dt;
      if (b.invuln > 0) b.invuln -= dt;
      if (b.slowT > 0) b.slowT -= dt;
      for (const bf of Object.values(b.buffs)) if (bf.n > 0 && (bf.t -= dt) <= 0) bf.n = 0;
      b.anim.dir = G.Sprites.dirFromAngle(b.attackFace > 0 || !b.walking ? b.aim : b.moveAngle);
      b.anim.loop(b.walking ? 'Walk' : 'Idle', b.walking ? speed / 110 : 1); b.anim.update(dt);
      G.Combat.tick(dt, b, time);
    }
  }
  const clear = () => { party = []; bench.clear(); }, list = () => party;
  return { COSTS, MAX, MOVE_LEVELS, TRAIN_COST, costOf, state, unlock, assign, remove, movePool, profile, affinityOf, train, gainXp, begin, syncSlots, snapshot, receiveFrame, updateRemote, update, clear, list };
})();
