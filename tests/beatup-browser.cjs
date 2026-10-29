const { chromium } = require('playwright'), { once } = require('node:events'), assert = require('node:assert/strict');
const { createGameServer } = require('../server/game-server');
(async () => {
  const game = createGameServer(); game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const base = 'http://127.0.0.1:' + game.server.address().port, browser = await chromium.launch({ channel: 'msedge', headless: true }), errors = [];
  async function client(hash = '', dex = 25) {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.addInitScript(dex => { window.RTCPeerConnection = function () { throw Error('Relay test'); }; localStorage.setItem('ps.save._local', JSON.stringify({ name: 'Treinador', starter: dex, partner: dex, owned: { 1: {}, 4: {}, 7: {}, 25: {} }, coins: 300 })); }, dex);
    const p = await context.newPage(); p.setDefaultTimeout(20000); p.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await p.goto(base + '/dev.html' + hash); await p.waitForSelector('#boot.hidden', { state: 'attached' }); if (await p.locator('#tap-start').isVisible()) await p.locator('#tap-start').click();
    await p.evaluate(() => { window.__sounds = []; const sfx = G.Audio.sfx; G.Audio.sfx = (...args) => { window.__sounds.push(args[0]); return sfx(...args); }; window.__protect = setInterval(() => { if (window.__safe && G.BeatupUI.state) for (const f of G.BeatupUI.state.fighters) if (f.team === 0) f.hurtGrace = 999; }, 50); });
    return { p, context };
  }
  async function move(p, x) { await p.evaluate(x => { for (const f of G.BeatupUI.state.fighters) if (f.team === 0) { f.x = x; f.dashLeft = 0; } }, x); }
  async function clear(p, wave) { await p.evaluate(() => { for (const f of G.BeatupUI.state.fighters) if (f.team !== 0) f.hp = 0; }); await p.waitForFunction(w => G.BeatupUI.state.wave === w + 1 && !G.BeatupUI.state.fighting, wave); }
  async function group(p, wave) { await move(p, [680, 1640, 2640][wave] - 170); await p.waitForFunction(w => G.BeatupUI.state.wave === w && G.BeatupUI.state.fighting, wave); }
  try {
    const host = await client(), p = host.p, initialCoins = await p.evaluate(() => G.DB.save.coins);
    assert.equal(await p.locator('#scr-menu [data-go=beatup]').count(), 1);
    await p.locator('#scr-menu [data-go=beatup]').click(); await p.waitForSelector('#scr-beatup:not(.hidden)');
    assert.equal(await p.evaluate(() => G.ArenaUI.active), false); assert.equal(await p.locator('#scr-arena').isVisible(), false);
    await p.screenshot({ path: '.runtime/beatup-selection.png' }); await p.locator('#beatup-start').click(); await p.locator('#beatup-next').click();
    await p.evaluate(() => { window.__safe = true; }); await p.waitForFunction(() => G.BeatupUI.state.phase === 'battle');
    assert.equal(await p.locator('#beatup-attacks button').count(), 6);
    await p.keyboard.down('ArrowRight'); await p.waitForFunction(() => G.BeatupUI.state.fighting); await p.keyboard.up('ArrowRight');
    await p.waitForFunction(() => G.BeatupUI.state.camera > 0);
    await p.evaluate(() => { const s = G.BeatupUI.state, f = s.fighters[0], enemies = s.fighters.filter(f => f.team !== 0); f.x = 600; f.y = 350; f.cooldowns.fill(0); for (const e of enemies) { e.human = true; e.x = 900; e.y = 500; } enemies[0].x = 660; enemies[0].y = 350; enemies[0].hurtGrace = 0; });
    await p.keyboard.press('Numpad1'); await p.waitForFunction(() => G.BeatupUI.state.score > 0); await p.waitForTimeout(350); await p.keyboard.press('Numpad1'); await p.waitForFunction(() => G.BeatupUI.state.bestCombo >= 2);
    await p.keyboard.press('Space'); await p.waitForFunction(() => G.BeatupUI.state.fighters[0].dashCooldown > 0);
    await p.setViewportSize({ width: 844, height: 390 });
    for (const button of await p.locator('#beatup-attacks button').all()) { const r = await button.boundingBox(); assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= 844 && r.y + r.height <= 390); }
    await p.screenshot({ path: '.runtime/beatup-mobile.png' }); await p.setViewportSize({ width: 1280, height: 800 });
    for (let stage = 0; stage < 3; stage++) {
      for (let wave = 0; wave < 3; wave++) {
        if (!(stage === 0 && wave === 0)) await group(p, wave);
        if (wave === 2) { assert.equal(await p.evaluate(() => G.BeatupUI.state.fighters.filter(f => f.team !== 0 && f.hp > 0).length), 1); await p.screenshot({ path: '.runtime/beatup-boss.png' }); }
        await clear(p, wave); assert.equal(await p.evaluate(() => G.BeatupUI.state.phase), 'battle');
      }
      await move(p, 3240); await p.waitForFunction(() => G.BeatupUI.state.phase !== 'battle');
      if (stage < 2) await p.locator('#beatup-next').click();
    }
    assert.equal(await p.evaluate(() => G.BeatupUI.state.phase), 'champion'); assert.match(await p.locator('#beatup-bracket').innerText(), /Ruas libertadas/);
    assert.ok((await p.evaluate(() => window.__sounds)).includes('shot')); await p.locator('#beatup-exit').click();
    await p.locator('#scr-menu [data-go=beatup]').click(); await p.locator('#beatup-partner').selectOption('friend'); await p.locator('#beatup-create').click();
    await p.waitForFunction(() => G.Social.room?.mode === 'beatup'); const id = await p.evaluate(() => G.Social.room.id);
    const friend = await client('#beatup=' + id, 4), q = friend.p;
    await q.locator('#beatup-join').click(); await p.waitForFunction(() => G.Social.room.members.length === 2 && !document.querySelector('#beatup-start').disabled);
    await p.locator('#beatup-start').click(); await p.locator('#beatup-next').click(); await q.waitForFunction(() => G.BeatupUI.state?.phase === 'battle');
    assert.equal(await q.evaluate(() => G.BeatupUI.state.mode), 'beatup'); assert.equal(await q.evaluate(() => G.ArenaUI.active), false);
    const y = await p.evaluate(() => G.BeatupUI.state.fighters[1].y); await q.keyboard.down('ArrowDown'); await p.waitForFunction(y => G.BeatupUI.state.fighters[1].y > y + 10, y); await q.keyboard.up('ArrowDown');
    await group(p, 0); await q.waitForFunction(() => G.BeatupUI.state.fighting);
    await p.evaluate(() => { const s = G.BeatupUI.state, [a, b] = s.fighters; a.x = 550; a.y = 350; a.hp = 50; b.x = 700; b.y = 350; b.hp = 50; s.apples.push({ x: b.x, y: b.y, life: 10 }); for (const e of s.fighters.filter(f => f.team !== 0)) { e.human = true; e.x = 900; e.y = 550; } });
    await q.waitForFunction(() => G.BeatupUI.state.fighters[1].apples === 1); await q.keyboard.press('KeyE'); await p.waitForFunction(() => G.BeatupUI.state.fighters[0].hp === 100);
    await clear(p, 0); await group(p, 1); await clear(p, 1); await group(p, 2);
    await q.waitForFunction(() => G.BeatupUI.state.fighters.some(f => f.rank === 'boss' && f.hp > 0));
    await p.screenshot({ path: '.runtime/beatup-coop.png' }); await friend.context.close(); await p.waitForFunction(() => !G.BeatupUI.state.fighters[1].human);
    await clear(p, 2); await move(p, 3240); await p.waitForFunction(() => G.BeatupUI.state.phase === 'bracket'); await p.locator('#beatup-next').click();
    assert.equal(await p.evaluate(() => G.BeatupUI.state.fighters[1].human), false); await p.locator('#beatup-exit').click(); await p.waitForFunction(() => G.Social.room === null);
    await p.locator('#scr-menu [data-go=beatup]').click(); await p.locator('#beatup-partner').selectOption('bot'); await p.locator('#beatup-start').click(); await p.locator('#beatup-next').click();
    await p.evaluate(() => { window.__safe = false; for (const f of G.BeatupUI.state.fighters) if (f.team === 0) f.hp = 0; });
    await p.waitForFunction(() => G.BeatupUI.state.phase === 'eliminated'); await p.locator('#beatup-exit').click();
    await p.locator('#scr-menu [data-go=arena]').click(); await p.locator('#arena-start').click(); assert.equal(await p.locator('#scr-arena .arena-rung').count(), 7); await p.locator('#arena-exit').click();
    assert.equal(await p.evaluate(() => G.DB.save.coins), initialCoins); assert.deepEqual(errors, []);
    console.log('Beatup separado: três fases/nove grupos, câmera lateral, combos, chefes, seis controles no celular, convite/relé, maçã, bot ao desconectar, vitória, derrota e Arena preservada passaram.');
  } finally { await browser.close(); await game.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
