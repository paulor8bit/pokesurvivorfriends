const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/core/db.js'), 'utf8');

async function open(data = new Map(), blocked = false) {
  const context = vm.createContext({ G: {}, Date, Math, console, addEventListener() {},
    localStorage: {
      getItem: key => data.get(key) ?? null,
      setItem(key, value) { if (blocked) throw Error('Storage unavailable'); data.set(key, value); },
    },
  });
  vm.runInContext(source, context);
  await context.G.DB.ready();
  return context.G.DB;
}

test('local progress survives reload without registering an account', async () => {
  const data = new Map();
  const first = await open(data);
  first.setName('Jogador local');
  first.grant(25, 'starter'); first.save.partner = 25;
  first.grantShiny(133, 'wild'); first.save.coins = 743;
  first.save.stats.runs = 9; first.save.bots.slots = 2;
  assert.equal(first.commit(), true);
  const second = await open(data);
  assert.equal(second.user, 'Jogador local');
  assert.equal(second.save.partner, 25);
  assert.equal(second.ownsShiny(133), true);
  assert.equal(second.save.coins, 743);
  assert.equal(second.save.stats.runs, 9);
  assert.equal(second.save.bots.slots, 2);
  assert.equal(data.has('ps.accounts'), false);
});

test('a previous selected local profile is preserved when moving to the account-free save', async () => {
  const data = new Map();
  const previous = await open(data);
  previous.grant(7, 'starter'); previous.save.partner = 7; previous.save.coins = 1200; previous.commit();
  const original = data.get('ps.save._local');
  data.set('ps.save.previous', original); data.delete('ps.save._local');
  data.set('ps.session', JSON.stringify('previous'));
  const migrated = await open(data);
  assert.equal(migrated.save.partner, 7);
  assert.equal(migrated.save.coins, 1200);
  assert.equal(data.get('ps.save.previous'), original);
  assert.equal(JSON.parse(data.get('ps.session')), '_local');
});

test('storage failures are reported without preventing a solo game', async () => {
  const db = await open(new Map(), true);
  assert.ok(db.save);
  assert.equal(db.storageOk, false);
  assert.equal(db.commit(), false);
  assert.equal((await db.saveNow()).ok, false);
});

test('legacy teams gain training fields without losing recruited partners; malformed training is repaired', async () => {
  const data = new Map(), first = await open(data);
  first.grant(4, 'starter'); first.grant(7, 'gacha');
  first.save.bots = { slots: 2, party: [4, 7] };
  first.commit();
  const second = await open(data);
  assert.deepEqual(Array.from(second.save.bots.party), [4, 7, null]);
  assert.equal(second.save.bots.slots, 2);
  second.save.bots.training[4] = { xp: -30, learned: 'invalid', loadout: ['ember', 'ember'] };
  second.commit();
  const repaired = await open(data);
  assert.equal(repaired.save.bots.training[4].xp, 0);
  assert.equal(repaired.save.bots.training[4].learned.length, 0);
  assert.deepEqual(Array.from(repaired.save.bots.training[4].loadout), ['ember', null]);
});

test('merging a previous local copy preserves affinity and learned moves without duplicating experience', async () => {
  const db = await open();
  db.grant(4, 'starter');
  const older = JSON.parse(JSON.stringify(db.save)), newer = JSON.parse(JSON.stringify(db.save));
  older.updated = 1; newer.updated = 2;
  older.bots = { slots: 2, party: [4], training: { 4: { xp: 1000, learned: ['ember', 'flamethrower'], loadout: ['ember', 'flamethrower'] } } };
  newer.bots = { slots: 1, party: [4], training: { 4: { xp: 500, learned: ['ember', 'heat-wave'], loadout: ['heat-wave', 'ember'] } } };
  const merged = db.merge(older, newer), twice = db.merge(merged, older);
  assert.equal(merged.bots.slots, 2);
  assert.equal(twice.bots.training[4].xp, 1000);
  assert.deepEqual(new Set(twice.bots.training[4].learned), new Set(['ember', 'flamethrower', 'heat-wave']));
  assert.equal(twice.bots.training[4].loadout[0], 'heat-wave');
});
