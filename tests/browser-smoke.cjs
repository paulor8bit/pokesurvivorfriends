const { chromium } = require('playwright');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const { createGameServer } = require('../server/game-server');

(async () => {
  const game = createGameServer();
  game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  const base = `http://127.0.0.1:${game.server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], contexts = [], external = [];
  async function player(invite = '/') {
    const context = await browser.newContext({ locale: 'pt-BR', viewport: { width: 1280, height: 800 } }); contexts.push(context);
    // Exercise the relay path, which must also work when WebRTC is blocked.
    await context.addInitScript(() => { window.RTCPeerConnection = function () { throw Error('Blocked for test'); }; });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/firebase|gstatic|googleapis/.test(new URL(request.url()).hostname)) external.push(request.url()); });
    await page.goto(base + invite);
    await page.waitForSelector('#boot.hidden', { state: 'attached' });
    if (await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
    await page.waitForSelector('#test-a button');
    for (let i = 0; i < 8; i++) await page.locator('#test-a button').first().click();
    await page.locator('#res-ok').click();
    return { page, context };
  }
  try {
    const host = await player();
    await host.page.waitForSelector('#scr-menu:not(.hidden)');
    await host.page.locator('[data-go=settings]').click();
    await host.page.locator('#set-tabs [data-t=acc]').click();
    await host.page.locator('#set-close').click();
    await host.page.locator('[data-legal]').last().click();
    await host.page.waitForSelector('#scr-legal:not(.hidden)');
    assert.match(await host.page.locator('#scr-legal').innerText(), /Paulinho Ricardo/);
    await host.page.locator('#legal-close').click();
    await host.page.locator('[data-go=friends]').click();
    await host.page.locator('#room-name').fill('Anfitrião'); await host.page.locator('#room-create').click();
    await host.page.waitForSelector('#scr-lobby:not(.hidden)');
    const code = await host.page.locator('#lobby-code').inputValue();
    const guest = await player('/#sala=' + code.replace(/-/g, ''));
    await guest.page.waitForSelector('#scr-friends:not(.hidden)');
    await guest.page.locator('#room-name').fill('Convidado'); await guest.page.locator('#room-join').click();
    await guest.page.waitForSelector('#scr-lobby:not(.hidden)');
    await host.page.waitForFunction(() => !document.querySelector('#lobby-start').disabled);
    await host.page.locator('#lobby-start').click();
    await host.page.waitForSelector('#topbar.hidden', { state: 'attached' });
    await guest.page.waitForSelector('#topbar.hidden', { state: 'attached' });
    await host.page.waitForTimeout(2000);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    await host.context.close();
    await guest.page.waitForSelector('#scr-over:not(.hidden)', { timeout: 15000 });
    console.log('Navegador: início sem cadastro, configurações, autoria, convite, cooperativo por relé e desconexão passaram.');
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close(); await game.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
