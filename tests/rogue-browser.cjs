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
    await context.addInitScript(save => { window.RTCPeerConnection = function () { throw Error('Test relay'); }; if (save) localStorage.setItem('ps.save._local', JSON.stringify(save)); }, save);
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && m.text().includes('[Game]')) errors.push(m.text()); });
    await page.goto(base + '/dev.html' + hash); await page.waitForSelector('#boot.hidden', { state: 'attached' });
    if (await page.locator('#tap-start').isVisible()) await page.locator('#tap-start').click();
    await page.evaluate(() => {
      window.__native = { sprites: 0, effects: 0, tiles: 0, sounds: [], music: [] };
      const draw = G.Sprites.Animator.prototype.draw; G.Sprites.Animator.prototype.draw = function (...a) { window.__native.sprites++; return draw.apply(this, a); };
      const ring = G.FX.ring; G.FX.ring = (...a) => { window.__native.effects++; return ring(...a); };
      const tile = G.Tiles.paintChunk; G.Tiles.paintChunk = (...a) => { window.__native.tiles++; return tile(...a); };
      window.__riftFrames = new Set();
      const prop = G.Tiles.propSprite; G.Tiles.propSprite = (...a) => { if (a[1] === 'rift' && G.Rogue.active) window.__riftFrames.add(a[2]); return prop(...a); };
      const sfx = G.Audio.sfx; G.Audio.sfx = (...a) => { window.__native.sounds.push(a[0]); return sfx(...a); };
      const music = G.Audio.music; G.Audio.music = (...a) => { if (!window.__native.music.includes(a[0])) window.__native.music.push(a[0]); return music(...a); };
      window.__autoplay = setInterval(() => {
        if (G.Game.player) G.Game.player.invuln = 999;
        if (G.UI.isOpen('scr-levelup') && !document.querySelector('#cards').classList.contains('guard')) G.RunUI.pick(0);
        if (G.UI.isOpen('scr-item')) document.querySelector('#item-cards .card')?.click();
        if (window.__kill && G.Rogue.active) for (const e of G.EnemyMgr.all()) if (!e.remote && !e.dead) {
          if (!e.rogueRank) {
            if (window.__keepExitMinion && e.rogueSection === 4) { window.__keptMinion ??= e.id; if (e.id === window.__keptMinion) { e.hp = e.maxHp = 100000; continue; } }
            e.hp = 0; e.die();
          } else e.hp = e.maxHp;
        }
      }, 50);
    });
    return { page, context };
  }
  async function join(code, name) {
    const g = await client('#sala=' + code);
    await g.page.locator('#room-name').fill(name); await g.page.locator('#room-join').click();
    await g.page.locator('#room-pokemon-grid [data-dex="4"]').first().click(); await g.page.locator('#room-pokemon-ok').click();
    return g;
  }
  async function visit(page, id, door = false) {
    await page.evaluate(({ id, door }) => {
      const s = G.Rogue.state, arena = G.World.arena, room = G.RogueRules.layout(s.index, s.seed).rooms[id], TS = G.World.TS;
      const p = G.Game.player;
      p.x = door ? s.gate.x : (arena.tx + room.x + 0.5) * TS;
      p.y = door ? s.gate.y : (arena.ty + room.y + 0.5) * TS;
      p.dashLeft = 0; G.World.collide(p);
    }, { id, door });
  }
  try {
    const host = await client('', { name: 'Explorador', starter: 25, partner: 25, owned: { 25: {}, 1: {}, 4: {}, 7: {} }, bots: { slots: 3, party: [7, 4, 1] } }), p = host.page;
    for (const [go, text] of [['play', 'Survivor'], ['rogue', 'Rogue'], ['arena', 'Arena']]) assert.ok((await p.locator('#scr-menu [data-go=' + go + ']').innerText()).startsWith(text));
    await p.locator('#scr-menu [data-go=rogue]').click(); await p.waitForFunction(() => G.Social.room?.mode === 'rogue');
    assert.equal(await p.locator('#lobby-members .lob-card').count(), 2);
    assert.equal(await p.evaluate(() => G.Social.room.bots.length), 1);
    assert.equal(await p.evaluate(() => G.DB.save.bots.slots), 3);
    const code = await p.evaluate(() => G.Social.room.id), guest = await join(code, 'Amigo');
    await guest.page.waitForSelector('#scr-lobby:not(.hidden)'); assert.equal(await guest.page.locator('#lobby-mode').inputValue(), 'rogue');
    await p.locator('#lobby-start').click();
    for (const page of [p, guest.page]) await page.waitForFunction(() => G.Rogue.active && G.Game.state === 'playing' && G.World.arena.type === 'cave1');
    assert.equal(await p.evaluate(() => G.Game.everyone().length + G.Bots.list().length), 2);
    assert.equal(await p.evaluate(() => G.Bots.list().length), 0);
    assert.equal(await p.evaluate(() => G.Rogue.state.sections[1].status), 'unseen');
    assert.equal(await p.evaluate(() => G.EnemyMgr.all().length), 0);
    // Walk the actual entry corridor instead of spawning inside a combat room.
    await p.keyboard.down('KeyD'); await p.waitForFunction(() => G.Rogue.state.sections[1].status === 'active'); await p.keyboard.up('KeyD');
    await p.waitForFunction(() => G.EnemyMgr.all().length > 0);
    await p.waitForFunction(() => window.__native.sprites > 0 && window.__native.effects > 0 && window.__native.tiles > 0 && window.__native.music.includes('rogue') && window.__native.sounds.includes('shot'));
    await p.screenshot({ path: '.runtime/rogue-cave-fight.png' });
    assert.equal(await p.evaluate(() => G.Rift.inArena || G.Judgment.active), false);
    assert.equal((await p.evaluate(() => G.Social.setSlots(G.Social.room.slots, 'survival'))).ok, false);
    await p.evaluate(() => { window.__kill = true; G.Game.debugSpeed(4); });
    const clients = [p, guest.page]; let late;
    for (let index = 0; index < 9; index++) {
      await p.waitForFunction(i => G.Rogue.state.index === i, index);
      const stage = index % 3;
      for (const section of [1, 5, 2, 3, 4]) {
        if (index === 1 && section === 4) await p.evaluate(() => { window.__keepExitMinion = true; });
        const explorer = index === 0 && section === 3 ? guest.page : p;
        await visit(explorer, section);
        await p.waitForFunction(id => G.Rogue.state.sections[id].status !== 'unseen', section);
        if (section === 4 && stage) break;
        await p.waitForFunction(id => G.Rogue.state.sections[id].status === 'cleared', section);
      }
      if (stage) {
        await p.waitForFunction(rank => G.EnemyMgr.all().some(e => e.rogueRank === rank && !e.dead), stage === 1 ? 'mini' : 'major');
        const boss = await p.evaluate(() => { const e = G.EnemyMgr.all().find(e => e.rogueRank && !e.dead); return { id: e.id, scale: e.scale, name: e.name }; });
        await clients.find(page => page !== p).waitForFunction(({ id, scale }) => { const e = G.EnemyMgr.get(id); return e && e.scale === scale; }, boss);
        assert.match(boss.name, stage === 1 ? /Subchefe/ : /Chefe/);
        await visit(p, 4, true); await p.waitForTimeout(300);
        assert.equal(await p.evaluate(() => G.Rogue.state.gateOpen), false);
        for (const page of clients) assert.equal(await page.evaluate(() => G.Rogue.drawable()), null);
        assert.equal(await p.evaluate(() => G.Rogue.drawables().length), 1);
        assert.equal(await p.evaluate(() => G.Rogue.state.index), index);
        await visit(p, 4);
        if (index === 2 || index === 8) {
          if (index === 2) await p.waitForFunction(() => G.Hazards.all.some(h => h.delay === 1.1 && h.color === '#84d9ba'));
          await p.screenshot({ path: '.runtime/rogue-boss-' + index + '.png' });
          await p.setViewportSize({ width: 844, height: 390 }); await p.screenshot({ path: '.runtime/rogue-mobile.png' }); await p.setViewportSize({ width: 1280, height: 800 });
        }
        await p.evaluate(() => { for (const e of G.EnemyMgr.all()) if (e.rogueRank && !e.dead) { e.hp = 0; e.die(); } });
      }
      await p.waitForFunction(i => G.Rogue.state.index === i && G.Rogue.state.gateOpen, index);
      for (const page of clients) await page.waitForFunction(i => G.Rogue.state.index === i && G.Rogue.state.phase !== 'fight', index);
      for (const page of clients) assert.equal(await page.evaluate(() => !!G.Rogue.drawable()), true);
      if (index === 1) {
        assert.equal(await p.evaluate(() => !!G.EnemyMgr.get(window.__keptMinion) && !G.EnemyMgr.get(window.__keptMinion).dead), true);
        await p.evaluate(() => { window.__keepExitMinion = false; });
        await p.waitForFunction(() => G.Rogue.state.remaining === 0);
        await p.waitForFunction(() => window.__riftFrames.size >= 2);
        await p.screenshot({ path: '.runtime/rogue-rift-unlocked.png' });
      }
      for (const page of clients) assert.equal(await page.evaluate(() => G.Hazards.all.length), 0);
      if (index === 2) {
        await guest.context.close(); clients.splice(1, 1);
        await p.waitForFunction(() => G.Social.room.members.length === 1 && G.Bots.list().length === 1);
        late = await join(code, 'Explorador novo'); clients.push(late.page);
        await late.page.waitForFunction(() => G.Rogue.active && G.Rogue.state.index === 2 && G.Rogue.state.phase === 'clear');
        assert.equal(await late.page.evaluate(() => G.Game.player.rogueBoons), 2);
        assert.equal(await late.page.evaluate(() => G.World.arena.type), 'cave1');
        await p.waitForFunction(() => G.Bots.list().length === 0);
        assert.equal(await p.evaluate(() => G.Game.everyone().length), 2);
      }
      if (index < 8) {
        if (index === 0) assert.equal(await guest.page.evaluate(() => G.Rogue.advance(G.RogueRules.plan(0, 1, G.Rogue.state.seed).choices[0])), false);
        await p.locator('#rogue-boons button:not([disabled])').first().click();
        assert.equal(await p.evaluate(() => G.Rogue.state.index), index);
        assert.equal(await p.evaluate(() => G.Game.player.rogueBoons), index);
        await visit(index === 0 ? guest.page : p, 4, true);
        for (const page of clients) await page.waitForFunction(i => G.Rogue.state.index === i + 1 && G.Game.player.rogueBoons === i + 1, index);
      } else await visit(p, 4, true);
    }
    for (const page of clients) { await page.waitForSelector('#scr-over:not(.hidden)'); assert.match(await page.locator('#over-title').innerText(), /Expedição concluída/); assert.match(await page.locator('#over-stats').innerText(), /9\/9 cavernas/); }
    await late.context.close();
    await p.waitForFunction(() => G.Social.room.members.length === 1);
    await p.locator('#btn-again').click();
    await p.evaluate(() => { window.__kill = false; });
    await p.locator('#lobby-start').click();
    await p.waitForFunction(() => G.Rogue.active && G.Game.state === 'playing');
    assert.equal(await p.evaluate(() => G.Bots.list().length), 1);
    assert.equal(await p.evaluate(() => G.Rogue.state.index), 0);
    assert.equal(await p.evaluate(() => G.Game.player.rogueBoons), 0);
    assert.equal(await p.evaluate(() => G.Game.player.level), 1);
    await p.evaluate(() => { const pl = G.Game.player; pl.hp = 0; pl.dead = true; });
    await p.waitForSelector('#scr-over:not(.hidden)');
    assert.doesNotMatch(await p.locator('#over-title').innerText(), /Expedição concluída/);
    assert.match(await p.locator('#over-stats').innerText(), /0\/9 cavernas/);
    await p.locator('#btn-again').click(); await p.locator('#lobby-mode').selectOption('survival');
    await p.waitForFunction(() => G.Social.room.mode === 'survival');
    assert.equal(await p.locator('#lobby-members .lob-card').count(), 4);
    await p.locator('#lobby-start').click(); await p.waitForFunction(() => G.Game.state === 'playing');
    assert.equal(await p.evaluate(() => G.Rogue.active), false); assert.equal(await p.evaluate(() => G.World.arena), null);
    assert.deepEqual(errors, []);
    assert.equal(await p.locator('#rogue-map-wrap').isVisible(), false);
    console.log('Rogue: máximo de dois Pokémon, lobby de dupla, substituição bot/convidado durante a run, nove cavernas, fendas, chefes, bênçãos, vitória/derrota e retorno ao Survivor de quatro vagas passaram.');
  } finally { await browser.close(); await game.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
