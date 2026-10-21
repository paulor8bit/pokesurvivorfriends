const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

async function setup(data = new Map(), isFree = () => true) {
  let seed = 19;
  const math = Object.create(Math);
  math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const G = {
    DEX_BY: {
      1: { dex: 1, name: 'Bulbasaur', types: ['grass', 'poison'], hp: 100, spd: 100, atk: 20 },
      4: { dex: 4, name: 'Charmander', types: ['fire'], hp: 100, spd: 100, atk: 20 },
      7: { dex: 7, name: 'Squirtle', types: ['water'], hp: 100, spd: 100, atk: 20 },
    },
    T: text => text, Game: { st: { time: 0 } }, FX: { dmgText() {} },
    Sprites: { hasShiny: () => false, playerScale: () => 1, playerRadius: () => 12, bodyHeight: () => 25,
      Animator: class { loop() {} update() {} }, preload() {}, dirFromAngle: () => 0 },
    Weather: { speedFor: () => 1 }, World: { TS: 32, isFree, collide() {}, walkable: (x, y) => isFree((x + 0.5) * 32, (y + 0.5) * 32, 12) },
    EnemyMgr: { all: () => [] }, Combat: { tick() {} },
  };
  const context = vm.createContext({ G, console, Math: math, addEventListener() {}, localStorage: {
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value),
  } });
  for (const file of ['data/moves.js', 'data/starters.js', 'entities/player.js', 'core/db.js', 'systems/bots.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context, { filename: file });
  }
  await G.DB.ready();
  const pl = new G.Player(G.DEX_BY[4]);
  return { G, data, pl, begin() { G.Bots.begin(pl); }, advance(n) { for (let i = 0; i < n * 60; i++) G.Bots.update(1 / 60, pl, i / 60); } };
}
function recruit(h, dexes = [1, 4, 7]) {
  for (const d of dexes) h.G.DB.grant(d, 'starter');
  h.G.DB.save.bots = { slots: dexes.length, party: dexes }; // legacy save without training
  h.G.DB.commit(); h.begin();
}
const xpBetween = (G, from, to) => { let xp = 0; for (let level = from; level < to; level++) xp += G.Player.xpFor(level); return xp; };

test('four actual moves activate at exactly levels 1, 10, 20 and 30; affinity persists but run level resets', async () => {
  const h = await setup(), { G } = h; recruit(h);
  let level = 1;
  for (const [next, count] of [[1, 1], [9, 1], [10, 2], [19, 2], [20, 3], [29, 3], [30, 4], [45, 4]]) {
    G.Bots.gainXp(xpBetween(G, level, next)); level = next;
    for (const bot of G.Bots.list()) {
      assert.equal(bot.level, next); assert.equal(bot.moves.length, count);
      assert.equal(new Set(bot.moves.map(m => m.id)).size, count);
      assert.ok(bot.moves.every(m => m.kind !== 'buff'));
      assert.equal(G.Bots.affinityOf(bot.dex).level, next);
    }
  }
  const reopened = await setup(h.data); reopened.begin();
  for (const bot of reopened.G.Bots.list()) {
    assert.equal(bot.level, 1); assert.equal(bot.moves.length, 1);
    assert.equal(reopened.G.Bots.affinityOf(bot.dex).level, 45);
    assert.equal(reopened.G.Bots.profile(bot.dex).learned.length, 4);
  }
  reopened.G.Bots.gainXp(xpBetween(G, 1, 10));
  assert.equal(reopened.G.Bots.list()[0].level, 10);
  assert.ok(reopened.G.Bots.affinityOf(1).level >= 45);
});

test('training charges once, validates affinity and compatibility, and preserves purchases after reload', async () => {
  const h = await setup(), { G } = h; recruit(h, [4]);
  const p = G.Bots.profile(4), alternate = G.Bots.movePool(4).find(id => !p.loadout.includes(id));
  const before = G.DB.save.coins;
  assert.equal(G.Bots.train(4, 1, alternate).ok, false);
  assert.equal(G.Bots.train(4, 0, 'water-gun').ok, false);
  assert.equal(G.Bots.train(4, 4, alternate).ok, false);
  assert.equal(G.DB.save.coins, before);
  assert.equal(G.Bots.train(4, 0, alternate).ok, true);
  assert.equal(G.DB.save.coins, before - G.Bots.TRAIN_COST);
  assert.equal(G.Bots.train(4, 0, alternate).cost, 0);
  const reopened = await setup(h.data); reopened.begin();
  assert.equal(reopened.G.Bots.list()[0].moves[0].id, alternate);
  assert.equal(reopened.G.DB.save.coins, before - G.Bots.TRAIN_COST);
  reopened.G.DB.save.coins = 0;
  const other = G.Bots.movePool(4).find(id => !p.loadout.includes(id) && !p.learned.includes(id));
  assert.equal(reopened.G.Bots.train(4, 0, other).ok, false);
  assert.equal(reopened.G.Bots.profile(4).loadout[0], alternate);
});

test('multiple partners explore independently, remain close and separate when placed on top of one another', async () => {
  const h = await setup(); recruit(h);
  const initial = h.G.Bots.list().map(b => ({ x: b.x, y: b.y }));
  h.advance(10);
  h.G.Bots.list().forEach((b, i) => {
    assert.ok(Math.hypot(b.x - initial[i].x, b.y - initial[i].y) > 15);
    assert.ok(Math.hypot(b.x, b.y) > 75 && Math.hypot(b.x, b.y) < 310);
  });
  for (const b of h.G.Bots.list()) { b.x = 0; b.y = 0; b.ai.timer = 0; }
  h.advance(5);
  const party = h.G.Bots.list();
  for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
    assert.ok(Math.hypot(party[i].x - party[j].x, party[i].y - party[j].y) > 45);
  }
  h.pl.x = 1800; h.pl.y = 600;
  h.advance(1);
  assert.ok(party.every(b => Math.hypot(b.x - h.pl.x, b.y - h.pl.y) < 310));
});

test('partners navigate a wall and never step inside it while returning to the player', async () => {
  const wall = (x, y, r = 12) => !(x + r > 30 && x - r < 70 && Math.abs(y) < 115 + r);
  const h = await setup(undefined, wall); recruit(h, [4]);
  const bot = h.G.Bots.list()[0]; bot.x = 170; bot.y = 0; h.pl.x = -230;
  for (let i = 0; i < 20 * 60; i++) {
    h.G.Bots.update(1 / 60, h.pl, i / 60);
    assert.ok(wall(bot.x, bot.y, bot.r), 'bot entered the wall');
  }
  assert.ok(bot.x < 20, 'bot did not get around the wall');
  assert.ok(Math.hypot(bot.x - h.pl.x, bot.y) < 310);
});

test('locked and duplicate party assignments are rejected without changing the saved team', async () => {
  const h = await setup(); recruit(h, [4]);
  assert.equal(h.G.Bots.assign(1, 4).ok, false);
  h.G.DB.save.bots.slots = 2;
  assert.equal(h.G.Bots.assign(1, 4).ok, false);
  assert.equal(h.G.Bots.assign(0, 99999).ok, false);
  assert.equal(h.G.DB.save.bots.party[0], 4);
});
