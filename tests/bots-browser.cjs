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
  try {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      if (!localStorage.getItem('ps.save._local')) localStorage.setItem('ps.save._local', JSON.stringify({
        name: 'Treinador', coins: 3000, partner: 4, starter: 4,
        owned: { 1: { from: 'starter' }, 4: { from: 'starter' }, 7: { from: 'starter' } },
      }));
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    // Development entry exposes the game namespace for controlled simulation; production remains private.
    await page.goto(base + '/dev.html');
    await page.waitForSelector('#boot.hidden', { state: 'attached' });
    if (await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
    await page.locator('#scr-menu [data-go=bots]').click();
    for (let slot = 0; slot < 3; slot++) {
      await page.locator(`[data-unlock="${slot}"]`).click();
      await page.locator(`[data-pick="${slot}"]`).click();
      await page.locator(`#bot-grid [data-dex="${[1, 4, 7][slot]}"]`).click();
    }
    assert.equal(await page.locator('.bot-attack-slot').count(), 12);
    assert.equal(await page.locator('.bot-attack-slot:disabled').count(), 9);
    assert.match(await page.locator('#bots-body').innerText(), /Afinidade/);
    assert.match(await page.locator('.bot-attack-slot').first().innerText(), /na partida/);
    const alternate = await page.evaluate(() => G.Bots.movePool(1).find(id => !G.Bots.profile(1).loadout.includes(id)));
    const coinsBefore = await page.evaluate(() => G.DB.save.coins);
    await page.locator('[data-bot="1"][data-train-slot="0"]').click();
    await page.locator(`[data-train-move="${alternate}"]`).click();
    assert.equal(await page.evaluate(() => G.DB.save.coins), coinsBefore - 150);
    assert.equal(await page.locator('#coins').innerText(), (coinsBefore - 150).toLocaleString('es'));
    fs.mkdirSync('.runtime', { recursive: true });
    await page.screenshot({ path: '.runtime/bots-team.png', animations: 'disabled' });
    await page.locator('#scr-bots [data-back]').click();
    await page.locator('#scr-menu [data-go=play]').click();
    await page.locator('#lobby-start').click();
    await page.waitForFunction(() => G.Bots.list().length === 3);
    await page.evaluate(() => { G.Game.player.invuln = 999; });
    await page.waitForTimeout(4500);
    assert.equal(await page.evaluate(() => G.Bots.list().every(b => b.level === 1 && b.moves.length === 1)), true);
    await page.screenshot({ path: '.runtime/bots-run.png' });
    // A real pickup exercises the connection between the main player's XP and the partners.
    await page.evaluate(() => {
      let xp = 0; for (let level = 1; level < 10; level++) xp += G.Player.xpFor(level);
      G.Pickups.drop('xpBig', G.Game.player.x, G.Game.player.y, xp);
    });
    await page.waitForFunction(() => G.Bots.list().every(b => b.level === 10 && b.moves.length === 2));
    await page.evaluate(() => {
      let xp = 0; for (let level = 10; level < 30; level++) xp += G.Player.xpFor(level);
      G.Bots.gainXp(xp);
      for (let i = 0; i < 120; i++) G.Bots.update(1 / 60, G.Game.player, G.Game.st.time + i / 60);
    });
    assert.equal(await page.evaluate(() => G.Bots.list().every(b => b.level === 30 && b.moves.length === 4)), true);
    await page.evaluate(() => { G.Game.quit(); G.Flow.goMenu(); });
    await page.locator('#scr-menu [data-go=bots]').click();
    assert.equal(await page.locator('.bot-attack-slot:disabled').count(), 0);
    assert.equal(await page.evaluate(() => G.Bots.affinityOf(1).level), 30);
    await page.screenshot({ path: '.runtime/bots-trained.png', animations: 'disabled' });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.screenshot({ path: '.runtime/bots-mobile.png', animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.querySelector('#scr-bots .box').scrollWidth <= document.querySelector('#scr-bots .box').clientWidth), true);
    await page.reload();
    await page.waitForSelector('#boot.hidden', { state: 'attached' });
    if (await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
    await page.locator('#scr-menu [data-go=play]').click();
    await page.locator('#lobby-start').click();
    await page.waitForFunction(() => G.Bots.list().length === 3);
    assert.equal(await page.evaluate(() => G.Bots.list().every(b => b.level === 1 && b.moves.length === 1 && G.Bots.affinityOf(b.dex).level === 30)), true);
    assert.equal(await page.evaluate(() => G.Bots.list()[0].moves[0].id), alternate);
    assert.deepEqual(errors, []);
    console.log('Equipe: recrutamento, compra, quatro ataques, XP coletada, afinidade, reabertura e tela do celular passaram.');
  } finally { await browser.close(); await game.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
