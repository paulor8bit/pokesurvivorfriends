const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plan, BOONS } = require('../js/systems/rogue');
test('Rogue: exactly three increasing cycles of easy horde, miniboss and major boss', () => {
  const rooms = Array.from({ length: 9 }, (_, i) => plan(i, 1, 5));
  assert.deepEqual(rooms.map(r => r.stage), [0, 1, 2, 0, 1, 2, 0, 1, 2]);
  assert.deepEqual(rooms.map(r => r.cycle), [0, 0, 0, 1, 1, 1, 2, 2, 2]);
  assert.equal(new Set(rooms.map(r => r.theme)).size, 3);
  for (let n = 0; n < 6; n++) { assert.ok(rooms[n + 3].hp > rooms[n].hp); assert.ok(rooms[n + 3].damage > rooms[n].damage); assert.ok(rooms[n + 3].total > rooms[n].total); }
  for (const c of [0, 3, 6]) assert.ok(rooms[c + 2].bossHp > rooms[c + 1].bossHp);
  for (const index of [-1, 9, 1.5]) assert.throws(() => plan(index));
});
test('Rogue: finite multiplayer hordes and deterministic, distinct temporary boon options', () => {
  for (let i = 0; i < 9; i++) {
    assert.ok(plan(i, 4, 20).total > plan(i, 1, 20).total);
    assert.ok(plan(i, 4, 20).total <= 40);
    const choices = plan(i, 1, 20).choices; assert.equal(new Set(choices).size, 3); assert.ok(choices.every(id => BOONS[id]));
    assert.deepEqual(plan(i, 1, 20), plan(i, 1, 20));
  }
  assert.notDeepEqual(plan(0, 1, 1).choices, plan(0, 1, 2).choices);
});
