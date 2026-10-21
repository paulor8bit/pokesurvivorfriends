/* Survivor movement and host-owned apple inventory. Arena keeps its own simulation. */
G.SurvivorActions = (() => {
  const stock = new Map(); let flights = [], serial = 0, sentAt = -999;
  const key = p => p.bot ? 'bot:' + p.slot : p.uid || 'local';
  const authority = () => !G.Coop.active || G.Coop.isHost;
  const players = () => [...(G.Coop.active ? G.Coop.players() : [G.Game.player]), ...G.Bots.list()].filter(Boolean);
  const usable = () => G.Game.state === 'playing' && !G.ArenaUI.active && !G.SettingsUI.isOpen && !G.Judgment.cinematic &&
    !['scr-pause', 'scr-lobby', 'scr-friends', 'scr-menu', 'scr-item'].some(G.UI.isOpen);
  function target(from) {
    return players().filter(p => p !== from && !p.dead && p.hp < p.maxHp && Math.hypot(p.x - from.x, p.y - from.y) <= 900)
      .sort((a, b) => Number(!!a.bot) - Number(!!b.bot) || Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
  }
  function reset() { stock.clear(); flights = []; serial = 0; sentAt = -999; if (G.Game.player) G.Game.player.apples = 0; }
  function collect(p) {
    if (!authority() || p.dead) return;
    stock.set(key(p), 1); p.apples = 1;
    if (p === G.Game.player) G.FX.dmgText(p.x, p.y - p.bodyH - 12, '+1 maçã', '#87ff9d');
  }
  function canCollect(p) { return !p.dead && (p.hp < p.maxHp || stock.get(key(p)) !== 1); }
  function throwFor(from) {
    if (!authority() || !from || from.dead || stock.get(key(from)) !== 1) return false;
    const to = target(from); if (!to) return false;
    stock.set(key(from), 0); from.apples = 0;
    flights.push({ id: ++serial, x: from.x, y: from.y, from: key(from), target: key(to), life: 4 });
    return true;
  }
  function dash() {
    if (!usable()) return;
    const p = G.Game.player; if (p) p.dash(...G.Input.axis());
  }
  function throwApple() {
    const p = G.Game.player; if (!usable() || !p || p.dead || !p.apples || !target(p)) return;
    if (authority()) throwFor(p);
    else if (performance.now() - sentAt > 300) { G.Coop.toHost(['apple']); sentAt = performance.now(); }
  }
  function input() {
    if (!usable()) return;
    const controls = G.ArenaUI.controlKeys();
    if (G.Input.tap(controls[4].toLowerCase())) dash();
    if (G.Input.tap(controls[5].toLowerCase())) throwApple();
  }
  function update(dt) {
    if (!authority()) return;
    const all = players();
    for (const a of flights) {
      a.life -= dt; if (a.life <= 0) continue;
      const to = all.find(p => key(p) === a.target && !p.dead);
      if (!to) { a.life = 0; continue; }
      const dx = to.x - a.x, dy = to.y - a.y, d = Math.hypot(dx, dy);
      if (d <= 24 + 470 * dt) {
        if (to.remote && !to.bot) G.Coop.giveHeal(to.uid, 0.25);
        else to.heal(to.maxHp * 0.25);
        G.FX.ring(to.x, to.y, 6, 50, '#87ff9d', 0.4, 3); a.life = 0;
      } else { a.x += dx / d * 470 * dt; a.y += dy / d * 470 * dt; }
    }
    flights = flights.filter(a => a.life > 0);
  }
  function snapshot() { return { stock: Object.fromEntries(stock), flights }; }
  function receive(data) {
    if (!data || authority()) return;
    flights = Array.isArray(data.flights) ? data.flights : [];
    stock.clear(); for (const [id, count] of Object.entries(data.stock || {})) if (count === 1) stock.set(id, 1);
    const p = G.Game.player; if (p) p.apples = data.stock?.[key(p)] === 1 ? 1 : 0;
  }
  function draw(ctx) {
    for (const a of flights) G.Icons.draw(ctx, 'berry', a.x - 13, a.y - G.LIFT - 13, 26);
    for (const p of players()) if (p.dashLeft > 0 && !p.dead) {
      ctx.save(); ctx.strokeStyle = '#a5ecff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y - 12);
      ctx.lineTo(p.x - Math.cos(p.dashAngle) * 40, p.y - 12 - Math.sin(p.dashAngle) * 40); ctx.stroke(); ctx.restore();
    }
  }
  function ui() {
    let box = document.getElementById('survivor-actions');
    if (!box) {
      box = document.createElement('div'); box.id = 'survivor-actions'; box.setAttribute('translate', 'no');
      box.innerHTML = `<button id="survivor-dash" class="sprite-action" type="button" aria-label="Dash"><i class="action-sprite">${G.Icons.html('dash', 48)}</i><kbd></kbd><b>Dash</b><small></small></button><button id="survivor-apple" class="sprite-action" type="button" aria-label="Lançar maçã ao aliado"><i class="action-sprite">${G.Icons.html('berry', 48)}</i><kbd></kbd><b></b><small></small></button>`;
      document.body.appendChild(box);
      document.getElementById('survivor-dash').onpointerdown = e => { e.preventDefault(); dash(); };
      document.getElementById('survivor-apple').onpointerdown = e => { e.preventDefault(); throwApple(); };
    }
    const p = G.Game.player; box.classList.toggle('hidden', !usable() || !p); if (!p) return;
    const controls = G.ArenaUI.controlKeys(), db = box.children[0], ab = box.children[1], to = target(p);
    db.disabled = p.dead || p.dashCooldown > 0; db.querySelector('kbd').textContent = G.ArenaUI.keyLabel(controls[4]);
    db.querySelector('small').textContent = p.dashCooldown > 0 ? p.dashCooldown.toFixed(1) + 's' : 'Pronto';
    ab.disabled = p.dead || !p.apples || !to;
    ab.querySelector('kbd').textContent = G.ArenaUI.keyLabel(controls[5]); ab.querySelector('b').textContent = 'Maçã · ' + (p.apples || 0) + '/1';
    ab.querySelector('small').textContent = !p.apples ? 'Pegue uma maçã' : to ? '+25% HP · ' + (to.tag || to.mon.name) : 'Sem aliado ferido por perto';
  }
  return { reset, collect, canCollect, throwFor, input, update, draw, ui, snapshot, receive, target };
})();
