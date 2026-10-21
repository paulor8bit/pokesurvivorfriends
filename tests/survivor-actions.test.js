const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
function setup(host = true) {
  const fighter = (uid, x) => ({ uid, x, y: 0, hp: 25, maxHp: 100, dead: false, apples: 0, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); } });
  const local = fighter('host', 0), guest = fighter('guest', 140), bot = { ...fighter('bot', 70), bot: true, slot: 1 };
  const G = { Game: { player: local }, Coop: { active: true, isHost: host, players: () => [local, guest] }, Bots: { list: () => [bot] }, FX: { dmgText() {}, ring() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/systems/survivor-actions.js'), 'utf8'), { G });
  return { G, local, guest, bot, actions: G.SurvivorActions };
}
test('Survivor apples: only one reserve, one flight per pickup and human allies are preferred to bots', () => {
  const { actions, local, guest, bot } = setup();
  assert.equal(actions.throwFor(local), false); actions.collect(local); actions.collect(local);
  assert.equal(actions.snapshot().stock.host, 1); assert.equal(actions.target(local), guest);
  assert.equal(actions.throwFor(local), true); assert.equal(actions.throwFor(local), false);
  for (let i = 0; i < 20; i++) actions.update(0.05);
  assert.equal(guest.hp, 50); assert.equal(bot.hp, 25); assert.equal(guest.apples, 0); assert.equal(local.apples, 0);
  assert.equal(actions.snapshot().flights.length, 0);
});
test('Survivor apples: no revives, no waste at full HP, no distant targets and new runs clear stock', () => {
  const { actions, local, guest, bot } = setup(); guest.hp = 100; bot.hp = 100; local.hp = 100;
  actions.collect(local); assert.equal(actions.canCollect(local), false); assert.equal(actions.throwFor(local), false);
  guest.hp = 25; guest.x = 1500; assert.equal(actions.throwFor(local), false);
  guest.x = 140; assert.equal(actions.throwFor(local), true); guest.dead = true; guest.hp = 0;
  actions.update(0.05); assert.equal(guest.hp, 0); assert.equal(actions.snapshot().flights.length, 0);
  actions.collect(local); actions.reset(); assert.equal(Object.keys(actions.snapshot().stock).length, 0); assert.equal(actions.throwFor(local), false);
});
test('Survivor apples: guests cannot grant or spend host inventory; health is delivered to the target owner', () => {
  const h = setup(); h.guest.remote = true; let healed;
  h.G.Coop.giveHeal = (uid, amount) => { healed = [uid, amount]; };
  h.actions.collect(h.local); h.actions.throwFor(h.local); for (let i = 0; i < 20; i++) h.actions.update(0.05);
  assert.deepEqual(healed, ['guest', 0.25]);
  const g = setup(false); g.actions.collect(g.local); assert.equal(g.actions.throwFor(g.local), false);
  g.actions.receive({ stock: { host: 1 }, flights: [] }); assert.equal(g.local.apples, 1);
  g.actions.receive({ stock: {}, flights: [] }); assert.equal(g.local.apples, 0);
});
