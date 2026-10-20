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
