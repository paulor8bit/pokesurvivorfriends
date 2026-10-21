/* Arena simulation. The host owns combat, cooldowns, pickups and tournament results. */
(function () {
  const WIDTH = 1120, HEIGHT = 680;
  const SKILLS = [
    { role: 'Disparo', cooldown: 0.75, damage: 17, speed: 440, radius: 9 },
    { role: 'Rajada tripla', cooldown: 3.2, damage: 13, speed: 380, radius: 10 },
    { role: 'Investida', cooldown: 5, damage: 30, range: 180 },
    { role: 'Explosão', cooldown: 7, damage: 40, range: 155 }
  ];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function skillFor(move, index) {
    const base = SKILLS[index];
    return { ...base, damage: Math.round(base.damage * (Number.isFinite(move?.power) ? clamp(move.power / 30, 0.85, 1.35) : 1)),
      cooldown: Math.round(base.cooldown * (Number.isFinite(move?.tempo) ? clamp(move.tempo / 3, 0.9, 1.25) : 1) * 100) / 100 };
  }
  class Tournament {
    constructor(teams, seed = 1, typeMultiplier = () => 1) {
      if (teams.length !== 8 || teams.some(t => t.fighters.length !== 2)) throw Error('A Arena precisa de oito duplas.');
      this.seed = seed >>> 0; this.typeMultiplier = typeMultiplier;
      this.state = { teams, rounds: [Array.from({ length: 4 }, (_, i) => ({ a: i * 2, b: i * 2 + 1, winner: null }))],
        round: 0, phase: 'bracket', fighters: [], shots: [], effects: [], apples: [], events: [], time: 0, champion: null, serial: 0 };
      this.eventId = 0;
      this.inputs = new Map(); this.nextApple = 5;
    }
    random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
    begin() {
      const s = this.state;
      if (s.phase !== 'bracket') return false;
      const match = s.rounds[s.round].find(m => m.a === 0 || m.b === 0);
      if (!match || match.winner !== null) return false;
      s.phase = 'battle'; s.time = 0; s.shots = []; s.effects = []; s.apples = []; s.events = []; s.serial++; this.nextApple = 5; this.inputs.clear();
      s.fighters = [match.a, match.b].flatMap((team, side) => s.teams[team].fighters.map((f, slot) => ({
        ...f, id: team + ':' + slot, team, slot, x: side ? 850 : 270, y: slot ? 420 : 260,
        hp: 200, maxHp: 200, cooldowns: [0, 0, 0, 0], angle: side ? Math.PI : 0, flash: 0, cast: 0, moving: false,
        hurtGrace: 0, nextAttack: team === 0 ? 0.6 : 1.8 + slot * 0.45, nextSkill: slot
      })));
      return true;
    }
    input(id, value) {
      const f = this.state.fighters.find(p => p.id === id);
      if (!f || f.hp <= 0 || !value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return false;
      const d = Math.max(1, Math.hypot(value.x, value.y));
      this.inputs.set(id, { x: value.x / d, y: value.y / d, at: this.state.time });
      if (Number.isInteger(value.attack) && value.attack >= 0 && value.attack < 4) this.cast(f, value.attack);
      return true;
    }
    target(f) {
      const enemies = this.state.fighters.filter(p => p.team !== f.team && p.hp > 0);
      // Bots cover their counterpart instead of both instantly focusing the human.
      return (!f.human && enemies.find(p => p.slot === f.slot)) || enemies.sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
    }
    event(kind, data) {
      this.state.events.push({ id: ++this.eventId, kind, ...data });
      if (this.state.events.length > 64) this.state.events.shift();
    }
    hurt(target, amount, type) {
      if (target.hp <= 0 || target.hurtGrace > 0) return;
      // Random opening opponents must not hard-counter a beginner's whole team.
      const mult = clamp(this.typeMultiplier(type, target.types || []), [0.85, 0.75, 0.65][this.state.round], [1.15, 1.25, 1.35][this.state.round]);
      const before = target.hp;
      target.hp = Math.max(0, target.hp - amount * mult); target.flash = 0.15; target.hurtGrace = 0.22;
      this.event('hit', { x: target.x, y: target.y, amount: Math.ceil(before - target.hp), type, fighter: target.id, faint: before > 0 && target.hp <= 0 });
    }
    cast(f, index) {
      const s = this.state, skill = skillFor(f.moves[index], index), target = this.target(f);
      if (s.phase !== 'battle' || f.hp <= 0 || f.cooldowns[index] > 0 || !target) return false;
      f.cooldowns[index] = skill.cooldown; f.cast = 0.3;
      f.angle = Math.atan2(target.y - f.y, target.x - f.x);
      const type = f.moves[index]?.type || f.types?.[0] || 'normal';
      const move = f.moves[index]?.id;
      const rival = f.team !== 0, damage = skill.damage * (rival ? [0.7, 0.8, 0.9][s.round] : 1);
      const shotSpeed = skill.speed * (rival ? [0.78, 0.84, 0.9][s.round] : 1);
      this.event('cast', { x: f.x, y: f.y, angle: f.angle, index, move, type, fighter: f.id });
      if (index < 2) {
        for (const spread of index === 1 ? [-0.22, 0, 0.22] : [0]) {
          const a = f.angle + spread;
          s.shots.push({ x: f.x, y: f.y, vx: Math.cos(a) * shotSpeed, vy: Math.sin(a) * shotSpeed,
            radius: skill.radius, damage, life: 1.6, type, move, team: f.team });
        }
      } else if (index === 2) {
        const x = clamp(f.x + Math.cos(f.angle) * skill.range, 45, WIDTH - 45);
        const y = clamp(f.y + Math.sin(f.angle) * skill.range, 70, HEIGHT - 40);
        for (const p of s.fighters) {
          if (p.team === f.team || p.hp <= 0) continue;
          const dx = x - f.x, dy = y - f.y;
          const t = clamp(((p.x - f.x) * dx + (p.y - f.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
          if (Math.hypot(p.x - f.x - dx * t, p.y - f.y - dy * t) < 48) this.hurt(p, damage, type);
        }
        s.effects.push({ x, y, fromX: f.x, fromY: f.y, radius: 38, life: 0.35, type }); f.x = x; f.y = y;
      } else {
        for (const p of s.fighters) if (p.team !== f.team && p.hp > 0 && Math.hypot(p.x - f.x, p.y - f.y) <= skill.range) this.hurt(p, damage, type);
        s.effects.push({ x: f.x, y: f.y, radius: skill.range, life: 0.5, type });
      }
      return true;
    }
    ai(f, dt) {
      const enemy = this.target(f); if (!enemy) return { x: 0, y: 0 };
      const apple = f.hp < f.maxHp * 0.65 && this.state.apples.slice().sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
      const goal = apple || enemy, dx = goal.x - f.x, dy = goal.y - f.y, dist = Math.hypot(dx, dy) || 1;
      const closing = apple ? 1 : dist > 210 ? 1 : dist < 130 ? -0.7 : 0;
      const strafe = apple ? 0 : Math.sin(this.state.time * 1.8 + f.slot * 2) * 0.65;
      if (this.state.time >= f.nextAttack) {
        const distance = Math.hypot(enemy.x - f.x, enemy.y - f.y);
        for (let n = 0; n < 4; n++) {
          const i = (f.nextSkill + n) % 4;
          if (f.cooldowns[i] > 0 || !((i < 2 && distance < 460) || (i === 2 && distance < 185) || (i === 3 && distance < 150))) continue;
          if (this.cast(f, i)) { f.nextSkill = (i + 1) % 4; f.nextAttack = this.state.time + (f.team === 0 ? 0.55 : [1, 0.85, 0.7][this.state.round]); break; }
        }
      }
      return { x: dx / dist * closing - dy / dist * strafe, y: dy / dist * closing + dx / dist * strafe };
    }
    step(dt) {
      const s = this.state; if (s.phase !== 'battle') return;
      dt = clamp(dt, 0, 0.05); s.time += dt;
      for (const f of s.fighters) {
        f.cooldowns = f.cooldowns.map(c => Math.max(0, c - dt)); f.flash = Math.max(0, f.flash - dt); f.cast = Math.max(0, f.cast - dt); f.hurtGrace = Math.max(0, f.hurtGrace - dt);
        if (f.hp <= 0) continue;
        const input = f.human ? this.inputs.get(f.id) : this.ai(f, dt);
        const v = input && (!f.human || s.time - input.at < 0.4) ? input : { x: 0, y: 0 };
        const norm = Math.max(1, Math.hypot(v.x, v.y)); f.moving = Math.hypot(v.x, v.y) > 0.05;
        f.x = clamp(f.x + v.x / norm * 185 * dt, 45, WIDTH - 45); f.y = clamp(f.y + v.y / norm * 185 * dt, 70, HEIGHT - 40);
        if (f.moving && !f.cast) f.angle = Math.atan2(v.y, v.x);
        if (s.time > 90) f.hp = Math.max(0, f.hp - dt * 8);
      }
      for (const shot of s.shots) {
        shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
        for (const f of s.fighters) if (f.team !== shot.team && f.hp > 0 && Math.hypot(f.x - shot.x, f.y - shot.y) < 23 + shot.radius) {
          this.hurt(f, shot.damage, shot.type); shot.life = 0; break;
        }
      }
      s.shots = s.shots.filter(p => p.life > 0 && p.x > 20 && p.x < WIDTH - 20 && p.y > 40 && p.y < HEIGHT - 15);
      for (const e of s.effects) e.life -= dt; s.effects = s.effects.filter(e => e.life > 0);
      if (s.time >= this.nextApple) {
        if (s.apples.length < 3) s.apples.push({ x: 180 + this.random() * 760, y: 130 + this.random() * 420, life: 18, fall: 0.7 });
        this.nextApple = s.time + 6 + this.random() * 3;
      }
      for (const apple of s.apples) {
        apple.life -= dt;
        apple.fall = Math.max(0, (apple.fall || 0) - dt);
        const f = !apple.fall && s.fighters.find(f => f.hp > 0 && f.hp < f.maxHp && Math.hypot(f.x - apple.x, f.y - apple.y) < 34);
        if (f) { const before = f.hp; f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.25); apple.life = 0;
          this.event('heal', { x: f.x, y: f.y, amount: Math.ceil(f.hp - before), fighter: f.id });
          s.effects.push({ x: f.x, y: f.y, radius: 40, type: 'grass', life: 0.5 }); }
      }
      s.apples = s.apples.filter(a => a.life > 0);
      const living = [...new Set(s.fighters.filter(f => f.hp > 0).map(f => f.team))];
      if (living.length <= 1) {
        if (!living.length) { s.phase = 'draw'; return; }
        this.finish(living[0]);
      }
    }
    finish(winner) {
      const s = this.state, matches = s.rounds[s.round];
      for (const m of matches) if (m.winner === null) m.winner = m.a === 0 || m.b === 0 ? winner : this.random() < 0.5 ? m.a : m.b;
      const advance = () => {
        const winners = s.rounds[s.round].map(m => m.winner);
        if (winners.length === 1) { s.champion = winners[0]; return false; }
        s.rounds.push(Array.from({ length: winners.length / 2 }, (_, i) => ({ a: winners[i * 2], b: winners[i * 2 + 1], winner: null })));
        s.round++; return true;
      };
      if (winner !== 0) {
        while (advance()) for (const m of s.rounds[s.round]) m.winner = this.random() < 0.5 ? m.a : m.b;
        s.phase = 'eliminated';
      } else if (advance()) s.phase = 'bracket'; else s.phase = 'champion';
    }
    rematch() { if (this.state.phase !== 'draw') return false; this.state.phase = 'bracket'; return this.begin(); }
  }
  const api = { Tournament, SKILLS, skillFor, WIDTH, HEIGHT };
  if (typeof G !== 'undefined') G.ArenaRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
