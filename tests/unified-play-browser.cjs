const { chromium } = require('playwright');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createGameServer } = require('../server/game-server');

(async () => {
  const game = createGameServer(); game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const base = `http://127.0.0.1:${game.server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  async function pageFor(save, hash = '') {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(saved => {
      window.RTCPeerConnection = function () { throw Error('Relay test'); };
      if (saved) localStorage.setItem('ps.save._local', JSON.stringify(saved));
    }, save);
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/dev.html' + hash);
    await page.waitForSelector('#boot.hidden', { state: 'attached' });
    if (await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
    return { page, context };
  }
  try {
    const host = await pageFor({ name: 'Host', coins: 500, partner: 25, starter: 25, owned: { 1: {}, 4: {}, 7: {}, 25: {} },
      bots: { slots: 3, party: [1, 4, 7] } });
    assert.equal(await host.page.locator('#scr-menu [data-go=friends]').count(), 0);
    await host.page.locator('#scr-menu [data-go=play]').click();
    await host.page.waitForSelector('#scr-lobby:not(.hidden)');
    assert.equal(await host.page.locator('#lobby-members .lob-card').count(), 4);
    assert.equal(await host.page.locator('#lobby-members [data-slot-mode]').count(), 3);
    await host.page.setViewportSize({ width: 844, height: 390 });
    assert.equal(await host.page.evaluate(() => document.querySelector('#scr-lobby .box').scrollWidth <= document.querySelector('#scr-lobby .box').clientWidth), true);
    await host.page.screenshot({ path: '.runtime/unified-lobby-mobile.png', animations: 'disabled' });
    await host.page.setViewportSize({ width: 1280, height: 800 });
    await host.page.locator('[data-slot-mode="2"]').selectOption('friend');
    await host.page.waitForFunction(() => G.Social.room.bots.length === 2);
    await host.page.locator('[data-slot-mode="2"]').selectOption('bot');
    await host.page.waitForFunction(() => G.Social.room.bots.length === 3);
    const code = (await host.page.locator('#lobby-code').inputValue()).replace(/-/g, '');
    const runSeed = await host.page.evaluate(() => G.Social.room.id);
    fs.mkdirSync('.runtime', { recursive: true });
    await host.page.screenshot({ path: '.runtime/unified-lobby.png', animations: 'disabled' });
    await host.page.locator('#lobby-start').click();
    await host.page.waitForFunction(() => G.Game.state === 'playing' && G.Bots.list().length === 3);
    assert.equal(await host.page.evaluate(() => G.Bots.list().every(b => b.level === 1)), true);
    const state = await host.page.evaluate(() => {
      // Keep the host alive while testing connections, including lava that resets invulnerability.
      const p = G.Game.player; p.hurt = () => {}; p.invuln = 999;
      let xp = 0; for (let l = 1; l < 10; l++) xp += G.Player.xpFor(l);
      p.gainXp(xp); G.Bots.gainXp(xp); G.Game.debugTime(480); G.Weather.debugStart('rain', 90);
      const prop = G.World.propsInCircle(p.x, p.y, 350).find(p => p.destructible);
      if (prop) G.World.breakAt(prop.tx, prop.ty);
      return { broken: prop ? [prop.tx, prop.ty] : null, runId: G.Social.room.run.id };
    });
    const guests = [];
    for (let i = 0; i < 4; i++) {
      const guest = await pageFor(null, '#sala=' + code); guests.push(guest);
      await guest.page.locator('#room-name').fill('Amigo ' + i); await guest.page.locator('#room-join').click();
      await guest.page.locator('#room-pokemon-grid [data-dex="4"]').first().click();
      await guest.page.locator('#room-pokemon-ok').click();
      if (i === 3) {
        await guest.page.waitForFunction(() => /cheia|llena/.test(document.querySelector('#room-msg').textContent));
        assert.equal(await host.page.evaluate(() => G.Social.room.members.length), 4);
        break;
      }
      await guest.page.waitForFunction(() => G.Game.state === 'playing', { timeout: 20000 });
      await guest.page.evaluate(() => { G.Game.player.hurt = () => {}; G.Game.player.invuln = 999; });
      await host.page.waitForFunction(n => G.Bots.list().length === n, 2 - i);
      await guest.page.waitForFunction(n => G.Bots.list().length === n, 2 - i);
      assert.equal(await guest.page.evaluate(() => G.Social.room.run.id), state.runId);
      assert.ok(await guest.page.evaluate(() => G.Game.st.time >= 480));
      assert.ok(await guest.page.evaluate(() => G.Game.player.level >= 10));
      if (i === 0) {
        await guest.page.waitForFunction(() => G.Weather.current?.kind === 'rain');
        assert.equal(await guest.page.evaluate(() => G.World.biome), 2);
        if (state.broken) await guest.page.waitForFunction(([x, y]) => G.World.brokenNear(G.Game.player.x, G.Game.player.y).some(p => p[0] === x && p[1] === y), state.broken);
        await guest.page.waitForFunction(() => G.EnemyMgr.all().some(e => e.remote));
        await guest.page.screenshot({ path: '.runtime/unified-live-join.png', animations: 'disabled' });
      }
      assert.equal(await host.page.evaluate(() => G.Social.room.members.length + G.Bots.list().length), 4);
      assert.equal(await host.page.evaluate(() => G.Social.room.id), runSeed);
    }
    await guests[0].context.close();
    await host.page.waitForFunction(() => G.Bots.list().length === 1 && G.Social.room.members.length === 3).catch(async e => {
      console.error(await host.page.evaluate(() => ({ state: G.Game.state, room: G.Social.room, bots: G.Bots.list().map(b => ({ slot: b.slot, level: b.level })), active: G.Coop.active })));
      throw e;
    });
    assert.equal(await host.page.evaluate(() => G.Bots.list().find(b => b.slot === 1).level >= 10), true);
    await host.page.evaluate(() => G.Rift.debugArena('fire'));
    await guests[3].page.locator('#room-pokemon-ok').click();
    await guests[3].page.waitForFunction(() => G.Game.state === 'playing');
    await guests[3].page.waitForFunction(() => G.Rift.inArena && G.Rift.arena.type === 'fire');
    assert.ok(await guests[3].page.evaluate(() => Math.hypot(G.Game.player.x - G.Rift.arena.x, G.Game.player.y - G.Rift.arena.y) < 1000));
    await host.page.waitForFunction(() => G.Bots.list().length === 0 && G.Social.room.members.length === 4);
    assert.equal(await host.page.evaluate(() => G.Social.room.run.id), state.runId);
    await guests[3].page.evaluate(() => G.LobbyUI.open());
    await guests[3].page.locator('#lobby-start').click();
    assert.equal(await guests[3].page.locator('#scr-lobby').isVisible(), false);
    await guests[1].page.evaluate(() => G.LobbyUI.open());
    await guests[1].page.locator('#lobby-leave').click();
    await host.page.waitForFunction(() => G.Social.room.members.length === 3 && G.Bots.list().length === 1);
    assert.equal(await guests[1].page.evaluate(() => G.Coop.active), false);
    await host.page.evaluate(() => { G.Judgment.debugStart(); G.Judgment.cineTick(11); });
    const replacement = await pageFor(null, '#sala=' + code);
    await replacement.page.locator('#room-name').fill('Novo amigo'); await replacement.page.locator('#room-join').click();
    await replacement.page.locator('#room-pokemon-grid [data-dex="4"]').first().click();
    await replacement.page.locator('#room-pokemon-ok').click();
    await replacement.page.waitForFunction(() => G.Game.state === 'playing' && G.Judgment.active && !G.Judgment.cinematic);
    assert.ok(await replacement.page.evaluate(() => G.Judgment.summary() !== null));
    assert.equal(await replacement.page.evaluate(() => G.Social.room.run.id), state.runId);
    assert.deepEqual(errors, []);
    console.log('Jogar: vagas configuráveis, início com 3 bots, substituição durante a partida, limite de 4 humanos, retorno do bot, saída/continuação e entrada nas arenas da Grieta e de Arceus passaram.');
  } finally { await browser.close(); await game.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
