/* ============ bots.js — compañeros reclutados que luchan a tu lado ============
 * Sustituye a los amigos online: cada bot es un Pokémon que ya tienes (de tu
 * colección) y que te sigue en la run, apuntando y atacando solo. No reciben
 * daño (son apoyo); el jugador sigue siendo el que aguanta.
 *
 * Guardado en G.DB.save.bots = { slots, party }:
 *   slots  cuántos huecos has desbloqueado (0..MAX)
 *   party  [dex|null, ...] qué Pokémon ocupa cada hueco
 */
G.Bots = (() => {
  const COSTS = [100, 250, 600];   // precio de cada hueco (1º, 2º, 3º)
  const MAX = 3;
  const COLORS = ['#5fc8ff', '#7ee07a', '#ff8ad8'];
  let party = [];                  // G.Player de los bots en la run actual

  const costOf = i => COSTS[i] || 0;

  /** Huecos desbloqueados y qué Pokémon los ocupa (del save). */
  function state() {
    const s = G.DB.save, b = (s && s.bots) || {};
    return { slots: b.slots | 0, party: (b.party || []).slice(0, MAX) };
  }

  /** Desbloquea el siguiente hueco (paga con monedas). */
  function unlock() {
    const s = G.DB.save;
    if (!s) return { ok: false, error: 'Sin partida.' };
    const cur = (s.bots && s.bots.slots) | 0;
    if (cur >= MAX) return { ok: false, error: 'Ya tienes todos los huecos.' };
    const c = COSTS[cur];
    if (s.coins < c) return { ok: false, error: 'Te faltan monedas.' };
    s.coins -= c;
    s.bots = s.bots || { slots: 0, party: [] };
    s.bots.slots = cur + 1;
    G.DB.commit();
    return { ok: true };
  }

  /** Pone un Pokémon (o nada) en un hueco desbloqueado. */
  function assign(slot, dex) {
    const s = G.DB.save;
    if (!s) return { ok: false };
    s.bots = s.bots || { slots: 0, party: [] };
    while (s.bots.party.length < MAX) s.bots.party.push(null);
    s.bots.party[slot] = dex || null;
    G.DB.commit();
    return { ok: true };
  }
  const remove = slot => assign(slot, null);

  // ---------------- dentro de la run ----------------

  /** Crea los bots para esta run (al empezar). */
  function begin(pl) {
    party = [];
    const b = (G.DB.save && G.DB.save.bots) || null;
    if (!b || !b.party) return;
    b.party.forEach((dex, i) => {
      const mon = dex && G.DEX_BY[dex];
      if (!mon) return;
      const bot = new G.Player(mon, {}, false);
      bot.bot = true;
      bot.atkMul = 0.6;                 // apoyan: no eclipsan al jugador
      bot.tag = mon.name;
      bot.tagColor = COLORS[i] || COLORS[0];
      const a = i * 2.4 + 1.0;
      bot.x = pl.x + Math.cos(a) * 44;
      bot.y = pl.y + Math.sin(a) * 44;
      bot.addMove(G.Moves.startFor(mon));
      bot.aim = pl.aim;
      G.Sprites.preload([mon.dex], 8000, false);
      party.push(bot);
    });
  }

  /** Cada fotograma: siguen al jugador, apuntan y atacan solos. */
  function update(dt, pl, time) {
    if (!party.length) return;
    const enemies = G.EnemyMgr.all();
    party.forEach((b, i) => {
      if (b.dead) return;
      // Blanco: el enemigo más cercano.
      const e = G.Projectiles.nearest(enemies, b.x, b.y, 560);
      if (e) { b.aim = Math.atan2(e.y - b.y, e.x - b.x); b.target = e; }
      else b.target = null;

      // Sigue al jugador a una distancia cómoda.
      const dx = b.x - pl.x, dy = b.y - pl.y, d = Math.hypot(dx, dy) || 1;
      const want = 40 + i * 13;
      let vx = 0, vy = 0;
      if (d > want + 8) { vx = -dx / d; vy = -dy / d; }
      else if (d < want - 12) { vx = dx / d; vy = dy / d; }
      const spd = b.spd * (d > 130 ? 2.6 : 1);   // si se queda atrás, acelera
      b.x += vx * spd * dt;
      b.y += vy * spd * dt;
      G.World.collide(b);

      // Animación y temporizadores (como Player.update, pero con IA en vez de input).
      const moving = Math.hypot(vx, vy) > 0.1;
      b.walking = moving;
      if (moving) b.moveAngle = Math.atan2(vy, vx);
      if (b.attackFace > 0) b.attackFace -= dt;
      if (b.invuln > 0) b.invuln -= dt;
      for (const k in b.buffs) { const bf = b.buffs[k]; if (bf.n > 0) { bf.t -= dt; if (bf.t <= 0) bf.n = 0; } }
      const face = b.attackFace > 0 || !moving ? b.aim : b.moveAngle;
      b.anim.dir = G.Sprites.dirFromAngle(face);
      b.anim.loop(moving ? 'Walk' : 'Idle', moving ? spd / 110 : 1);
      b.anim.update(dt);

      // Ataca (todos sus movimientos, cada uno con su recarga).
      G.Combat.tick(dt, b, time);
    });
  }

  const clear = () => { party = []; };
  const list = () => party;

  return { COSTS, MAX, costOf, state, unlock, assign, remove, begin, update, clear, list };
})();
