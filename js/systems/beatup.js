/* Independent scrolling brawler. Only the host simulates combat and progress. */
(() => {
  const A = typeof module !== 'undefined' && module.exports ? require('./arena') : G.ArenaRules;
  const { WIDTH, HEIGHT } = A, WORLD = 3360, TOP = 240, BOTTOM = 575;
  const STAGES = [
    { title: 'Praça Verdante', boss: 68, roster: [56, 66, 74, 41], tint: '#172d3b' },
    { title: 'Docas da Meia-Noite', boss: 94, roster: [67, 75, 42, 93], tint: '#191e3d' },
    { title: 'Avenida das Brasas', boss: 248, roster: [57, 76, 305, 262], tint: '#3a202d' }
  ];
  const SKILLS = [
    { role: 'Combo', cooldown: 0.28, damage: 14, range: 92 },
    { role: 'Golpe forte', cooldown: 1.8, damage: 28, range: 110 },
    { role: 'Investida', cooldown: 4, damage: 25, range: 200 },
    { role: 'Especial', cooldown: 7, damage: 38, range: 145 }
  ];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function skillFor(move, index) {
    const base = SKILLS[index];
    return { ...base, damage: Math.round(base.damage * (Number.isFinite(move?.power) ? clamp(move.power / 30, 0.85, 1.35) : 1)),
      cooldown: Math.round(base.cooldown * (Number.isFinite(move?.tempo) ? clamp(move.tempo / 3, 0.9, 1.25) : 1) * 100) / 100 };
  }
  class Campaign {
    constructor(friends, roster, seed = 1, typeMultiplier = () => 1) {
      if (friends.length !== 2 || !roster.length) throw Error('Escolha os dois Pokémon da dupla.');
      this.seed = seed >>> 0; this.roster = roster; this.typeMultiplier = typeMultiplier;
      this.state = { mode: 'beatup', teams: [{ name: 'Sua dupla', fighters: friends }], round: 0, phase: 'bracket',
        fighters: [], shots: [], effects: [], warnings: [], apples: [], thrownApples: [], events: [], props: [],
        time: 0, serial: 0, champion: null, camera: 0, wave: 0, fighting: false, score: 0, combo: 0, bestCombo: 0 };
      this.inputs = new Map(); this.eventId = 0; this.enemyId = 0; this.nextApple = 8; this.nextSpecial = 6;
    }
    begin() {
      const s = this.state; if (s.phase !== 'bracket') return false;
      const previous = new Map(s.fighters.filter(f => f.team === 0).map(f => [f.id, f]));
      s.phase = 'battle'; s.time = 0; s.camera = 0; s.wave = 0; s.fighting = false; s.serial++;
      s.shots = []; s.effects = []; s.warnings = []; s.apples = []; s.thrownApples = []; s.events = [];
      this.inputs.clear(); this.nextApple = 8; this.nextSpecial = 6;
      s.fighters = s.teams[0].fighters.map((f, slot) => {
        const old = previous.get('0:' + slot), maxHp = 200;
        return { ...f, id: '0:' + slot, team: 0, slot, x: 160 + slot * 55, y: 360 + slot * 90,
          hp: old ? Math.min(maxHp, Math.max(maxHp * 0.5, old.hp + maxHp * 0.25)) : maxHp, maxHp,
          rank: '', scale: 1, angle: 0, flash: 0, cast: 0, moving: false, cooldowns: [0, 0, 0, 0],
          dashCooldown: 0, dashLeft: 0, dashAngle: 0, apples: old?.apples || 0, hurtGrace: 2,
          nextAttack: 0.5, combo: 0, comboT: 0, reviveT: 0, fall: 0 };
      });
      s.props = [850, 1810, 2700].map((x, i) => ({ id: 'box:' + i, x, y: i % 2 ? 300 : 520, hp: 36 }));
      return true;
    }
    humans() { const live = this.state.fighters.filter(f => f.team === 0 && f.human && f.hp > 0); return live.length ? live : this.state.fighters.filter(f => f.team === 0 && f.hp > 0); }
    target(f) {
      return this.state.fighters.filter(p => p.team !== f.team && p.hp > 0)
        .sort((a, b) => Math.hypot(a.x - f.x, (a.y - f.y) * 2) - Math.hypot(b.x - f.x, (b.y - f.y) * 2))[0];
    }
    hurt(target, amount, type, direction = 0, knock = 0) {
      if (target.hp <= 0 || target.hurtGrace > 0) return false;
      const before = target.hp, mult = clamp(this.typeMultiplier(type, target.types || []), 0.75, 1.25);
      target.hp = Math.max(0, target.hp - amount * mult); target.flash = 0.15; target.hurtGrace = target.team === 0 ? 0.5 : 0.16;
      target.x = clamp(target.x + direction * knock, Math.max(35, this.state.camera + 25), WORLD - 35);
      if (!target.hp) target.fall = 0.8;
      this.event('hit', { x: target.x, y: target.y, amount: Math.ceil(before - target.hp), type, fighter: target.id, faint: target.hp <= 0 });
      if (target.team !== 0) this.state.score += target.hp <= 0 ? target.rank === 'boss' ? 500 : 50 : 10;
      return true;
    }
    cast(f, index) {
      const s = this.state, skill = skillFor(f.moves[index], index);
      if (s.phase !== 'battle' || f.hp <= 0 || f.cooldowns[index] > 0) return false;
      const target = this.target(f), box = !target && s.props.find(b => b.hp > 0 && Math.abs(b.x - f.x) < 150 && Math.abs(b.y - f.y) < 50);
      const goal = target || box;
      if (goal) f.angle = goal.x >= f.x ? 0 : Math.PI;
      const dir = Math.cos(f.angle) >= 0 ? 1 : -1, type = f.moves[index]?.type || f.types[0];
      f.cooldowns[index] = skill.cooldown; f.cast = 0.18;
      const origin = f.x;
      if (index === 2) f.x = clamp(f.x + dir * skill.range, Math.max(35, s.camera + 25), this.rightLimit());
      let hit = false;
      for (const p of s.fighters) {
        if (p.team === f.team || p.hp <= 0) continue;
        const dx = p.x - origin, dy = Math.abs(p.y - f.y), reach = skill.range + (p.scale - 1) * 20;
        if (index === 3 ? Math.hypot(dx, dy * 1.5) <= reach : dy < 46 && dx * dir >= -18 && Math.abs(dx) <= reach) hit = this.hurt(p, skill.damage, type, dir, index === 1 ? 55 : index === 2 ? 35 : 10) || hit;
      }
      for (const b of s.props) if (b.hp > 0 && Math.abs(b.x - origin) < skill.range && Math.abs(b.y - f.y) < 55) {
        b.hp -= skill.damage; this.event('hit', { x: b.x, y: b.y, amount: skill.damage, type });
        if (b.hp <= 0) { s.apples.push({ x: b.x, y: b.y, life: 30, fall: 0.5 }); s.score += 25; }
      }
      if (hit) { f.combo = f.comboT > 0 ? f.combo + 1 : 1; f.comboT = 1.5; s.combo = f.combo; s.bestCombo = Math.max(s.bestCombo, f.combo); }
      this.event('cast', { x: origin, y: f.y, angle: f.angle, index, move: f.moves[index]?.id, type, fighter: f.id });
      return true;
    }
    rightLimit() { return this.state.wave < 3 ? [680, 1640, 2640][this.state.wave] + 290 : WORLD - 45; }
    spawnWave() {
      const s = this.state, stage = STAGES[s.round], bossWave = s.wave === 2, count = bossWave ? 1 : 4 + s.round * 2 + s.wave;
      const center = [680, 1640, 2640][s.wave];
      for (let i = 0; i < count; i++) {
        const dex = bossWave ? stage.boss : stage.roster[i % stage.roster.length], spec = this.roster.find(f => f.dex === dex) || this.roster[0];
        const hp = bossWave ? 440 + s.round * 180 : 48 + s.round * 18;
        s.fighters.push({ ...spec, human: false, id: 'e:' + ++this.enemyId, team: 1, slot: i, rank: bossWave ? 'boss' : 'mob', scale: bossWave ? 1.6 : 1,
          x: clamp(center + (i % 2 ? -470 : 250) + i * 18, s.camera + 35, this.rightLimit()), y: 290 + (i % 4) * 76,
          hp, maxHp: hp, cooldowns: [0, 0, 0, 0], angle: Math.PI, flash: 0, cast: 0, moving: false, hurtGrace: 0.6,
          dashCooldown: 0, dashLeft: 0, dashAngle: 0, apples: 0, nextAttack: s.time + 1.6 + i * 0.2, fall: 0 });
      }
      s.fighting = true; this.nextSpecial = s.time + 5; this.event('wave', { x: center, y: 350, boss: bossWave });
    }
    ai(f) {
      const s = this.state, target = this.target(f);
      if (f.team === 0) {
        const leader = s.fighters.find(p => p.team === 0 && p.human && p.hp > 0);
        const friend = s.fighters.find(p => p.team === 0 && p.hp <= 0);
        if (f.apples && this.partner(f)?.hp < 130) this.throwApple(f);
        if (friend && (!target || Math.hypot(target.x - f.x, target.y - f.y) > 170)) return this.toward(f, friend, 25);
        if (!target || leader && Math.abs(f.x - leader.x) > 420) return leader ? this.toward(f, { x: leader.x + 65, y: leader.y + 50 }, 25) : [0, 0];
      }
      if (!target) return [0, 0];
      const dx = target.x - f.x, dy = target.y - f.y;
      if (s.time >= f.nextAttack && Math.abs(dy) < 43 && Math.abs(dx) < 95) {
        if (f.team === 0) { const index = [0, 1, 3].find(i => f.cooldowns[i] <= 0); if (index !== undefined) this.cast(f, index); }
        else {
          f.angle = dx >= 0 ? 0 : Math.PI; f.cast = 0.2;
          this.event('cast', { x: f.x, y: f.y, angle: f.angle, index: 0, move: f.moves[0]?.id, type: f.types[0], fighter: f.id });
          this.hurt(target, (f.rank === 'boss' ? 18 : 7) + s.round * 3, f.types[0], Math.sign(dx), 15);
        }
        f.nextAttack = s.time + (f.team === 0 ? 0.4 : f.rank === 'boss' ? 1.1 : 1.6);
      }
      return this.toward(f, { x: target.x + (dx > 0 ? -60 : 60), y: target.y + (f.slot % 2 ? 15 : -15) }, 12);
    }
    toward(f, p, stop) { const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy); return d > stop ? [dx / d, dy / d] : [0, 0]; }
    step(dt) {
      const s = this.state; if (s.phase !== 'battle') return;
      dt = clamp(dt, 0, 0.05); s.time += dt;
      const human = this.humans(), trail = Math.min(...human.map(f => f.x)), right = Math.min(this.rightLimit(), trail + WIDTH - 130);
      for (const f of s.fighters) {
        f.cooldowns = f.cooldowns.map(c => Math.max(0, c - dt));
        for (const key of ['flash', 'cast', 'hurtGrace', 'dashCooldown', 'comboT', 'fall']) f[key] = Math.max(0, (f[key] || 0) - dt);
        if (!f.hp) {
          if (f.team === 0) {
            f.reviveT = s.fighters.some(p => p.team === 0 && p.hp > 0 && Math.hypot(p.x - f.x, p.y - f.y) < 65) ? (f.reviveT || 0) + dt : 0;
            if (f.reviveT >= 2.5) { f.hp = f.maxHp * 0.5; f.hurtGrace = 3; f.reviveT = 0; this.event('heal', { x: f.x, y: f.y, amount: 100, fighter: f.id }); }
          }
          continue;
        }
        const input = f.human ? this.inputs.get(f.id) : null;
        const [x, y] = f.human ? input && s.time - input.at < 0.4 ? [input.x, input.y] : [0, 0] : this.ai(f);
        f.moving = Math.hypot(x, y) > 0.05 || f.dashLeft > 0;
        const speed = f.team === 0 ? 200 : f.rank === 'boss' ? 100 : 135;
        if (f.dashLeft > 0) { const d = Math.min(f.dashLeft, A.dashFor(f.speed).speed * dt); f.x += Math.cos(f.dashAngle) * d; f.y += Math.sin(f.dashAngle) * d; f.dashLeft -= d; }
        else { f.x += x * speed * dt; f.y += y * speed * dt * 0.8; if (Math.abs(x) > 0.05 && !f.cast) f.angle = x > 0 ? 0 : Math.PI; }
        f.x = clamp(f.x, s.camera + 30, f.team === 0 ? right : this.rightLimit()); f.y = clamp(f.y, TOP, BOTTOM);
      }
      for (const f of s.fighters) if (f.hp > 0) for (const p of s.fighters) if (p !== f && p.hp > 0) {
        const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 30) { f.x = clamp(f.x + dx / d * 35 * dt, s.camera + 30, this.rightLimit()); f.y = clamp(f.y + dy / d * 35 * dt, TOP, BOTTOM); }
      }
      const boss = s.fighters.find(f => f.rank === 'boss' && f.hp > 0);
      if (boss && s.time >= this.nextSpecial) {
        this.nextSpecial = s.time + 7;
        for (const p of s.fighters.filter(f => f.team === 0 && f.hp > 0)) s.warnings.push({ x: p.x, y: p.y, radius: 85, life: 1.2, type: boss.types[0] });
        this.event('warning', { x: boss.x, y: boss.y });
      }
      for (const z of s.warnings) if ((z.life -= dt) <= 0) {
        for (const p of s.fighters) if (p.team === 0 && p.hp > 0 && Math.hypot(p.x - z.x, p.y - z.y) < z.radius) this.hurt(p, 26 + s.round * 4, z.type);
        this.event('slam', { x: z.x, y: z.y, type: z.type, radius: z.radius });
      }
      s.warnings = s.warnings.filter(z => z.life > 0);
      if (s.time >= this.nextApple) { const p = s.fighters.find(f => f.team === 0 && f.hp > 0); if (p && s.apples.length < 3) s.apples.push({ x: clamp(p.x + 100, s.camera + 50, this.rightLimit()), y: 320 + this.random() * 180, life: 24, fall: 0.6 }); this.nextApple = s.time + 10; }
      for (const a of s.apples) {
        a.life -= dt; a.fall = Math.max(0, (a.fall || 0) - dt);
        const f = !a.fall && s.fighters.find(f => f.team === 0 && f.hp > 0 && (f.hp < f.maxHp || !f.apples) && Math.hypot(f.x - a.x, f.y - a.y) < 34);
        if (f) { this.heal(f); f.apples = 1; a.life = 0; this.event('apple-pickup', { x: f.x, y: f.y, fighter: f.id }); }
      }
      s.apples = s.apples.filter(a => a.life > 0);
      for (const a of s.thrownApples) {
        a.life -= dt; const p = s.fighters.find(f => f.id === a.target && f.team === a.team && f.hp > 0);
        if (!p) { a.life = 0; continue; } const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
        if (d < 24 + 470 * dt) { this.heal(p); a.life = 0; } else { a.x += dx / d * 470 * dt; a.y += dy / d * 470 * dt; }
      }
      s.thrownApples = s.thrownApples.filter(a => a.life > 0);
      for (const e of s.effects) e.life -= dt;
      s.effects = s.effects.filter(e => e.life > 0);
      s.combo = Math.max(0, ...s.fighters.filter(f => f.team === 0 && f.comboT > 0).map(f => f.combo));
      s.fighters = s.fighters.filter(f => f.team === 0 || f.hp > 0 || f.fall > 0);
      if (!s.fighters.some(f => f.team === 0 && f.hp > 0)) { s.phase = 'eliminated'; s.warnings = []; return; }
      const left = Math.min(...this.humans().map(f => f.x));
      s.camera = Math.max(s.camera, Math.min(WORLD - WIDTH, left - 260));
      if (s.fighting && !s.fighters.some(f => f.team !== 0 && f.hp > 0)) { s.fighting = false; s.wave++; s.warnings = []; this.event('go', { x: left + 200, y: 330 }); }
      if (!s.fighting && s.wave < 3 && left >= [680, 1640, 2640][s.wave] - 180) this.spawnWave();
      if (s.wave === 3 && left >= WORLD - 170) {
        s.warnings = []; if (s.round === STAGES.length - 1) { s.phase = 'champion'; s.champion = 0; } else { s.round++; s.phase = 'bracket'; }
      }
    }
  }
  for (const name of ['input', 'dash', 'partner', 'throwApple', 'heal', 'event', 'random']) Campaign.prototype[name] = A.Tournament.prototype[name];
  const api = { Campaign, STAGES, SKILLS, skillFor, dashFor: A.dashFor, WIDTH, HEIGHT, WORLD, TOP, BOTTOM };
  if (typeof G !== 'undefined') G.BeatupRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
