/* Nine finite cave hordes. Combat, sprites, drops and progression use the Survivor engine. */
(() => {
  const BOONS = {
    vigor: { name: 'Vigor', text: '+8 HP máximo e cura de 25%', icon: 'heart' },
    force: { name: 'Força', text: '+12% de dano', icon: 'move:tackle' },
    haste: { name: 'Agilidade', text: '+7% de velocidade e dash melhor', icon: 'boot' },
    focus: { name: 'Foco', text: 'Ataques recarregam 6% mais rápido', icon: 'move:confusion' },
    renewal: { name: 'Renovação', text: '+0,25 HP por segundo', icon: 'berry' },
    magnet: { name: 'Atração', text: '+18% de alcance para coletar', icon: 'magnet' }
  };
  const NAMES = ['Caverna do Musgo', 'Gruta dos Cristais', 'Abismo das Brasas'];
  // Relative tile coordinates. Two routes meet at the exit, with a treasure loop.
  function layout(index, seed = 1) {
    const room = plan(index, 1, seed), flip = ((seed >>> 0) + index) % 2 ? 1 : -1;
    const rooms = [
      { id: 0, name: 'Entrada', x: -24, y: 0, r: 5, kind: 'entry' },
      { id: 1, name: 'Salão das Rochas', x: -8, y: 0, r: 6, kind: 'horde' },
      { id: 2, name: 'Galeria Superior', x: 7, y: -14 * flip, r: 5, kind: 'horde' },
      { id: 3, name: 'Galeria Inferior', x: 7, y: 14 * flip, r: 5, kind: 'horde' },
      { id: 4, name: room.stage ? 'Câmara do Guardião' : 'Câmara da Saída', x: 24, y: 0, r: 7, kind: room.stage ? 'boss' : 'horde' },
      { id: 5, name: 'Alcova do Tesouro', x: -10, y: -17 * flip, r: 4, kind: 'treasure' }
    ];
    const edges = [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4], [2, 5], [5, 1]];
    const floor = new Set(), carve = (x, y, r) => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + 1) floor.add((x + dx) + ',' + (y + dy));
    };
    for (const r of rooms) carve(r.x, r.y, r.r);
    for (const [a, b] of edges) {
      const p = rooms[a], q = rooms[b], steps = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
      for (let n = 0; n <= steps; n++) carve(Math.round(p.x + (q.x - p.x) * n / steps), Math.round(p.y + (q.y - p.y) * n / steps), 2);
    }
    return { rooms, edges, floor, gate: { x: 28, y: 0 } };
  }
  function canExit(state, players, radius = 46) {
    return !!state?.gateOpen && players.some(p => !p.dead && Math.hypot(p.x - state.gate.x, p.y - state.gate.y) <= radius);
  }
  function plan(index, count = 1, seed = 1) {
    if (!Number.isInteger(index) || index < 0 || index > 8) throw Error('Sala Rogue inválida.');
    const cycle = Math.floor(index / 3), stage = index % 3, players = Math.max(1, Math.min(2, count | 0));
    const normal = 12 + cycle * 6 + (stage === 1 ? 4 : 0) + (players - 1) * 2;
    const ids = Object.keys(BOONS), offset = ((seed >>> 0) + index * 3 + cycle) % ids.length;
    return { index, cycle, stage, title: NAMES[cycle], theme: 'cave' + (cycle + 1),
      difficulty: ['Fácil · Horda', 'Média · Subchefe', 'Difícil · Chefe maior'][stage],
      total: normal + (stage > 0 ? 1 : 0), hp: 26 + cycle * 25 + stage * 12,
      damage: 6 + cycle * 4 + stage * 2, bossHp: (stage === 1 ? 250 : 520) * (1 + cycle * 0.85),
      choices: [0, 1, 2].map(i => ids[(offset + i) % ids.length]) };
  }
  const rules = { plan, layout, canExit, BOONS, NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
  if (typeof G === 'undefined') return;
  G.RogueRules = rules;
  G.Rogue = (() => {
    let s = null, geometry = null, timers = [], hazardT = 5, signature = '', finished = false;
    const host = () => !G.Coop.active || G.Coop.isHost;
    const ts = () => G.World.TS;
    const actors = () => [...G.Game.everyone(), ...G.Bots.list()];
    const center = () => ({ x: (12000 + s.index * 128) * ts() + ts() / 2, y: 12000 * ts() + ts() / 2 });
    const roomPoint = id => { const c = center(), r = geometry.rooms[id]; return { x: c.x + r.x * ts(), y: c.y + r.y * ts() }; };
    function reset() { s = null; geometry = null; timers = []; hazardT = 5; signature = ''; finished = false; }
    function applyBoon(p, id) {
        if (id === 'vigor') { if (p.dead) p.maxHp += 8; else { p.addMaxHp(8); p.heal(p.maxHp * 0.25); } }
        else if (id === 'force') p.atkMul *= 1.12;
        else if (id === 'haste') p.spdMul *= 1.07;
        else if (id === 'focus') p.cdMul *= 0.94;
        else if (id === 'renewal') p.regenFlat += 0.25;
        else if (id === 'magnet') p.magnet *= 1.18;
    }
    function applyNewBoons() {
      for (const p of [G.Game.player, ...(host() ? G.Bots.list() : [])]) {
        if (!p) continue; p.rogueBoons ||= 0;
        while (p.rogueBoons < s.boons.length) applyBoon(p, s.boons[p.rogueBoons++]);
      }
    }
    function enter(index, data) {
      const boons = data?.boons || s?.boons || [], seed = data?.seed ?? s?.seed ?? 1;
      geometry = layout(index, seed);
      s = { active: true, index, seed, players: G.Game.everyone().length, phase: 'fight', spawned: 0, remaining: 0, clearT: 0, gateOpen: false, choice: null,
        sections: geometry.rooms.map(r => ({ id: r.id, status: r.id === 0 ? 'cleared' : 'unseen', spawned: 0, remaining: 0 })), boons: boons.slice(), ...(data || {}) };
      const c = center(); s.gate = { x: c.x + geometry.gate.x * ts(), y: c.y + geometry.gate.y * ts() };
      G.EnemyMgr.clear(); G.Projectiles.clear(); G.Combat.clearFields(); G.Hazards.clear(); G.Pickups.clear(); G.Path.clear();
      G.Rift.reset(); G.Judgment.reset(); G.Events.reset(); G.Weather.clear();
      const room = plan(index, s.players, seed);
      G.World.setArena({ tx: 12000 + index * 128, ty: 12000, r: 40, type: room.theme, dungeon: geometry.floor });
      G.World.setBiome(G.Tiles.arenaBiome(room.theme), true);
      actors().forEach((p, i) => {
        const entry = roomPoint(0); p.x = entry.x + (i - (actors().length - 1) / 2) * 30; p.y = entry.y;
        p.dashLeft = 0; G.World.collide(p); if (!p.remote) p.invuln = Math.max(p.invuln, 2);
      });
      applyNewBoons();
      G.Camera.x = G.Game.player.x; G.Camera.y = G.Game.player.y;
      G.Game.flash(['#84d9ba', '#b599ff', '#ffb16c'][room.cycle], 0.8);
      G.Audio.sfx('rift'); G.Spawner.say('Caverna ' + (index + 1) + '/9 · Explore os caminhos e encontre a câmara da saída', 3);
      if (host()) G.Coop.resetWorld();
      timers = geometry.rooms.map(() => 0.8); hazardT = 5; signature = '';
    }
    function begin(seed) { reset(); enter(0, { seed, active: true, boons: [] }); }
    function point(serial, section) {
      const c = roomPoint(section), radius = geometry.rooms[section].r * ts();
      for (let n = 0; n < 80; n++) {
        const a = (serial * 2.399 + n * 0.63 + (s.seed % 100) / 10), r = radius * (0.45 + (n % 4) * 0.1);
        const p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
        if (G.World.isFree(p.x, p.y, 30) && G.Game.everyone().every(o => o.dead || Math.hypot(o.x - p.x, o.y - p.y) > 75)) return p;
      }
      return c;
    }
    function quota(id) {
      const room = plan(s.index, s.players, s.seed), normal = room.total - (room.stage ? 1 : 0);
      const counts = [0, Math.ceil(normal * 0.3), Math.floor(normal * 0.25), Math.floor(normal * 0.25)];
      counts[4] = normal - counts[1] - counts[2] - counts[3] + (room.stage ? 1 : 0); counts[5] = 0;
      return counts[id];
    }
    function spawn(section) {
      const room = plan(s.index, s.players, s.seed), part = s.sections[section], rank = room.stage > 0 && section === 4 && part.spawned === quota(4) - 1 ? room.stage === 1 ? 'mini' : 'major' : '';
      const roster = room.cycle === 0 ? [41, 74, 27, 50, 92, 304] : room.cycle === 1 ? [42, 75, 51, 93, 524, 529] : [76, 94, 305, 525, 530, 551];
      const dex = rank ? (rank === 'mini' ? [75, 305, 526][room.cycle] : [95, 208, 248][room.cycle]) : roster[(s.seed + s.spawned * 7 + s.index) % roster.length];
      const mon = G.DEX_BY[dex] && G.SPRITE_META[dex] ? G.DEX_BY[dex] : G.DEX_BY[74];
      const pos = point(s.spawned, section), n = G.Game.everyone().length;
      const def = { dex: mon.dex, hp: Math.round((rank ? room.bossHp : room.hp) * G.Coop.scaleHp(n)),
        spd: rank ? 44 + room.cycle * 6 : 43 + room.cycle * 6, dmg: room.damage * (rank ? 1.4 : 1),
        xp: rank ? 110 + room.cycle * 60 : 14 + room.cycle * 8, behavior: rank === 'major' ? ['charger', 'beamer', 'zoner'][room.cycle] :
          rank ? 'charger' : s.spawned % 5 === 4 ? 'ranged' : 'chase', shotCd: 2.2, shotDmg: room.damage, range: 230 };
      const e = new G.Enemy(def, pos.x, pos.y, { hp: 1, spd: 1, dmg: 1 }, !!rank);
      e.flying = false; e.rogueRank = rank; e.rogueSection = section;
      if (rank) part.guardian = e.id;
      if (rank) { e.setScale(e.scale * (rank === 'major' ? 1.35 : 0.85)); e.name = (rank === 'major' ? 'Chefe · ' : 'Subchefe · ') + mon.name; G.Audio.sfx('boss'); }
      G.EnemyMgr.add(e); s.spawned++; s.remaining++; part.spawned++; part.remaining++;
      G.FX.ring(pos.x, pos.y, 5, rank ? 60 : 24, ['#84d9ba', '#b599ff', '#ffb16c'][room.cycle], 0.4, 2);
      G.Sprites.preload([mon.dex], 8000);
    }
    function safeRoom() { G.Projectiles.clear(); G.Combat.clearFields(); G.Hazards.clear(); }
    function clearSection(id) {
      const part = s.sections[id]; part.status = 'cleared';
      const p = roomPoint(id); G.Audio.sfx('confirm');
      G.Game.player.coins += 5 + s.index * 2;
      G.Pickups.drop('heal', p.x + 20, p.y); G.Pickups.drop('xpBig', p.x, p.y, 15 + s.index * 5);
      if (!G.EnemyMgr.all().some(e => !e.dead)) safeRoom();
      if (id === 4) {
        s.gateOpen = true; s.phase = 'clear'; s.clearT = 0;
        G.Audio.sfx('rift'); G.FX.ring(s.gate.x, s.gate.y, 8, 65, '#b599ff', 0.7, 3);
        G.Spawner.say('Uma fenda surgiu! Explore o restante ou atravesse para seguir.', 3.5);
      }
    }
    function advance(id) {
      if (!s?.active || !host() || !s.gateOpen || s.choice || !plan(s.index, 1, s.seed).choices.includes(id)) return false;
      s.choice = id; signature = ''; return true;
    }
    function leaveCave() {
      if (!canExit(s, G.Game.everyone())) return false;
      if (s.index === 8) { s.phase = 'victory'; s.clearT = 0; s.remaining = 0; G.EnemyMgr.clear(); safeRoom(); G.Audio.sfx('legend'); return true; }
      s.boons.push(s.choice || plan(s.index, s.players, s.seed).choices[0]); applyNewBoons(); enter(s.index + 1); return true;
    }
    function update(dt) {
      if (!s?.active) return;
      applyNewBoons();
      if (!host()) return;
      for (const e of G.EnemyMgr.all()) if (!e.dead) G.World.collide(e);
      if (s.phase === 'victory') { s.clearT += dt; if (s.clearT > 2 && !finished) { finished = true; G.Game.finishRogue(); } return; }
      const room = plan(s.index, s.players, s.seed);
      const previous = s.remaining;
      s.remaining = G.EnemyMgr.all().filter(e => !e.dead).length;
      if (s.gateOpen && previous > 0 && !s.remaining) safeRoom();
      for (const r of geometry.rooms) {
        const part = s.sections[r.id], pos = roomPoint(r.id);
        if (part.status === 'unseen' && G.Game.everyone().some(p => !p.dead && Math.hypot(p.x - pos.x, p.y - pos.y) < (r.r - 1) * ts())) {
          part.status = 'active';
          if (r.kind === 'treasure') { G.Game.player.coins += 20 + s.index * 5; G.Pickups.drop('heal', pos.x, pos.y); G.Pickups.drop('xpBig', pos.x + 20, pos.y, 60); part.status = 'cleared'; G.Audio.sfx('chest'); G.Spawner.say('Alcova descoberta! Tesouro para a equipe.', 2.5); }
          else G.Spawner.say(r.name + ' · Uma horda se aproxima!', 2);
        }
        if (part.status !== 'active') continue;
        part.remaining = G.EnemyMgr.all().filter(e => !e.dead && e.rogueSection === r.id).length;
        timers[r.id] -= dt;
        if (part.spawned < quota(r.id) && s.remaining < 14 + room.cycle * 3 && timers[r.id] <= 0) { spawn(r.id); timers[r.id] = 0.65; }
        const guardian = part.guardian ? G.EnemyMgr.get(part.guardian) : null;
        const guardianDown = !!part.guardian && (!guardian || guardian.dead);
        if (part.spawned >= quota(r.id) && (part.remaining === 0 || guardianDown)) clearSection(r.id);
      }
      const boss = G.EnemyMgr.all().find(e => e.rogueRank === 'major' && !e.dead);
      if (boss && (hazardT -= dt) <= 0) {
          hazardT = 5.5 - room.cycle * 0.6;
          for (const p of G.Game.everyone().filter(p => !p.dead)) G.Hazards.add({ kind: 'zone', x: p.x, y: p.y, r: 46 + room.cycle * 8,
            delay: 1.1, end: 0.35, dmg: 8 + room.cycle * 5, type: ['rock', 'steel', 'dark'][room.cycle], color: ['#84d9ba', '#b599ff', '#ffb16c'][room.cycle] });
      }
      if (s.gateOpen) { s.clearT += dt; leaveCave(); }
    }
    function snapshot() { return s?.active ? JSON.parse(JSON.stringify(s)) : null; }
    function receive(data) {
      if (!data?.active || host()) return;
      if (!s?.active || s.index !== data.index) enter(data.index, data);
      else { if (data.phase === 'victory') G.EnemyMgr.clear(); if (data.phase === 'victory' || data.remaining === 0 && s.remaining > 0) safeRoom(); s = { ...data }; applyNewBoons(); }
    }
    function restore(data) { if (data?.active) enter(data.index, data); }
    function summary() { return s?.active ? s.finalResult || { index: s.index, completed: s.phase === 'victory' ? 9 : s.index, victory: s.phase === 'victory' } : null; }
    function result(data) { if (s && data) { s.finalResult = { ...data }; s.index = data.index; if (data.victory) s.phase = 'victory'; } }
    function drawable() {
      if (!s?.active || !s.gateOpen || G.Game.state === 'ui' || G.Game.state === 'over') return null;
      const gate = s.gate;
      return { y: gate.y, draw(ctx) {
        const img = G.Tiles.propSprite(G.World.biome, 'rift', Math.floor(performance.now() / 125) % 4), p = G.Sprites.PX;
        ctx.save(); ctx.shadowColor = '#b599ff'; ctx.shadowBlur = 18;
        ctx.drawImage(img, gate.x - img.width * p / 2, gate.y - img.height * p + 4, img.width * p, img.height * p); ctx.restore();
        ctx.save(); ctx.font = '12px Pixelify, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e0caff'; ctx.fillText('FENDA · ATRAVESSE', gate.x, gate.y + 22); ctx.restore();
      } };
    }
    function drawables() {
      if (!s?.active || G.Game.state === 'ui' || G.Game.state === 'over') return [];
      const door = drawable();
      const p = roomPoint(5);
      return [...(door ? [door] : []), { y: p.y, draw(ctx) {
        const img = G.Tiles.propSprite(G.World.biome, 'chest'), done = s.sections[5].status === 'cleared';
        ctx.save(); ctx.globalAlpha = done ? 0.4 : 1; ctx.drawImage(img, p.x - img.width, p.y - img.height * 2, img.width * 2, img.height * 2); ctx.restore();
      } }];
    }
    function ui() {
      let box = document.getElementById('rogue-hud');
      if (!box) { box = document.createElement('div'); box.id = 'rogue-hud'; box.setAttribute('translate', 'no'); box.innerHTML = '<div id="rogue-status"></div><div id="rogue-boons"></div>'; document.body.appendChild(box); }
      box.classList.toggle('hidden', !s?.active || G.Game.state !== 'playing' || G.SettingsUI.isOpen || G.UI.isOpen('scr-pause') || G.UI.isOpen('scr-lobby'));
      if (!s?.active) { document.getElementById('rogue-map-wrap')?.classList.add('hidden'); return; }
      const room = plan(s.index, s.players, s.seed);
      const visited = s.sections.filter(r => r.status !== 'unseen').length;
      document.getElementById('rogue-status').textContent = `ROGUE · Ciclo ${room.cycle + 1}/3 · Caverna ${s.index + 1}/9 · ${room.title}\n${visited}/6 seções · ${s.phase === 'victory' ? 'Expedição concluída!' : s.gateOpen ? 'Fenda aberta · Vá até a saída' : 'Explore os caminhos · Encontre a saída'}`;
      drawMap(box.classList.contains('hidden'));
      const key = s.index + ':' + s.phase + ':' + s.choice + ':' + host(), choices = document.getElementById('rogue-boons');
      if (key !== signature) {
        signature = key; choices.replaceChildren();
        if (s.phase === 'clear' && s.index < 8) {
          const title = document.createElement('p'); title.textContent = s.choice ? BOONS[s.choice].name + ' escolhida · Vá até a fenda para seguir' : host() ? 'Bênção para a próxima caverna (opcional). Atravesse a fenda para seguir.' : 'Vá até a fenda para seguir com a equipe'; choices.appendChild(title);
          if (host() && !s.choice) for (const id of room.choices) {
            const boon = BOONS[id], b = document.createElement('button'); b.className = 'btn rogue-boon'; b.dataset.boon = id;
            b.innerHTML = G.Icons.html(boon.icon, 26) + '<b>' + boon.name + '</b><small>' + boon.text + '</small>';
            b.onclick = () => advance(id); choices.appendChild(b);
          }
        }
      }
    }
    function drawMap(hidden) {
      let wrap = document.getElementById('rogue-map-wrap');
      if (!wrap) { wrap = document.createElement('div'); wrap.id = 'rogue-map-wrap'; wrap.setAttribute('translate', 'no'); wrap.innerHTML = '<b>Mapa da caverna</b><canvas id="rogue-map" width="176" height="120" aria-label="Mapa das seções exploradas"></canvas><small>Você · aliados · salas · saída</small>'; document.body.appendChild(wrap); }
      wrap.classList.toggle('hidden', hidden); if (hidden) return;
      const ctx = document.getElementById('rogue-map').getContext('2d'), c = center();
      ctx.clearRect(0, 0, 176, 120); const x = v => 88 + v * 2.3, y = v => 60 + v * 2.3;
      const seen = id => s.sections[id].status !== 'unseen';
      const known = id => seen(id) || geometry.edges.some(([a, b]) => a === id && seen(b) || b === id && seen(a));
      ctx.lineWidth = 4; ctx.strokeStyle = '#62758d';
      for (const [a, b] of geometry.edges) if (seen(a) || seen(b)) { const p = geometry.rooms[a], q = geometry.rooms[b]; ctx.beginPath(); ctx.moveTo(x(p.x), y(p.y)); ctx.lineTo(x(q.x), y(q.y)); ctx.stroke(); }
      for (const r of geometry.rooms) if (known(r.id)) { ctx.fillStyle = !seen(r.id) ? '#233245' : r.kind === 'treasure' ? '#ffda70' : r.id === 4 ? s.gateOpen ? '#7affc6' : '#dd99ff' : s.sections[r.id].status === 'cleared' ? '#609b8f' : '#ff897a'; ctx.beginPath(); ctx.arc(x(r.x), y(r.y), Math.max(5, r.r * 1.35), 0, 7); ctx.fill(); }
      for (const p of G.Game.everyone()) if (!p.dead) { ctx.fillStyle = p === G.Game.player ? '#ffffff' : '#66dfff'; ctx.beginPath(); ctx.arc(x((p.x - c.x) / ts()), y((p.y - c.y) / ts()), 3, 0, 7); ctx.fill(); }
    }
    return { begin, reset, update, receive, restore, snapshot, summary, result, drawable, drawables, ui, advance,
      end() { if (s) s.active = false; document.getElementById('rogue-map-wrap')?.classList.add('hidden'); }, get active() { return !!s?.active; }, get state() { return s; }, get music() { return G.EnemyMgr.bossAlive() ? 'boss' : 'rogue'; } };
  })();
})();
