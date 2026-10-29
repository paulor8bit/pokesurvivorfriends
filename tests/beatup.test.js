const { test } = require('node:test'), assert = require('node:assert/strict');
const { Campaign, STAGES, WORLD } = require('../js/systems/beatup');
const spec = dex => ({ dex, name: 'Pokémon ' + dex, types: ['normal'], speed: 110, human: false, moves: Array.from({ length: 4 }, () => ({ id: 'tackle', type: 'normal', power: 30, tempo: 3 })) });
function game() { return new Campaign([{ ...spec(25), human: true }, { ...spec(4), human: true }], [41, 56, 66, 74, 68, 67, 75, 42, 93, 94, 57, 76, 305, 262, 248].map(spec), 123); }
function wave(e, index) { const x = [680, 1640, 2640][index] - 170; for (const p of e.state.fighters.filter(f => f.team === 0)) p.x = x; e.step(0.01); for (const p of e.state.fighters.filter(f => f.team !== 0)) p.human = true; }

test('Beatup: movement scrolls together and a living wave blocks further progress', () => {
  const e = game(); e.begin(); wave(e, 0); const s = e.state;
  assert.equal(s.fighting, true); assert.ok(s.fighters.length > 2);
  for (let n = 0; n < 150; n++) { for (const p of s.fighters.filter(f => f.team === 0)) e.input(p.id, { x: 1, y: 0 }); e.step(0.05); }
  assert.equal(s.wave, 0); assert.ok(s.camera > 0); assert.ok(s.fighters.filter(f => f.team === 0).every(f => f.x <= 970));
  assert.equal(e.input('0:0', { x: Infinity, y: 0 }), false);
});

test('Beatup: combos hit enemies in the same lane, never allies, and strong blows knock back', () => {
  const e = game(); e.begin(); wave(e, 0); const [a, ally, target, other] = e.state.fighters;
  a.x = 510; a.y = 350; ally.x = 555; ally.y = 350; target.x = 570; target.y = 350; other.x = 580; other.y = 500;
  for (const f of e.state.fighters) f.hurtGrace = 0;
  assert.equal(e.cast(a, 0), true); assert.equal(ally.hp, 200); assert.ok(target.hp < target.maxHp); assert.equal(other.hp, other.maxHp);
  for (let i = 0; i < 7; i++) e.step(0.05);
  e.cast(a, 0); assert.equal(e.state.bestCombo, 2); assert.ok(e.state.score >= 20);
  const x = target.x; target.hurtGrace = 0; e.cast(a, 1); assert.ok(target.x > x);
});

test('Beatup: breakable boxes drop an apple; pickup and teammate throw heal without duplicating stock', () => {
  const e = game(); e.begin(); const [a, friend] = e.state.fighters, box = e.state.props[0];
  a.x = box.x - 50; a.y = box.y; a.hurtGrace = 99; e.cast(a, 1); a.cooldowns[1] = 0; e.cast(a, 1);
  assert.ok(box.hp <= 0); assert.equal(e.state.apples.length, 1);
  a.x = box.x; a.hp = 50; for (let n = 0; n < 11; n++) e.step(0.05);
  assert.equal(a.hp, 100); assert.equal(a.apples, 1); friend.x = a.x - 50; friend.y = a.y; friend.hp = 50;
  assert.equal(e.throwApple(a), true); for (let n = 0; n < 5; n++) e.step(0.05);
  assert.equal(friend.hp, 100); assert.equal(friend.apples, 0); assert.equal(a.apples, 0);
});

test('Beatup: all nine groups and three bosses must be beaten, then the duo reaches each exit', () => {
  const e = game(); let bosses = 0;
  for (let stage = 0; stage < STAGES.length; stage++) {
    assert.equal(e.begin(), true);
    for (let group = 0; group < 3; group++) {
      wave(e, group); assert.equal(e.state.wave, group);
      const enemies = e.state.fighters.filter(f => f.team !== 0 && f.hp > 0);
      if (group === 2) { assert.equal(enemies.length, 1); assert.equal(enemies[0].dex, STAGES[stage].boss); bosses++; }
      for (const f of enemies) f.hp = 0; e.step(0.01); assert.equal(e.state.phase, 'battle');
    }
    for (const f of e.state.fighters.filter(f => f.team === 0)) f.x = WORLD - 140;
    e.step(0.01); assert.equal(e.state.phase, stage === 2 ? 'champion' : 'bracket');
  }
  assert.equal(bosses, 3); assert.equal(e.state.champion, 0); assert.equal(e.begin(), false);
});

test('Beatup: a partner can be revived by staying nearby; losing both stops the campaign', () => {
  const e = game(); e.begin(); const [a, b] = e.state.fighters; b.hp = 0; b.x = a.x + 30; b.y = a.y;
  for (let n = 0; n < 52; n++) e.step(0.05); assert.equal(b.hp, 100);
  a.hp = b.hp = 0; e.step(0.05); assert.equal(e.state.phase, 'eliminated'); assert.equal(e.input(a.id, { x: 1, y: 0 }), false);
});
