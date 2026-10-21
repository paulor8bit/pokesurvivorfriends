const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const { createGameServer } = require('../server/game-server');
(async () => {
  const game = createGameServer(); game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const base = 'http://127.0.0.1:' + game.server.address().port;
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const errors = [];
  async function player(hash = '', saved = true) {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(saved => {
      window.RTCPeerConnection = function () { throw Error('Test relay'); };
      if (saved) localStorage.setItem('ps.save._local', JSON.stringify({ name: 'Treinador', starter: 25, partner: 25, owned: { 1: {}, 4: {}, 7: {}, 25: {} }, coins: 200 }));
    }, saved);
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/dev.html' + hash); await page.waitForSelector('#boot.hidden', { state: 'attached' });
    if (await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
    return { page, context };
  }
  try {
    const host = await player(); const p = host.page;
    const before = await p.evaluate(() => ({ coins: G.DB.save.coins, owned: Object.keys(G.DB.save.owned).sort() }));
    await p.locator('#scr-menu [data-go=arena]').click();
    assert.ok(await p.locator('#arena-pokemon-grid button canvas').count() >= 25);
    await p.locator('#arena-pick-player').click(); await p.locator('#arena-pokemon-grid [data-dex="25"]').click();
    assert.equal(await p.locator('#arena-portrait-player canvas').getAttribute('data-dex'), '25');
    await p.locator('#arena-pick-bot').click(); await p.locator('#arena-pokemon-grid [data-dex="4"]').click();
    assert.equal(await p.locator('#arena-portrait-partner canvas').getAttribute('data-dex'), '4');
    await p.locator('#arena-pick-player').click(); await p.locator('#arena-pokemon-grid [data-dex="25"]').focus();
    await p.keyboard.press('ArrowRight'); const focusedDex = await p.evaluate(() => document.activeElement.dataset.dex); await p.keyboard.press('Enter');
    assert.equal(await p.locator('#arena-pokemon').inputValue(), focusedDex);
    fs.mkdirSync('.runtime', { recursive: true }); await p.mouse.move(2, 2); await p.locator('#arena-name').blur();
    await p.evaluate(() => { document.querySelector('.arena-setup').scrollTop = 0; });
    await p.waitForTimeout(3800); await p.screenshot({ path: '.runtime/arena-selection-arcade.png' });
    await p.setViewportSize({ width: 844, height: 390 }); await p.evaluate(() => { document.querySelector('.arena-setup').scrollTop = 0; });
    await p.screenshot({ path: '.runtime/arena-selection-mobile.png' }); await p.setViewportSize({ width: 1280, height: 800 });
    await p.evaluate(() => {
      window.__arenaAssets = { sounds: [], sprites: 0, tiles: 0, effects: 0 };
      const sfx = G.Audio.sfx; G.Audio.sfx = (...args) => { window.__arenaAssets.sounds.push(args[0]); return sfx(...args); };
      const draw = G.VFX.draw; G.VFX.draw = (...args) => { window.__arenaAssets.sprites++; return draw(...args); };
      const tiles = G.Tiles.paintChunk; G.Tiles.paintChunk = (...args) => { window.__arenaAssets.tiles++; return tiles(...args); };
      const sp = G.FX.sp; G.FX.sp = (...args) => { window.__arenaAssets.effects++; return sp(...args); };
    });
    await p.locator('#arena-start').click();
    fs.mkdirSync('.runtime', { recursive: true }); await p.screenshot({ path: '.runtime/arena-bracket.png' });
    await p.locator('#arena-next').click();
    await p.waitForFunction(() => G.ArenaUI.state?.phase === 'battle');
    assert.equal(await p.locator('[data-arena-attack]').count(), 4);
    assert.equal(await p.evaluate(() => G.ArenaUI.state.fighters.filter(f => f.team === 0 && !f.human).length), 1);
    assert.deepEqual(await p.evaluate(() => G.ArenaUI.state.fighters[0].cooldowns), [0, 0, 0, 0]);
    await p.keyboard.press('Numpad1'); await p.waitForFunction(() => G.ArenaUI.state.fighters[0].cooldowns[0] > 0);
    await p.waitForFunction(() => window.__arenaAssets.sounds.includes('shot') && window.__arenaAssets.sprites > 0 && window.__arenaAssets.tiles > 0 && window.__arenaAssets.effects > 0);
    await p.locator('[data-arena-attack="3"]').click(); await p.waitForFunction(() => G.ArenaUI.state.fighters[0].cooldowns[3] > 0);
    await p.keyboard.press('Escape'); await p.waitForSelector('#scr-settings:not(.hidden)');
    const pausedTime = await p.evaluate(() => G.ArenaUI.state.time);
    const pausedSounds = await p.evaluate(() => window.__arenaAssets.sounds.filter(s => s === 'shot').length); await p.waitForTimeout(150);
    assert.equal(await p.evaluate(() => G.ArenaUI.state.time), pausedTime);
    assert.equal(await p.evaluate(() => window.__arenaAssets.sounds.filter(s => s === 'shot').length), pausedSounds);
    await p.locator('#set-close').click();
    await p.locator('#arena-settings').click(); await p.locator('[data-arena-key="1"]').click(); await p.keyboard.press('KeyQ');
    await p.locator('#set-close').click(); await p.keyboard.press('KeyQ');
    await p.waitForFunction(() => G.ArenaUI.state.fighters[0].cooldowns[1] > 0);
    await p.evaluate(() => { const s = G.ArenaUI.state, f = s.fighters[0]; f.hp = 50; s.apples.push({ x: f.x, y: f.y, life: 8 }); });
    await p.waitForFunction(() => G.ArenaUI.state.fighters[0].hp >= 100);
    await p.waitForFunction(() => window.__arenaAssets.sounds.includes('heal'));
    await p.setViewportSize({ width: 844, height: 390 });
    for (const b of await p.locator('[data-arena-attack]').all()) { const r = await b.boundingBox(); assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 844 && r.y + r.height <= 390); }
    fs.mkdirSync('.runtime', { recursive: true }); await p.screenshot({ path: '.runtime/arena-mobile.png' });
    for (let round = 0; round < 3; round++) {
      await p.evaluate(() => { for (const f of G.ArenaUI.state.fighters) if (f.team !== 0) f.hp = 0; });
      await p.waitForFunction(() => G.ArenaUI.state.phase !== 'battle');
      if (round < 2) await p.locator('#arena-next').click();
    }
    assert.equal(await p.evaluate(() => G.ArenaUI.state.phase), 'champion'); await p.locator('#arena-exit').click();
    assert.equal(await p.evaluate(() => G.DB.save.coins), before.coins);
    assert.deepEqual(await p.evaluate(() => Object.keys(G.DB.save.owned).sort()), before.owned);
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.locator('#scr-menu [data-go=arena]').click(); await p.locator('#arena-partner').selectOption('friend');
    // Local tests use the room code rather than publishing a tunnel.
    await p.locator('#arena-create').click(); await p.waitForFunction(() => G.Social.room?.mode === 'arena');
    const id = await p.evaluate(() => G.Social.room.id);
    const friend = await player('#arena=' + id, false);
    await friend.page.locator('#arena-name').fill('Parceiro'); await friend.page.locator('#arena-join').click();
    await p.waitForFunction(() => G.Social.room.members.length === 2);
    await friend.page.evaluate(() => { window.__arenaSounds = []; const sfx = G.Audio.sfx; G.Audio.sfx = (...args) => { window.__arenaSounds.push(args[0]); return sfx(...args); }; });
    await p.locator('#arena-start').click(); await p.locator('#arena-next').click();
    await friend.page.waitForFunction(() => G.ArenaUI.state?.phase === 'battle');
    await friend.page.keyboard.press('Numpad1');
    await p.waitForFunction(() => G.ArenaUI.state.fighters[1].cooldowns[0] > 0);
    await friend.page.waitForFunction(() => window.__arenaSounds.includes('shot'));
    await p.waitForFunction(() => G.ArenaUI.state.fighters[1].human === true);
    await friend.context.close(); await p.waitForFunction(() => G.ArenaUI.state.fighters[1].human === false);
    await p.screenshot({ path: '.runtime/arena-desktop.png' });
    await p.locator('#arena-exit').click(); await p.waitForFunction(() => G.Social.room === null);
    await p.reload(); await p.waitForSelector('#boot.hidden', { state: 'attached' });
    if (await p.locator('#tap-start').isVisible()) await p.locator('#tap-start').click();
    await p.waitForSelector('#scr-menu:not(.hidden)');
    assert.deepEqual(await p.evaluate(() => G.Settings.get('arenaKeys')), ['Numpad1', 'KeyQ', 'Numpad3', 'Numpad4']);
    assert.deepEqual(errors, []);
    console.log('Arena: bot, quatro ataques manuais, Num 1–4, remapeamento persistente, cura, chaves completas, celular, amigo por relé, troca por bot e encerramento passaram.');
  } finally { await browser.close(); await game.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
