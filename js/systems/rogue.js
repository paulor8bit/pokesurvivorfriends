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
  function plan(index, count = 1, seed = 1) {
    if (!Number.isInteger(index) || index < 0 || index > 8) throw Error('Sala Rogue inválida.');
    const cycle = Math.floor(index / 3), stage = index % 3, players = Math.max(1, Math.min(4, count | 0));
    const normal = 12 + cycle * 6 + (stage === 1 ? 4 : 0) + (players - 1) * 2;
    const ids = Object.keys(BOONS), offset = ((seed >>> 0) + index * 3 + cycle) % ids.length;
    return { index, cycle, stage, title: NAMES[cycle], theme: 'cave' + (cycle + 1),
      difficulty: ['Fácil · Horda', 'Média · Subchefe', 'Difícil · Chefe maior'][stage],
      total: normal + (stage > 0 ? 1 : 0), hp: 26 + cycle * 25 + stage * 12,
      damage: 6 + cycle * 4 + stage * 2, bossHp: (stage === 1 ? 250 : 520) * (1 + cycle * 0.85),
      choices: [0, 1, 2].map(i => ids[(offset + i) % ids.length]) };
  }
  const rules = { plan, BOONS, NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
  if (typeof G === 'undefined') return;
  G.RogueRules = rules;
  G.Rogue = (() => {
    let s = null, spawnT = 1.4, hazardT = 5, signature = '', finished = false;
    const host = () => !G.Coop.active || G.Coop.isHost;
    const ts = () => G.World.TS;
    const actors = () => [...G.Game.everyone(), ...G.Bots.list()];
    const center = () => ({ x: (12000 + s.index * 80) * ts() + ts() / 2, y: 12000 * ts() + ts() / 2 });
    function reset() { s = null; spawnT = 1.4; hazardT = 5; signature = ''; finished = false; }
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
      s = { active: true, index, seed, players: G.Game.everyone().length, phase: 'fight', spawned: 0, remaining: 0, clearT: 0, boons: boons.slice(), ...(data || {}) };
      const c = center(); s.gate = { x: c.x, y: c.y - ts() * 3 };
      G.EnemyMgr.clear(); G.Projectiles.clear(); G.Combat.clearFields(); G.Hazards.clear(); G.Pickups.clear(); G.Path.clear();
      G.Rift.reset(); G.Judgment.reset(); G.Events.reset(); G.Weather.clear();
      const room = plan(index, s.players, seed);
      G.World.setArena({ tx: 12000 + index * 80, ty: 12000, r: 13, type: room.theme });
      G.World.setBiome(G.Tiles.arenaBiome(room.theme), true);
      actors().forEach((p, i) => {
        p.x = c.x + (i - (actors().length - 1) / 2) * 36; p.y = c.y + ts() * 3;
        p.dashLeft = 0; G.World.collide(p); if (!p.remote) p.invuln = Math.max(p.invuln, 2);
      });
      applyNewBoons();
      G.Camera.x = G.Game.player.x; G.Camera.y = G.Game.player.y;
      G.Game.flash(['#84d9ba', '#b599ff', '#ffb16c'][room.cycle], 0.8);
      G.Audio.sfx('rift'); G.Spawner.say('Rogue · Ciclo ' + (room.cycle + 1) + '/3 · Caverna ' + (index + 1) + '/9', 3);
      if (host()) G.Coop.resetWorld();
      spawnT = 1.4; hazardT = 5; signature = '';
    }
    function begin(seed) { reset(); enter(0, { seed, active: true, boons: [] }); }
    function point(serial) {
      const c = center();
      for (let n = 0; n < 80; n++) {
        const a = (serial * 2.399 + n * 0.63 + (s.seed % 100) / 10), r = 185 + (n % 6) * 23;
        const p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
        if (G.World.isFree(p.x, p.y, 22) && G.Game.everyone().every(o => o.dead || Math.hypot(o.x - p.x, o.y - p.y) > 125)) return p;
      }
      return { x: c.x, y: c.y - ts() * 3 };
    }
    function spawn() {
      const room = plan(s.index, s.players, s.seed), rank = room.stage > 0 && s.spawned === room.total - 1 ? room.stage === 1 ? 'mini' : 'major' : '';
      const roster = room.cycle === 0 ? [41, 74, 27, 50, 92, 304] : room.cycle === 1 ? [42, 75, 51, 93, 524, 529] : [76, 94, 305, 525, 530, 551];
      const dex = rank ? (rank === 'mini' ? [75, 305, 526][room.cycle] : [95, 208, 248][room.cycle]) : roster[(s.seed + s.spawned * 7 + s.index) % roster.length];
      const mon = G.DEX_BY[dex] && G.SPRITE_META[dex] ? G.DEX_BY[dex] : G.DEX_BY[74];
      const pos = point(s.spawned), n = G.Game.everyone().length;
      const def = { dex: mon.dex, hp: Math.round((rank ? room.bossHp : room.hp) * G.Coop.scaleHp(n)),
        spd: rank ? 44 + room.cycle * 6 : 43 + room.cycle * 6, dmg: room.damage * (rank ? 1.4 : 1),
        xp: rank ? 110 + room.cycle * 60 : 14 + room.cycle * 8, behavior: rank === 'major' ? ['charger', 'beamer', 'zoner'][room.cycle] :
          rank ? 'charger' : s.spawned % 5 === 4 ? 'ranged' : 'chase', shotCd: 2.2, shotDmg: room.damage, range: 230 };
      const e = new G.Enemy(def, pos.x, pos.y, { hp: 1, spd: 1, dmg: 1 }, !!rank);
      e.flying = false; e.rogueRank = rank;
      if (rank) { e.setScale(e.scale * (rank === 'major' ? 1.35 : 0.85)); e.name = (rank === 'major' ? 'Chefe · ' : 'Subchefe · ') + mon.name; G.Audio.sfx('boss'); }
      G.EnemyMgr.add(e); s.spawned++; s.remaining++;
      G.FX.ring(pos.x, pos.y, 5, rank ? 60 : 24, ['#84d9ba', '#b599ff', '#ffb16c'][room.cycle], 0.4, 2);
      G.Sprites.preload([mon.dex], 8000);
    }
    function safeRoom() { G.Projectiles.clear(); G.Combat.clearFields(); G.Hazards.clear(); }
    function clearRoom() {
      s.phase = s.index === 8 ? 'victory' : 'clear'; s.clearT = 0;
      safeRoom();
      G.Pickups.pullAll(); G.Audio.sfx(s.phase === 'victory' ? 'legend' : 'confirm');
      const p = G.Game.player;
      p.coins += 15 + s.index * 5;
      G.Pickups.drop('heal', p.x + 20, p.y); G.Pickups.drop('xpBig', p.x, p.y, 40 + s.index * 20);
      G.Spawner.say(s.phase === 'victory' ? 'As nove salas foram vencidas!' : 'Sala limpa! Recolha o saque e escolha uma bênção.', 3.5);
    }
    function advance(id) {
      if (!s?.active || !host() || s.phase !== 'clear' || s.clearT < 2 || !plan(s.index, 1, s.seed).choices.includes(id)) return false;
      s.boons.push(id); applyNewBoons(); enter(s.index + 1); return true;
    }
    function update(dt) {
      if (!s?.active) return;
      applyNewBoons();
      const c = center(), max = ts() * 11.3;
      for (const p of [G.Game.player, ...G.Bots.list(), ...(host() ? G.EnemyMgr.all() : [])]) {
        if (p.dead || p.remote) continue;
        const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
        if (d > max) { p.x = c.x + dx / d * max; p.y = c.y + dy / d * max; G.World.collide(p); }
      }
      if (!host()) return;
      const room = plan(s.index, s.players, s.seed);
      s.remaining = G.EnemyMgr.all().filter(e => !e.dead).length;
      if (s.phase === 'fight') {
        spawnT -= dt;
        if (s.spawned < room.total && s.remaining < 12 + room.cycle * 3 && spawnT <= 0) { spawn(); spawnT = 0.55; }
        if (s.spawned >= room.total && s.remaining === 0) { clearRoom(); return; }
        const boss = G.EnemyMgr.all().find(e => e.rogueRank === 'major' && !e.dead);
        if (boss && (hazardT -= dt) <= 0) {
          hazardT = 5.5 - room.cycle * 0.6;
          for (const p of G.Game.everyone().filter(p => !p.dead)) G.Hazards.add({ kind: 'zone', x: p.x, y: p.y, r: 46 + room.cycle * 8,
            delay: 1.1, end: 0.35, dmg: 8 + room.cycle * 5, type: ['rock', 'steel', 'dark'][room.cycle], color: ['#84d9ba', '#b599ff', '#ffb16c'][room.cycle] });
        }
      } else {
        s.clearT += dt;
        if (s.phase === 'victory' && s.clearT > 5 && !finished) { finished = true; G.Game.finishRogue(); }
      }
    }
    function snapshot() { return s?.active ? JSON.parse(JSON.stringify(s)) : null; }
    function receive(data) {
      if (!data?.active || host()) return;
      if (!s?.active || s.index !== data.index) enter(data.index, data);
      else { if (s.phase === 'fight' && data.phase !== 'fight') safeRoom(); s = { ...data }; applyNewBoons(); }
    }
    function restore(data) { if (data?.active) enter(data.index, data); }
    function summary() { return s?.active ? s.finalResult || { index: s.index, completed: s.phase === 'victory' ? 9 : s.index + (s.phase === 'clear' ? 1 : 0), victory: s.phase === 'victory' } : null; }
    function result(data) { if (s && data) { s.finalResult = { ...data }; s.index = data.index; if (data.victory) s.phase = 'victory'; } }
    function drawable() {
      if (!s?.active || s.phase === 'fight' || G.Game.state === 'ui' || G.Game.state === 'over') return null;
      const gate = s.gate || center();
      return { y: gate.y, draw(ctx) {
        const img = G.Tiles.propSprite(0, 'rift', Math.floor(performance.now() / 125) % 4), p = G.Sprites.PX;
        ctx.save(); ctx.shadowColor = '#b599ff'; ctx.shadowBlur = 18;
        ctx.drawImage(img, gate.x - img.width * p / 2, gate.y - img.height * p + 4, img.width * p, img.height * p); ctx.restore();
      } };
    }
    function ui() {
      let box = document.getElementById('rogue-hud');
      if (!box) { box = document.createElement('div'); box.id = 'rogue-hud'; box.setAttribute('translate', 'no'); box.innerHTML = '<div id="rogue-status"></div><div id="rogue-boons"></div>'; document.body.appendChild(box); }
      box.classList.toggle('hidden', !s?.active || G.Game.state !== 'playing' || G.SettingsUI.isOpen || G.UI.isOpen('scr-pause') || G.UI.isOpen('scr-lobby'));
      if (!s?.active) return;
      const room = plan(s.index, s.players, s.seed);
      document.getElementById('rogue-status').textContent = `ROGUE · Ciclo ${room.cycle + 1}/3 · Sala ${s.index + 1}/9 · ${room.title}\n${room.difficulty} · ${s.phase === 'fight' ? 'Restantes: ' + (room.total - s.spawned + s.remaining) : s.phase === 'victory' ? 'Expedição concluída!' : 'Sala limpa · Portal aberto'}`;
      const key = s.index + ':' + s.phase + ':' + host(), choices = document.getElementById('rogue-boons');
      if (key !== signature) {
        signature = key; choices.replaceChildren();
        if (s.phase === 'clear') {
          const title = document.createElement('p'); title.textContent = host() ? 'Escolha uma bênção para a equipe e entre na próxima sala' : 'O anfitrião está escolhendo a bênção da equipe'; choices.appendChild(title);
          if (host()) for (const id of room.choices) {
            const boon = BOONS[id], b = document.createElement('button'); b.className = 'btn rogue-boon'; b.dataset.boon = id;
            b.innerHTML = G.Icons.html(boon.icon, 26) + '<b>' + boon.name + '</b><small>' + boon.text + '</small>';
            b.onclick = () => advance(id); choices.appendChild(b);
          }
        }
      }
      for (const b of choices.querySelectorAll('button')) b.disabled = s.clearT < 2;
    }
    return { begin, reset, update, receive, restore, snapshot, summary, result, drawable, ui, advance,
      end() { if (s) s.active = false; }, get active() { return !!s?.active; }, get state() { return s; }, get music() { return s?.phase === 'fight' && G.EnemyMgr.bossAlive() ? 'boss' : 'rogue'; } };
  })();
})();
