const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createGameServer } = require('../server/game-server');
(async () => {
  const game = createGameServer(); game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const base = 'http://127.0.0.1:' + game.server.address().port;
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const errors = [];
  async function client(hash = '', save) {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(save => {
      window.RTCPeerConnection = function () { throw Error('Test relay'); };
      if (save) localStorage.setItem('ps.save._local', JSON.stringify(save));
    }, save);
    const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/dev.html' + hash); await page.waitForSelector('#boot.hidden', { state: 'attached' });
    if (await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
    return { page, context };
  }
  async function protect(page) { await page.evaluate(() => { G.Game.player.invuln = 999; }); }
  async function hp(page, fraction) { return page.evaluate(f => { const p = G.Game.player; p.hp = p.maxHp * f; return { hp: p.hp, max: p.maxHp }; }, fraction); }
  async function pickup(host, target) {
    const pos = await target.evaluate(() => ({ x: G.Game.player.x, y: G.Game.player.y }));
    await host.evaluate(({ x, y }) => G.Pickups.drop('heal', x, y), pos);
  }
  try {
    const host = await client('', { name: 'Host', starter: 25, partner: 25, owned: { 25: {}, 4: {}, 7: {} }, bots: { slots: 2, party: [4, 7] } });
    const p = host.page; await p.locator('#scr-menu [data-go=play]').click();
    await p.waitForFunction(() => G.Social.room?.id); const code = await p.evaluate(() => G.Social.room.id);
    const guests = [];
    for (const name of ['Amigo A', 'Amigo B']) {
      const g = await client('#sala=' + code); guests.push(g);
      await g.page.locator('#room-name').fill(name); await g.page.locator('#room-join').click();
      await g.page.locator('#room-pokemon-grid [data-dex="4"]').first().click(); await g.page.locator('#room-pokemon-ok').click();
      await g.page.waitForSelector('#scr-lobby:not(.hidden)');
    }
    await p.locator('#lobby-start').click();
    const pages = [p, ...guests.map(g => g.page)];
    for (const page of pages) { await page.waitForFunction(() => G.Game.state === 'playing'); await protect(page); assert.equal(await page.evaluate(() => G.Game.player.apples), 0); }
    assert.equal(await p.evaluate(() => G.Bots.list().length), 1);
    // Exercise actual Player update with collision substeps against a narrow wall.
    await p.evaluate(() => {
      const p = G.Game.player, collide = G.World.collide, start = p.x; let maximum = 0, previous = p.x;
      G.World.collide = q => { maximum = Math.max(maximum, Math.abs(q.x - previous)); q.x = Math.min(q.x, start + 20); previous = q.x; };
      try { p.dash(1, 0); for (let n = 0; n < 8; n++) p.update(1 / 30); if (p.x > start + 20.01 || maximum > 8.01) throw Error('Dash crossed wall'); }
      finally { G.World.collide = collide; p.dashCooldown = 0; p.dashLeft = 0; p.x = start; collide(p); }
    });
    await p.keyboard.down('ArrowRight'); await p.keyboard.press('Space'); await p.keyboard.up('ArrowRight');
    await p.waitForFunction(() => G.Game.player.dashCooldown > 0);
    await guests[0].page.waitForFunction(() => G.Coop.puppets().find(p => p.uid === G.Social.room.host).dashCooldown > 0);
    await guests[0].page.keyboard.press('Space');
    await p.waitForFunction(() => G.Coop.puppets().some(p => p.dashCooldown > 0));
    await p.evaluate(() => G.Game.togglePause());
    assert.equal(await p.locator('#survivor-actions').isVisible(), false);
    await p.locator('#btn-resume').click();
    const origin = await p.evaluate(() => ({ x: G.Game.player.x, y: G.Game.player.y }));
    for (let i = 0; i < pages.length; i++) await pages[i].evaluate(({ origin, i }) => { const p = G.Game.player; p.dashLeft = 0; p.x = origin.x + i * 140; p.y = origin.y; G.World.collide(p); }, { origin, i });
    const a = await hp(guests[0].page, 0.25), b = await hp(guests[1].page, 0.25);
    await hp(p, 0.25); await pickup(p, p);
    await p.waitForFunction(() => G.Game.player.apples === 1 && G.Game.player.hp >= G.Game.player.maxHp * 0.5);
    await p.waitForFunction(() => G.SurvivorActions.target(G.Game.player)?.tag === 'Amigo A');
    await p.locator('#survivor-apple').click();
    await guests[0].page.waitForFunction(({ hp, max }) => G.Game.player.hp >= hp + max * 0.25 - 0.01, a);
    assert.equal(await guests[0].page.evaluate(() => G.Game.player.apples), 0);
    assert.equal(await guests[1].page.evaluate(() => G.Game.player.hp), b.hp);
    await pickup(p, guests[0].page); await guests[0].page.waitForFunction(() => G.Game.player.apples === 1);
    // Only the host is injured now, so the guest's apple targets the host.
    await hp(guests[1].page, 1); await hp(p, 0.25);
    await guests[0].page.waitForFunction(() => G.SurvivorActions.target(G.Game.player)?.uid === G.Social.room.host);
    await guests[0].page.keyboard.press('KeyE');
    await p.waitForFunction(() => G.Game.player.hp >= G.Game.player.maxHp * 0.5);
    await guests[0].page.waitForFunction(() => G.Game.player.apples === 0);
    assert.equal(await p.evaluate(() => G.Game.player.apples), 0);
    // A bot is a valid fallback ally; healing it creates no new inventory.
    await pickup(p, p); await p.waitForFunction(() => G.Game.player.apples === 1);
    for (const page of pages) await hp(page, 1);
    await p.waitForFunction(() => G.Coop.puppets().every(p => p.hp === p.maxHp));
    await p.evaluate(() => { const bot = G.Bots.list()[0]; bot.hp = bot.maxHp / 4; });
    await p.waitForFunction(() => G.SurvivorActions.target(G.Game.player)?.bot === true);
    await p.locator('#survivor-apple').click();
    await p.waitForFunction(() => G.Bots.list()[0].hp >= G.Bots.list()[0].maxHp / 2);
    assert.equal(await p.evaluate(() => G.Bots.list()[0].apples), 0);
    await p.setViewportSize({ width: 844, height: 390 });
    for (const button of await p.locator('#survivor-actions button').all()) { const r = await button.boundingBox(); assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 844 && r.y + r.height <= 390); }
    await p.screenshot({ path: '.runtime/survivor-actions-mobile.png' });
    await p.evaluate(() => G.Game.quit());
    await p.waitForFunction(() => G.Game.state === 'over');
    await p.waitForSelector('#survivor-actions.hidden', { state: 'attached' });
    assert.deepEqual(errors, []);
    console.log('Survivor: dash com colisões e sincronização, maçã inicial vazia, coleta/cura, arremesso nos dois sentidos, alvo correto entre 3 humanos, alimentação do bot e botões no celular passaram.');
  } finally { await browser.close(); await game.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
