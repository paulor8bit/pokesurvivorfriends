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
  const ENCOUNTERS = [
    { title: 'Desafio 1', kind: 'duo', hp: 200, damage: 0.7, shot: 0.78, delay: 1, limit: 90, scale: 1 },
    { title: 'Desafio 2', kind: 'duo', hp: 210, damage: 0.75, shot: 0.81, delay: 0.95, limit: 90, scale: 1 },
    { title: 'Desafio 3', kind: 'duo', hp: 220, damage: 0.8, shot: 0.84, delay: 0.9, limit: 90, scale: 1 },
    { title: 'Desafio 4', kind: 'duo', hp: 230, damage: 0.85, shot: 0.87, delay: 0.85, limit: 90, scale: 1 },
    { title: 'Subchefe · Machamp', kind: 'mini', dex: 68, hp: 440, damage: 1, shot: 0.9, delay: 0.85, limit: 120, scale: 1.4 },
    { title: 'Subchefe · Lucario', kind: 'mini', dex: 448, hp: 520, damage: 1.05, shot: 0.93, delay: 0.8, limit: 120, scale: 1.4 },
    { title: 'Chefe final · Mewtwo', kind: 'boss', dex: 150, hp: 760, damage: 1.15, shot: 0.96, delay: 0.75, limit: 120, scale: 1.7 }
  ];
  const encounter = round => ENCOUNTERS[clamp(round | 0, 0, ENCOUNTERS.length - 1)];
  function skillFor(move, index) {
    const base = SKILLS[index];
    return { ...base, damage: Math.round(base.damage * (Number.isFinite(move?.power) ? clamp(move.power / 30, 0.85, 1.35) : 1)),
      cooldown: Math.round(base.cooldown * (Number.isFinite(move?.tempo) ? clamp(move.tempo / 3, 0.9, 1.25) : 1) * 100) / 100 };
  }
  function dashFor(speed = 110) {
    const ratio = clamp(Number.isFinite(speed) ? speed : 110, 70, 170) / 110;
    return { speed: 850 * ratio, distance: Math.round(175 * ratio), cooldown: Math.round(5 / ratio * 10) / 10 };
  }
  class Tournament {
    constructor(teams, seed = 1, typeMultiplier = () => 1) {
      if (teams.length !== 8 || teams.some((t, i) => t.fighters.length !== (i === 0 || encounter(i - 1).kind === 'duo' ? 2 : 1))) throw Error('A torre precisa da sua dupla, quatro duplas rivais, dois subchefes e um chefe.');
      this.seed = seed >>> 0; this.typeMultiplier = typeMultiplier;
      this.state = { teams, rounds: ENCOUNTERS.map((_, i) => [{ a: 0, b: i + 1, winner: null }]),
        round: 0, phase: 'bracket', fighters: [], shots: [], effects: [], warnings: [], apples: [], thrownApples: [], events: [], time: 0, champion: null, serial: 0 };
      this.eventId = 0;
      this.inputs = new Map(); this.nextApple = 5;
    }
    random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
    begin() {
      const s = this.state;
      if (s.phase !== 'bracket') return false;
      const match = s.rounds[s.round].find(m => m.a === 0 || m.b === 0);
      if (!match || match.winner !== null) return false;
      const carried = new Map(s.fighters.map(f => [f.id, f.apples]));
      const fight = encounter(s.round);
      s.phase = 'battle'; s.time = 0; s.shots = []; s.effects = []; s.warnings = []; s.apples = []; s.thrownApples = []; s.events = []; s.serial++; this.nextApple = 5; this.nextSpecial = 6; this.inputs.clear();
      s.fighters = [match.a, match.b].flatMap((team, side) => s.teams[team].fighters.map((f, slot) => ({
        ...f, id: team + ':' + slot, team, slot, x: side ? 850 : 270, y: team !== 0 && fight.kind !== 'duo' ? 340 : slot ? 420 : 260,
        rank: team === 0 ? '' : fight.kind, scale: team === 0 ? 1 : fight.scale,
        hp: team === 0 ? 200 : fight.hp, maxHp: team === 0 ? 200 : fight.hp, cooldowns: [0, 0, 0, 0], angle: side ? Math.PI : 0, flash: 0, cast: 0, moving: false,
        dashCooldown: 0, dashLeft: 0, dashAngle: 0, apples: carried.get(team + ':' + slot) === 1 ? 1 : 0,
        hurtGrace: 0, nextAttack: team === 0 ? 0.6 : 1.8 + slot * 0.45, nextSkill: slot
      })));
      return true;
    }
    input(id, value) {
      const f = this.state.fighters.find(p => p.id === id);
      if (this.state.phase !== 'battle' || !f || f.hp <= 0 || !value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return false;
      const d = Math.max(1, Math.hypot(value.x, value.y));
      this.inputs.set(id, { x: value.x / d, y: value.y / d, at: this.state.time });
      if (Number.isInteger(value.attack) && value.attack >= 0 && value.attack < 4) this.cast(f, value.attack);
      if (value.dash === true) this.dash(f, value.x / d, value.y / d);
      if (value.apple === true) this.throwApple(f);
      return true;
    }
    partner(f) { return this.state.fighters.find(p => p.team === f.team && p.id !== f.id && p.hp > 0); }
    dash(f, x, y) {
      if (this.state.phase !== 'battle' || f.hp <= 0 || f.dashCooldown > 0 || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      const stats = dashFor(f.speed);
      f.dashAngle = Math.hypot(x, y) > 0.05 ? Math.atan2(y, x) : f.angle;
      f.angle = f.dashAngle; f.dashLeft = stats.distance; f.dashCooldown = stats.cooldown;
      this.event('dash', { x: f.x, y: f.y, angle: f.dashAngle, fighter: f.id });
      return true;
    }
    throwApple(f) {
      const friend = this.partner(f);
      if (this.state.phase !== 'battle' || f.hp <= 0 || f.apples !== 1 || !friend || friend.hp >= friend.maxHp) return false;
      f.apples = 0;
      this.state.thrownApples.push({ x: f.x, y: f.y, target: friend.id, team: f.team, life: 4 });
      this.event('apple-throw', { x: f.x, y: f.y, fighter: f.id });
      return true;
    }
    heal(f) {
      if (f.hp <= 0) return;
      const before = f.hp; f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.25);
      if (f.hp > before) {
        this.event('heal', { x: f.x, y: f.y, amount: Math.ceil(f.hp - before), fighter: f.id });
        this.state.effects.push({ x: f.x, y: f.y, radius: 40, type: 'grass', life: 0.5 });
      }
    }
    target(f) {
      const enemies = this.state.fighters.filter(p => p.team !== f.team && p.hp > 0);
      if (f.rank === 'mini' || f.rank === 'boss') return enemies[Math.floor(this.state.time / 4) % enemies.length];
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
      const progress = this.state.round / (ENCOUNTERS.length - 1);
      const mult = clamp(this.typeMultiplier(type, target.types || []), 0.85 - progress * 0.2, 1.15 + progress * 0.2);
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
      const rival = f.team !== 0, fight = encounter(s.round), damage = skill.damage * (rival ? fight.damage : 1);
      const shotSpeed = skill.speed * (rival ? fight.shot : 1);
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
          if (Math.hypot(p.x - f.x - dx * t, p.y - f.y - dy * t) < 48 + ((p.scale || 1) - 1) * 20) this.hurt(p, damage, type);
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
      const friend = this.partner(f);
      if (f.apples && friend && friend.hp < friend.maxHp * 0.65) this.throwApple(f);
      const apple = f.hp < f.maxHp * 0.65 && this.state.apples.slice().sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
      const goal = apple || enemy, dx = goal.x - f.x, dy = goal.y - f.y, dist = Math.hypot(dx, dy) || 1;
      const closing = apple ? 1 : dist > 210 ? 1 : dist < 130 ? -0.7 : 0;
      const strafe = apple ? 0 : Math.sin(this.state.time * 1.8 + f.slot * 2) * 0.65;
      if (this.state.time >= f.nextAttack) {
        const distance = Math.hypot(enemy.x - f.x, enemy.y - f.y);
        for (let n = 0; n < 4; n++) {
          const i = (f.nextSkill + n) % 4;
          if (f.cooldowns[i] > 0 || !((i < 2 && distance < 460) || (i === 2 && distance < 185) || (i === 3 && distance < 150))) continue;
          if (this.cast(f, i)) { f.nextSkill = (i + 1) % 4; f.nextAttack = this.state.time + (f.team === 0 ? 0.55 : encounter(this.state.round).delay); break; }
        }
      }
      return { x: dx / dist * closing - dy / dist * strafe, y: dy / dist * closing + dx / dist * strafe };
    }
    step(dt) {
      const s = this.state; if (s.phase !== 'battle') return;
      dt = clamp(dt, 0, 0.05); s.time += dt;
      for (const f of s.fighters) {
        f.cooldowns = f.cooldowns.map(c => Math.max(0, c - dt)); f.flash = Math.max(0, f.flash - dt); f.cast = Math.max(0, f.cast - dt); f.hurtGrace = Math.max(0, f.hurtGrace - dt);
        f.dashCooldown = Math.max(0, f.dashCooldown - dt);
        if (f.hp <= 0) continue;
        const input = f.human ? this.inputs.get(f.id) : this.ai(f, dt);
        const v = input && (!f.human || s.time - input.at < 0.4) ? input : { x: 0, y: 0 };
        const norm = Math.max(1, Math.hypot(v.x, v.y)); f.moving = f.dashLeft > 0 || Math.hypot(v.x, v.y) > 0.05;
        if (f.dashLeft > 0) {
          const distance = Math.min(f.dashLeft, dashFor(f.speed).speed * dt);
          f.x = clamp(f.x + Math.cos(f.dashAngle) * distance, 45, WIDTH - 45);
          f.y = clamp(f.y + Math.sin(f.dashAngle) * distance, 70, HEIGHT - 40);
          f.dashLeft = Math.max(0, f.dashLeft - distance); f.angle = f.dashAngle;
        } else {
          f.x = clamp(f.x + v.x / norm * 185 * dt, 45, WIDTH - 45); f.y = clamp(f.y + v.y / norm * 185 * dt, 70, HEIGHT - 40);
          if (f.moving && !f.cast) f.angle = Math.atan2(v.y, v.x);
        }
        if (s.time > encounter(s.round).limit) f.hp = Math.max(0, f.hp - dt * f.maxHp * 0.04);
      }
      const boss = s.fighters.find(f => ['mini', 'boss'].includes(f.rank) && f.hp > 0);
      if (boss && s.time >= this.nextSpecial) {
        this.nextSpecial = s.time + (boss.rank === 'boss' ? 6 : 8);
        for (const p of s.fighters.filter(f => f.team === 0 && f.hp > 0)) s.warnings.push({ x: p.x, y: p.y, radius: boss.rank === 'boss' ? 100 : 80, life: 1.2, damage: boss.rank === 'boss' ? 38 : 28, type: boss.types?.[0] || 'normal', team: boss.team });
        this.event('warning', { x: boss.x, y: boss.y, fighter: boss.id });
      }
      for (const zone of s.warnings) {
        zone.life -= dt;
        if (zone.life <= 0) {
          for (const f of s.fighters) if (f.team !== zone.team && f.hp > 0 && Math.hypot(f.x - zone.x, f.y - zone.y) < zone.radius) this.hurt(f, zone.damage, zone.type);
          s.effects.push({ x: zone.x, y: zone.y, radius: zone.radius, type: zone.type, life: 0.5 });
          this.event('slam', { x: zone.x, y: zone.y, radius: zone.radius, type: zone.type });
        }
      }
      s.warnings = s.warnings.filter(z => z.life > 0);
      for (const shot of s.shots) {
        shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
        for (const f of s.fighters) if (f.team !== shot.team && f.hp > 0 && Math.hypot(f.x - shot.x, f.y - shot.y) < 23 * (f.scale || 1) + shot.radius) {
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
        const f = !apple.fall && s.fighters.find(f => f.hp > 0 && (f.hp < f.maxHp || !f.apples) && Math.hypot(f.x - apple.x, f.y - apple.y) < 34);
        if (f) { this.heal(f); f.apples = 1; apple.life = 0; this.event('apple-pickup', { x: f.x, y: f.y, fighter: f.id }); }
      }
      s.apples = s.apples.filter(a => a.life > 0);
      for (const apple of s.thrownApples) {
        apple.life -= dt;
        if (apple.life <= 0) continue;
        const friend = s.fighters.find(f => f.id === apple.target && f.team === apple.team && f.hp > 0);
        if (!friend) { apple.life = 0; continue; }
        const dx = friend.x - apple.x, dy = friend.y - apple.y, distance = Math.hypot(dx, dy);
        if (distance <= 24 + 470 * dt) { this.heal(friend); apple.life = 0; }
        else { apple.x += dx / distance * 470 * dt; apple.y += dy / distance * 470 * dt; }
      }
      s.thrownApples = s.thrownApples.filter(a => a.life > 0);
      const living = [...new Set(s.fighters.filter(f => f.hp > 0).map(f => f.team))];
      if (living.length <= 1) {
        if (!living.length) { s.phase = 'draw'; return; }
        this.finish(living[0]);
      }
    }
    finish(winner) {
      const s = this.state, matches = s.rounds[s.round];
      if (s.phase !== 'battle' || ![0, s.round + 1].includes(winner)) return false;
      matches[0].winner = winner; s.shots = []; s.warnings = []; s.thrownApples = [];
      if (winner !== 0) s.phase = 'eliminated';
      else if (s.round < ENCOUNTERS.length - 1) { s.round++; s.phase = 'bracket'; }
      else { s.champion = 0; s.phase = 'champion'; }
      return true;
    }
    rematch() { if (this.state.phase !== 'draw') return false; this.state.phase = 'bracket'; return this.begin(); }
  }
  const api = { Tournament, ENCOUNTERS, encounter, SKILLS, skillFor, dashFor, WIDTH, HEIGHT };
  if (typeof G !== 'undefined') G.ArenaRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
