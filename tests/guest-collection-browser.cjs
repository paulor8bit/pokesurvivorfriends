const { chromium } = require('playwright');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createGameServer } = require('../server/game-server');

(async () => {
  const servers = [createGameServer(), createGameServer()];
  for (const s of servers) { s.server.listen(0, '127.0.0.1'); await once(s.server, 'listening'); }
  const [hostBase, appBase] = servers.map(s => `http://127.0.0.1:${s.server.address().port}`);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  async function player(base, save, hash = '') {
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
    const host = await player(hostBase, { name: 'Host', coins: 1000, partner: 4, starter: 4,
      owned: { 4: {}, 150: {} }, shiny: { 150: {} }, pupg: { 150: { hp: 10, atk: 10 } } });
    await host.page.locator('#scr-menu [data-go=play]').click();
    await host.page.waitForSelector('#scr-lobby:not(.hidden)');
    const code = (await host.page.locator('#lobby-code').inputValue()).replace(/-/g, '');
    const invite = hostBase + '/#sala=' + code;

    const guest = await player(hostBase, null, '#sala=' + code);
    await guest.page.waitForSelector('#scr-friends:not(.hidden)');
    assert.equal(await guest.page.evaluate(() => G.DB.save.partner), null);
    await guest.page.locator('#room-name').fill('Navegador'); await guest.page.locator('#room-join').click();
    await guest.page.locator('#room-pokemon-grid [data-dex="150"][data-shiny="false"]').waitFor();
    assert.equal(await guest.page.locator('#room-pokemon-grid [data-dex="4"]').count(), 1);
    await guest.page.locator('#room-pokemon-local').click();
    assert.equal(await guest.page.locator('#room-pokemon-grid [data-dex="150"]').count(), 0);
    await guest.page.locator('#room-pokemon-host').click();
    await guest.page.locator('#room-pokemon-grid [data-dex="150"][data-shiny="false"]').click();
    fs.mkdirSync('.runtime', { recursive: true });
    await guest.page.screenshot({ path: '.runtime/guest-host-collection.png', animations: 'disabled' });
    await guest.page.locator('#room-pokemon-ok').click();
    await guest.page.waitForSelector('#scr-lobby:not(.hidden)');
    assert.equal(await guest.page.evaluate(() => G.DB.owns(150)), false);
    assert.equal(await guest.page.locator('#lobby-menu').isVisible(), false);

    const app = await player(appBase, { name: 'Instalado', coins: 777, partner: 4, starter: 4,
      owned: { 4: {}, 133: {} }, shiny: { 133: {} }, pupg: { 133: { hp: 3, atk: 4, spd: 2, start: 1, moves: 1, ban: 1 } },
      pstart: { 133: 'quick-attack' }, pban: { 133: ['hyper-voice'] }, pbind: { 133: ['quick-attack'] } });
    await app.page.locator('#scr-menu [data-go=play]').click();
    await app.page.locator('#lobby-join-link').fill(invite);
    await app.page.locator('#lobby-join-form button').click();
    await app.page.locator('#room-name').fill('Instalado'); await app.page.locator('#room-code').fill(invite);
    await app.page.locator('#room-join').click();
    await app.page.locator('#room-pokemon-grid [data-dex="133"][data-shiny="true"]').click();
    assert.match(await app.page.locator('#room-pokemon-stats').innerText(), /1.16/);
    await app.page.screenshot({ path: '.runtime/guest-own-collection.png', animations: 'disabled' });
    await app.page.locator('#room-pokemon-ok').click();
    await app.page.waitForSelector('#scr-lobby:not(.hidden)');
    assert.equal(new URL(app.page.url()).origin, appBase, 'installed client navigated away from its saved origin');
    await host.page.waitForFunction(() => !document.querySelector('#lobby-start').disabled);
    await host.page.locator('#lobby-start').click();
    await app.page.waitForFunction(() => G.Game.state === 'playing');
    await guest.page.waitForFunction(() => G.Game.state === 'playing');
    const own = await app.page.evaluate(() => {
      const p = G.Game.player;
      return { dex: p.dex, hp: p.maxHp, baseHp: p.mon.hp, attack: p.atkMul, speed: p.spdMul,
        moves: p.moves.map(m => m.id), shiny: p.shiny, bans: [...p.banned], partner: G.DB.save.partner, ownsBorrowed: G.DB.owns(150) };
    });
    assert.equal(own.dex, 133); assert.equal(own.hp, own.baseHp + 24); assert.equal(own.attack, 1.16);
    assert.equal(own.speed, 1.06); assert.equal(own.shiny, true); assert.equal(own.moves.length, 2);
    assert.ok(own.moves.includes('quick-attack')); assert.deepEqual(own.bans, ['hyper-voice']);
    assert.equal(own.partner, 4); assert.equal(own.ownsBorrowed, false);
    const borrowed = await guest.page.evaluate(() => ({ dex: G.Game.player.dex, hp: G.Game.player.maxHp,
      baseHp: G.Game.player.mon.hp, atk: G.Game.player.atkMul, owned: G.DB.owns(150), partner: G.DB.save.partner }));
    assert.equal(borrowed.dex, 150); assert.equal(borrowed.hp, borrowed.baseHp); assert.equal(borrowed.atk, 1);
    assert.equal(borrowed.owned, false); assert.equal(borrowed.partner, null);
    for (const [i, client] of [host, guest, app].entries()) await client.page.evaluate(index => {
      window.__healthLabels = new Set();
      const drawText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        if (/^HP \d+ \/ \d+$/.test(text)) window.__healthLabels.add(text);
        return drawText.call(this, text, ...args);
      };
      G.Game.player.invuln = 999;
      G.Game.player.x = (index - 1) * 100; G.Game.player.y = 0;
    }, i);
    const lowHp = await app.page.evaluate(() => {
      const p = G.Game.player; p.hp = Math.ceil(p.maxHp / 4);
      return { hp: p.hp, max: p.maxHp, uid: p.uid };
    });
    await host.page.waitForFunction(({ uid, hp }) => G.Coop.puppets().some(p => p.uid === uid && p.hp === hp), lowHp);
    for (const client of [host, guest, app]) await client.page.waitForFunction(
      ({ hp, max }) => window.__healthLabels.has(`HP ${hp} / ${max}`), lowHp);
    await guest.page.screenshot({ path: '.runtime/coop-hp-guest.png', animations: 'disabled' });
    await host.page.screenshot({ path: '.runtime/coop-hp-host.png', animations: 'disabled' });
    for (const client of [host, guest, app]) await client.page.evaluate(() => window.__healthLabels.clear());
    await app.page.evaluate(() => { G.Game.player.hp = G.Game.player.maxHp; });
    for (const client of [host, guest]) await client.page.waitForFunction(({ uid, max }) =>
      G.Coop.puppets().some(p => p.uid === uid && p.hp === max) && window.__healthLabels.has(`HP ${max} / ${max}`), lowHp);
    await app.page.waitForTimeout(1800); assert.deepEqual(errors, []);
    await host.context.close();
    await guest.page.waitForSelector('#scr-over:not(.hidden)', { timeout: 15000 });
    await guest.page.evaluate(() => G.Flow.afterRun());
    await guest.page.waitForSelector('#scr-starters:not(.hidden)');
    assert.equal(await app.page.evaluate(() => G.DB.save.pupg[133].hp), 3);
    assert.deepEqual(errors, []);
    console.log('Convidados: coleções, melhorias, HP acima dos Pokémon com dano e cura sincronizados, salvamentos separados e encerramento passaram.');
  } finally { await browser.close(); for (const s of servers) await s.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
