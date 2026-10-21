const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Tournament, dashFor, ENCOUNTERS } = require('../js/systems/arena');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
async function powers(data = new Map(), blocked = false) {
  const G = { DEX_BY: { 25: { dex: 25, types: ['electric'] }, 4: { dex: 4, types: ['fire'] } }, STARTERS: [{ dex: 25 }, { dex: 4 }] };
  const context = vm.createContext({ G, console, addEventListener() {}, localStorage: {
    getItem: k => data.get(k) ?? null, setItem: (k, v) => { if (blocked) throw Error('Storage blocked'); data.set(k, v); }
  } });
  for (const f of ['data/moves.js', 'core/db.js', 'systems/arena-powers.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), context);
  await G.DB.ready(); return G;
}
test('Arena powers: purchases charge once per Pokémon, persist, swap free and never change survival training', async () => {
  const data = new Map(), G = await powers(data), P = G.ArenaPowers;
  const candidate = P.pool(25).find(id => !P.profile(25).learned.includes(id));
  const survival = JSON.stringify({ bots: G.DB.save.bots, upgrades: G.DB.save.pupg, start: G.DB.save.pstart });
  const coins = G.DB.save.coins;
  assert.equal(P.equip(25, 0, candidate).cost, 150); assert.equal(G.DB.save.coins, coins - 150);
  assert.equal(P.equip(25, 1, candidate).cost, 0); assert.equal(new Set(P.profile(25).loadout).size, 4);
  const reloaded = await powers(data); assert.ok(reloaded.ArenaPowers.profile(25).learned.includes(candidate));
  assert.equal(reloaded.ArenaPowers.profile(25).loadout[1], candidate);
  assert.equal(reloaded.DB.save.coins, coins - 150);
  assert.equal(JSON.stringify({ bots: G.DB.save.bots, upgrades: G.DB.save.pupg, start: G.DB.save.pstart }), survival);
  const snapshot = JSON.parse(JSON.stringify(G.DB.save));
  G.DB.save.arenaTraining = {}; G.DB.save.updated += 1;
  assert.ok(G.DB.merge(G.DB.save, snapshot).arenaTraining[25].learned.includes(candidate));
});
test('Arena powers: invalid moves, insufficient funds and failed storage cannot spend coins or unlock powers', async () => {
  const G = await powers(), P = G.ArenaPowers, candidate = P.pool(25).find(id => !P.profile(25).learned.includes(id));
  for (const [dex, slot, id] of [[999, 0, candidate], [25, 4, candidate], [25, 0, 'ember'], [25, 0, 'missing']]) assert.equal(P.equip(dex, slot, id).ok, false);
  G.DB.save.coins = 149; assert.equal(P.equip(25, 0, candidate).ok, false); assert.equal(G.DB.save.coins, 149);
  const blocked = await powers(new Map(), true), balance = blocked.DB.save.coins;
  assert.equal(blocked.ArenaPowers.equip(25, 0, candidate).ok, false); assert.equal(blocked.DB.save.coins, balance);
  assert.equal(blocked.ArenaPowers.profile(25).learned.includes(candidate), false);
});
test('Arena powers: equipped move attributes determine authoritative damage and cooldown', () => {
  const e = tournament(); e.state.teams[0].fighters[0].moves[0] = { id: 'power', type: 'fire', power: 40, tempo: 4 };
  e.begin(); const f = e.state.fighters[0]; e.cast(f, 0);
  assert.equal(f.cooldowns[0], 0.94); assert.equal(e.state.shots[0].damage, 23); assert.equal(e.state.shots[0].type, 'fire');
});
function tournament() {
  const teams = Array.from({ length: 8 }, (_, t) => ({ name: 'Dupla ' + t, fighters: Array.from({ length: t < 5 ? 2 : 1 }, (_, slot) => ({ dex: 25, name: 'Pikachu', types: ['electric'], human: t === 0,
    moves: Array.from({ length: 4 }, () => ({ type: 'electric', name: 'Choque' })) })) }));
  return new Tournament(teams, 123);
}
test('Arena: humans never auto-cast; inputs are bounded and manual attacks have authoritative cooldowns', () => {
  const e = tournament(); e.begin(); const f = e.state.fighters[0];
  e.step(0.05); assert.deepEqual(f.cooldowns, [0, 0, 0, 0]);
  assert.equal(e.input(f.id, { x: Infinity, y: 0 }), false);
  e.input(f.id, { x: 5000, y: 0, attack: 0 });
  assert.equal(e.state.shots.filter(s => s.team === 0).length, 1);
  e.input(f.id, { x: 0, y: 0, attack: 0 });
  assert.equal(e.state.shots.filter(s => s.team === 0).length, 1);
  e.input(f.id, { x: 0, y: 0, attack: 1 }); assert.equal(e.state.shots.filter(s => s.team === 0).length, 4);
  e.input(f.id, { x: 0, y: 0, attack: 44 }); assert.equal(f.cooldowns.length, 4);
  e.input(f.id, { x: 1000, y: 0 }); const before = f.x; e.step(0.05); assert.ok(f.x - before <= 9.25);
  for (let i = 0; i < 10; i++) e.step(0.05); const stopped = f.x; e.step(0.05); assert.equal(f.x, stopped);
});
test('Arena: apples heal 25%, store at most one and only consume at full HP when inventory is empty', () => {
  const e = tournament(); e.begin(); const f = e.state.fighters[0];
  assert.equal(f.apples, 0);
  e.state.apples.push({ x: f.x, y: f.y, life: 10 }); e.step(0.01); assert.equal(e.state.apples.length, 0); assert.equal(f.apples, 1); assert.equal(f.hp, 200);
  e.state.apples.push({ x: f.x, y: f.y, life: 10 }); e.step(0.01); assert.equal(e.state.apples.length, 1);
  f.hp = 20; e.step(0.01); assert.equal(f.hp, 70); assert.equal(e.state.apples.length, 0);
  f.hp = 190; e.state.apples.push({ x: f.x, y: f.y, life: 10 }); e.step(0.01); assert.equal(f.hp, 200);
  f.hp = 0; e.state.apples.push({ x: f.x, y: f.y, life: 10 }); e.step(0.01); assert.equal(f.hp, 0);
});
test('Arena: faster Pokémon dash farther and faster, recharge sooner, respect bounds and cannot spam dash', () => {
  assert.ok(dashFor(150).distance > dashFor(80).distance); assert.ok(dashFor(150).speed > dashFor(80).speed); assert.ok(dashFor(150).cooldown < dashFor(80).cooldown);
  const travelled = [];
  for (const speed of [80, 150]) {
    const e = tournament(); e.state.teams[0].fighters[0].speed = speed; e.begin(); const f = e.state.fighters[0], start = f.x;
    for (const p of e.state.fighters) p.human = true;
    e.input(f.id, { x: 0, y: 0, dash: true }); assert.equal(f.dashCooldown, dashFor(speed).cooldown);
    for (let i = 0; i < 6; i++) e.step(0.05);
    travelled.push(f.x - start); assert.equal(f.dashLeft, 0);
    assert.equal(e.dash(f, 1, 0), false);
    assert.equal(e.state.events.filter(v => v.kind === 'dash').length, 1);
    while (f.dashCooldown > 0) e.step(0.05);
    f.x = 45; assert.equal(e.dash(f, -1, 0), true); for (let i = 0; i < 6; i++) e.step(0.05); assert.equal(f.x, 45);
    f.hp = 0; f.dashCooldown = 0; assert.equal(e.dash(f, 1, 0), false);
  }
  assert.ok(travelled[1] > travelled[0]);
});
test('Arena: a collected apple can be thrown once to heal only the partner, without creating more apples', () => {
  const e = tournament(); e.begin(); const [f, friend, rival] = e.state.fighters;
  for (const p of e.state.fighters) p.human = true;
  assert.equal(e.throwApple(f), false); f.hp = 100;
  e.state.apples.push({ x: f.x, y: f.y, life: 10 }); e.step(0.01);
  assert.equal(f.hp, 150); assert.equal(f.apples, 1);
  assert.equal(e.throwApple(f), false); assert.equal(f.apples, 1);
  friend.hp = 50; rival.x = f.x; rival.y = (f.y + friend.y) / 2; rival.hp = 100;
  e.input(f.id, { x: 0, y: 0, apple: true }); e.input(f.id, { x: 0, y: 0, apple: true });
  assert.equal(f.apples, 0); assert.equal(e.state.thrownApples.length, 1);
  for (let i = 0; i < 12; i++) e.step(0.05);
  assert.equal(friend.hp, 100); assert.equal(friend.apples, 0); assert.equal(rival.hp, 100); assert.equal(e.state.thrownApples.length, 0);
  friend.hp = 195; f.apples = 1; e.throwApple(f); for (let i = 0; i < 12; i++) e.step(0.05); assert.equal(friend.hp, 200);
  friend.hp = 50; f.apples = 1; e.throwApple(f); friend.hp = 0; e.step(0.05); assert.equal(friend.hp, 0); assert.equal(e.state.thrownApples.length, 0);
  f.apples = 1; assert.equal(e.throwApple(f), false); assert.equal(f.apples, 1);
});
test('Arena: stored apple survives the next round; a new tournament starts empty and inactive actions are rejected', () => {
  const e = tournament(); assert.equal(e.input('0:0', { x: 0, y: 0, dash: true, apple: true }), false);
  e.begin(); const f = e.state.fighters[0]; f.apples = 1; e.dash(f, 1, 0); e.finish(0); e.begin();
  assert.equal(e.state.fighters[0].apples, 1); assert.equal(e.state.fighters[0].dashCooldown, 0);
  const fresh = tournament(); fresh.begin(); assert.ok(fresh.state.fighters.every(f => f.apples === 0));
});
test('Arena: apples fall periodically, cannot heal in mid-air and expire if unclaimed', () => {
  const e = tournament(); e.begin(); for (const f of e.state.fighters) f.human = true;
  for (let i = 0; i < 101; i++) e.step(0.05);
  assert.equal(e.state.apples.length, 1); const a = e.state.apples[0]; assert.ok(a.fall > 0);
  const f = e.state.fighters[0]; f.x = a.x; f.y = a.y; f.hp = 10;
  e.step(0.05); assert.equal(f.hp, 10);
  for (let i = 0; i < 15; i++) e.step(0.05); assert.equal(f.hp, 60);
  e.state.apples.push({ x: 50, y: 50, life: 0.02 }); e.step(0.05); assert.equal(e.state.apples.length, 0);
});
test('Arena: the duo must defeat all seven encounters; minibosses and final boss fight alone with stronger stats', () => {
  const e = tournament();
  for (let r = 0; r < 7; r++) {
    assert.equal(e.begin(), true); assert.equal(e.state.round, r);
    assert.equal(e.state.fighters.filter(f => f.team === 0).length, 2);
    const rivals = e.state.fighters.filter(f => f.team !== 0);
    assert.equal(rivals.length, r < 4 ? 2 : 1);
    assert.ok(rivals.every(f => f.hp === ENCOUNTERS[r].hp && f.scale === ENCOUNTERS[r].scale));
    assert.ok(e.state.fighters.every(f => f.hp === f.maxHp && f.cooldowns.every(c => c === 0)));
    e.state.fighters[0].hp = 1; e.state.fighters[0].cooldowns[0] = 5;
    for (const f of e.state.fighters) if (f.team !== 0) f.hp = 0;
    e.step(0.01);
  }
  assert.equal(e.state.phase, 'champion'); assert.equal(e.state.champion, 0);
  const matches = e.state.rounds.flat(); assert.equal(matches.length, 7);
  assert.ok(matches.every(m => m.winner === m.a || m.winner === m.b));
  assert.equal(e.begin(), false);
});

test('Arena: boss specials warn both players, allow dodging, alternate targets and stop after defeat', () => {
  const e = tournament();
  for (let r = 0; r < 6; r++) { e.begin(); e.finish(0); } e.begin();
  const [a, b, boss] = e.state.fighters;
  for (const f of e.state.fighters) { f.human = true; f.nextAttack = 999; }
  assert.equal(e.partner(boss), undefined); assert.equal(e.throwApple(boss), false);
  assert.equal(e.target(boss), a); e.state.time = 4; assert.equal(e.target(boss), b);
  e.state.time = 5.99; e.step(0.02);
  assert.equal(e.state.warnings.length, 2); assert.equal(a.hp, 200); assert.equal(b.hp, 200);
  a.x += 200;
  for (let n = 0; n < 25; n++) e.step(0.05);
  assert.equal(a.hp, 200); assert.ok(b.hp < 200); assert.equal(e.state.warnings.length, 0);
  e.state.warnings.push({ life: 1 }); boss.hp = 0; e.step(0.01);
  assert.equal(e.state.phase, 'champion'); assert.equal(e.state.warnings.length, 0);
});

test('Arena: losing to a subchief cannot skip it; draws replay the same 2v1 and overtime drains equal HP percentages', () => {
  const e = tournament();
  for (let r = 0; r < 4; r++) { e.begin(); e.finish(0); } e.begin();
  const [a, b, boss] = e.state.fighters;
  for (const f of e.state.fighters) f.human = true;
  e.state.time = 120; e.nextSpecial = 999; e.step(0.05);
  assert.ok(Math.abs(a.hp / a.maxHp - boss.hp / boss.maxHp) < 0.00001);
  for (const f of e.state.fighters) f.hp = 0; e.step(0.01);
  assert.equal(e.state.phase, 'draw'); assert.equal(e.rematch(), true);
  assert.equal(e.state.round, 4); assert.equal(e.state.fighters.length, 3);
  for (const f of e.state.fighters) if (f.team === 0) f.hp = 0; e.step(0.01);
  assert.equal(e.state.phase, 'eliminated'); assert.equal(e.state.round, 4);
  assert.equal(e.state.rounds[5][0].winner, null); assert.equal(e.begin(), false);
});
test('Arena: a fallen partner does not end the match; losing and draws cannot advance the player', () => {
  const e = tournament(); e.begin(); e.state.fighters[0].hp = 0; e.step(0.01); assert.equal(e.state.phase, 'battle');
  e.state.fighters[1].hp = 0; e.step(0.01); assert.equal(e.state.phase, 'eliminated'); assert.notEqual(e.state.champion, 0);
  assert.equal(e.begin(), false);
  const draw = tournament(); draw.begin(); for (const f of draw.state.fighters) f.hp = 0;
  draw.step(0.01); assert.equal(draw.state.phase, 'draw'); assert.equal(draw.rematch(), true); assert.equal(draw.state.round, 0);
});
test('Arena: projectiles only damage opponents; AI takes over a disconnected teammate', () => {
  const e = tournament(); e.begin(); const f = e.state.fighters[0], friend = e.state.fighters[1], enemy = e.state.fighters[2];
  for (const fighter of e.state.fighters) fighter.human = true;
  friend.x = f.x + 30; friend.y = f.y; enemy.x = f.x + 120; enemy.y = f.y;
  e.cast(f, 0); for (let n = 0; n < 6; n++) e.step(0.05);
  assert.equal(friend.hp, 200); assert.ok(enemy.hp < 200);
  e.state.fighters[3].x = friend.x + 100; e.state.fighters[3].y = friend.y;
  friend.human = false; friend.nextAttack = e.state.time; friend.cooldowns.fill(0); e.step(0.01); assert.ok(friend.cooldowns.some(c => c > 0));
});
test('Arena: rival bots allow an opening, split targets and never dump all four attacks in one instant', () => {
  const e = tournament(); e.begin(); const [player, partner, a, b] = e.state.fighters;
  a.x = player.x + 80; a.y = player.y; b.x = partner.x + 80; b.y = partner.y;
  assert.equal(e.target(a).id, player.id); assert.equal(e.target(b).id, partner.id);
  for (let i = 0; i < 30; i++) e.step(0.05);
  assert.equal(e.state.events.filter(v => v.kind === 'cast').length, 0);
  for (let i = 0; i < 20; i++) e.step(0.05);
  for (const f of [a, b]) assert.ok(e.state.events.filter(v => v.kind === 'cast' && v.fighter === f.id).length <= 1);
});
test('Arena: brief damage protection prevents a close-range volley from stacking instantly, then expires', () => {
  const e = tournament(); e.begin(); const f = e.state.fighters[0];
  e.hurt(f, 13, 'electric'); e.hurt(f, 13, 'electric'); e.hurt(f, 13, 'electric'); assert.equal(f.hp, 187);
  for (let i = 0; i < 5; i++) e.step(0.05);
  e.hurt(f, 13, 'electric'); assert.equal(f.hp, 174);
});
test('Arena: random type disadvantages are softer in the opening round than in the final', () => {
  const hp = [];
  for (const round of [0, 2]) {
    const e = tournament(); e.typeMultiplier = () => 4;
    for (let r = 0; r < round; r++) { e.begin(); e.finish(0); } e.begin();
    const player = e.state.fighters[0]; e.hurt(player, 100, 'ground'); hp.push(player.hp);
  }
  assert.ok(hp[0] > hp[1]); assert.ok(hp[0] >= 80); assert.ok(hp[1] > 0);
});
test('Arena: a manual player with a bot can win the opening round; later rounds retain a challenge', () => {
  for (const round of [0, 1, 2]) {
    const e = tournament(); e.state.teams[0].fighters[1].human = false;
    for (let r = 0; r < round; r++) { e.begin(); e.finish(0); } e.begin();
    const rival = e.state.fighters[2]; e.cast(rival, 0);
    const shot = e.state.shots[0]; assert.ok(shot.damage < 17); assert.ok(Math.hypot(shot.vx, shot.vy) < 440);
    if (round === 0) {
      let next = 0;
      while (e.state.phase === 'battle' && e.state.time < 120) {
        const p = e.state.fighters[0], s = e.state;
        if (p.hp > 0 && s.time >= next) {
          next = s.time + 0.35; const enemy = e.target(p), dx = enemy.x - p.x, dy = enemy.y - p.y, d = Math.hypot(dx, dy) || 1;
          const dir = d > 240 ? 1 : d < 170 ? -1 : 0;
          const attack = [0, 1, 2, 3].find(i => p.cooldowns[i] === 0 && (i < 2 || d < (i === 2 ? 185 : 150)));
          e.input(p.id, { x: dx / d * dir - dy / d * Math.sin(s.time) * 0.45, y: dy / d * dir + dx / d * Math.sin(s.time) * 0.45, attack });
        }
        e.step(0.05);
      }
      assert.equal(e.state.phase, 'bracket'); assert.ok(e.state.time > 8); assert.ok(e.state.fighters[0].hp > 0);
    }
  }
});
