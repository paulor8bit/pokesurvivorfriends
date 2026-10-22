const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plan, layout, canExit, BOONS } = require('../js/systems/rogue');
test('Rogue: exactly three increasing cycles of easy horde, miniboss and major boss', () => {
  const rooms = Array.from({ length: 9 }, (_, i) => plan(i, 1, 5));
  assert.deepEqual(rooms.map(r => r.stage), [0, 1, 2, 0, 1, 2, 0, 1, 2]);
  assert.deepEqual(rooms.map(r => r.cycle), [0, 0, 0, 1, 1, 1, 2, 2, 2]);
  assert.equal(new Set(rooms.map(r => r.theme)).size, 3);
  for (let n = 0; n < 6; n++) { assert.ok(rooms[n + 3].hp > rooms[n].hp); assert.ok(rooms[n + 3].damage > rooms[n].damage); assert.ok(rooms[n + 3].total > rooms[n].total); }
  for (const c of [0, 3, 6]) assert.ok(rooms[c + 2].bossHp > rooms[c + 1].bossHp);
  for (const index of [-1, 9, 1.5]) assert.throws(() => plan(index));
});

test('Rogue: every cave has connected rooms, two routes to the exit, a treasure loop and solid outside walls', () => {
  for (let index = 0; index < 9; index++) for (const seed of [1, 42, 987]) {
    const l = layout(index, seed), start = l.rooms[0], visited = new Set([start.x + ',' + start.y]), q = [[start.x, start.y]];
    for (let n = 0; n < q.length; n++) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const x = q[n][0] + dx, y = q[n][1] + dy, key = x + ',' + y;
      if (l.floor.has(key) && !visited.has(key)) { visited.add(key); q.push([x, y]); }
    }
    assert.equal(visited.size, l.floor.size);
    for (const r of l.rooms) assert.ok(visited.has(r.x + ',' + r.y));
    assert.ok(visited.has(l.gate.x + ',' + l.gate.y));
    assert.equal(l.edges.filter(e => e.includes(4)).length, 2);
    assert.equal(l.rooms.filter(r => r.kind === 'treasure').length, 1);
    assert.equal(l.floor.has('80,80'), false);
    assert.deepEqual([...layout(index, seed).floor], [...l.floor]);
  }
});

test('Rogue: only a living human physically at an unlocked exit advances the team', () => {
  const s = { gateOpen: false, clearT: 2, gate: { x: 300, y: 200 } };
  assert.equal(canExit(s, [{ x: 300, y: 200 }]), false);
  s.gateOpen = true; assert.equal(canExit(s, [{ x: 0, y: 0 }]), false);
  assert.equal(canExit(s, [{ x: 300, y: 200, dead: true }]), false);
  assert.equal(canExit(s, [{ x: 300, y: 200 }]), true);
  s.clearT = 0; assert.equal(canExit(s, [{ x: 300, y: 200 }]), true);
});
test('Rogue: finite multiplayer hordes and deterministic, distinct temporary boon options', () => {
  for (let i = 0; i < 9; i++) {
    assert.ok(plan(i, 4, 20).total > plan(i, 1, 20).total);
    assert.ok(plan(i, 4, 20).total <= 40);
    const choices = plan(i, 1, 20).choices; assert.equal(new Set(choices).size, 3); assert.ok(choices.every(id => BOONS[id]));
    assert.deepEqual(plan(i, 1, 20), plan(i, 1, 20));
    assert.deepEqual(plan(i, 4, 20), plan(i, 2, 20));
  }
  assert.notDeepEqual(plan(0, 1, 1).choices, plan(0, 1, 2).choices);
});
