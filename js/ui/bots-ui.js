/* ============ bots-ui.js — reclutar compañeros (equipo) ============
 * Antes aquí estaban los amigos online. Ahora es el equipo: huecos que se
 * desbloquean con monedas y Pokémon de tu colección que luchan contigo.
 */
G.BotsUI = (() => {
  const $ = G.UI.$;

  function open() {
    G.UI.chrome(true);
    G.UI.show('scr-bots');
    render();
  }

  function render() {
    G.UI.refreshCoins();
    const st = G.Bots.state();
    const body = $('bots-body');
    let html = '';
    for (let i = 0; i < G.Bots.MAX; i++) {
      const locked = i >= st.slots;
      const dex = st.party[i];
      const card = 'display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:8px;' +
                   'border:1px solid rgba(244,248,255,.12);border-radius:10px;background:rgba(10,16,28,.4)';
      if (locked) {
        html += `<div style="${card}">
          <div style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--muted)">&#128274;</div>
          <div style="flex:1">
            <b>${G.T('Hueco bloqueado')}</b>
            <div style="margin-top:6px"><button class="btn small" data-unlock="${i}">${G.T('Desbloquear')} · ${G.Icons.html('coin', 14)} ${G.Bots.costOf(i)}</button></div>
          </div>
        </div>`;
      } else if (!dex) {
        html += `<div style="${card}">
          <div style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#7ee07a">+</div>
          <div style="flex:1">
            <b>${G.T('Hueco libre')}</b>
            <div style="margin-top:6px"><button class="btn small gold" data-pick="${i}">${G.T('Elegir Pokémon')}</button></div>
          </div>
        </div>`;
      } else {
        const mon = G.DEX_BY[dex];
        html += `<div style="${card}">
          <canvas width="64" height="64" data-sprite="${dex}"></canvas>
          <div style="flex:1;min-width:0"><b>${mon.name}</b>
            <div class="bot-affinity">${G.T('Afinidad')} · ${G.T('Nv.')} ${G.Bots.affinityOf(dex).level}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn small" data-pick="${i}">${G.T('Cambiar')}</button>
            <button class="btn small ghost" data-remove="${i}">${G.T('Quitar')}</button>
          </div>
        </div>${trainingCard(dex)}`;
      }
    }
    html += `<div id="bot-picker" class="hidden">
      <p class="sub">${G.T('Elige un Pokémon de tu colección:')}</p>
      <div class="grid" id="bot-grid"></div>
    </div>`;
    html += '<div id="bot-training" class="hidden"></div>';
    body.innerHTML = html;

    body.querySelectorAll('[data-unlock]').forEach(b => b.onclick = () => {
      const r = G.Bots.unlock();
      if (!r.ok) { G.UI.toast(r.error, 2600); G.Audio.sfx('error'); return; }
      G.Audio.sfx('buy');
      render();
    });
    body.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => showPicker(+b.dataset.pick));
    body.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { G.Bots.remove(+b.dataset.remove); G.Audio.sfx('click'); render(); });
    body.querySelectorAll('[data-train-slot]').forEach(b => b.onclick = () => showTraining(+b.dataset.bot, +b.dataset.trainSlot));
    body.querySelectorAll('[data-sprite]').forEach(cv => G.UI.sprite(cv, +cv.dataset.sprite, { scale: 3, shadow: false }));
  }

  function trainingCard(dex) {
    const p = G.Bots.profile(dex), a = G.Bots.affinityOf(dex);
    return `<div class="bot-training-card" data-training="${dex}">
      <div class="bot-affinity-track"><i style="width:${Math.min(100, a.xp / a.next * 100)}%"></i></div>
      <div class="bot-attack-slots">${p.loadout.map((id, slot) => {
        const level = G.Bots.MOVE_LEVELS[slot], locked = a.level < level;
        return `<button class="btn ghost bot-attack-slot" data-bot="${dex}" data-train-slot="${slot}" ${locked ? 'disabled' : ''}>
          <small>${G.T('Nv.')} ${level} ${G.T('en la partida')}</small>
          <span>${G.Icons.html('move:' + id, 16)} ${G.T(G.Moves.BY_ID[id].name)}</span>
          <small>${G.T(locked ? 'Entrena la afinidad para configurar' : p.learned.includes(id) ? 'Aprendido · cambiar' : 'Aprende al subir de nivel')}</small>
        </button>`;
      }).join('')}</div>
    </div>`;
  }

  function showTraining(dex, slot) {
    const p = G.Bots.profile(dex), box = $('bot-training');
    box.classList.remove('hidden');
    box.innerHTML = `<div class="row between"><h3>${G.T('Entrenar ataques')} · ${G.DEX_BY[dex].name}</h3><button class="btn small ghost" id="bot-training-close">${G.T('Cerrar')}</button></div>
      <p class="sub">${G.T('Los ataques aprendidos se equipan gratis. Cada ataque nuevo cuesta')} ${G.Bots.TRAIN_COST} ${G.T('monedas')}.</p>
      <div class="bot-move-options">${G.Bots.movePool(dex).map(id => {
        const used = p.loadout.some((m, i) => i !== slot && m === id), learned = p.learned.includes(id), m = G.Moves.BY_ID[id];
        return `<button class="btn ghost bot-move-option" data-train-move="${id}" ${used ? 'disabled' : ''}>
          <span>${G.Icons.html('move:' + id, 18)} ${G.T(m.name)}</span>
          <small>${G.T(used ? 'Ya equipado' : learned ? 'Equipar gratis' : 'Comprar y equipar')}${!used && !learned ? ' · ' + G.Bots.TRAIN_COST : ''}</small>
        </button>`;
      }).join('')}</div>`;
    $('bot-training-close').onclick = () => box.classList.add('hidden');
    box.querySelectorAll('[data-train-move]').forEach(b => b.onclick = () => {
      const result = G.Bots.train(dex, slot, b.dataset.trainMove);
      if (!result.ok) { G.UI.toast(G.T(result.error)); G.Audio.sfx('error'); return; }
      G.Audio.sfx(result.cost ? 'buy' : 'confirm'); render();
    });
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function showPicker(slot) {
    const s = G.DB.save;
    const owned = Object.keys(s.owned || {}).filter(d => G.DEX_BY[d]);
    const grid = $('bot-grid');
    grid.innerHTML = owned.map(d => {
      const mon = G.DEX_BY[d];
      const usedElsewhere = G.Bots.state().party.some((p, i) => p === +d && i !== slot);
      return `<div class="cell${usedElsewhere ? ' locked' : ''}" data-dex="${d}" title="${mon.name}">
        <canvas width="48" height="48"></canvas><b>${mon.name}</b>
      </div>`;
    }).join('') || `<p class="sub">${G.T('Aún no tienes Pokémon. Consíguelos en el gacha.')}</p>`;
    $('bot-picker').classList.remove('hidden');
    grid.querySelectorAll('.cell').forEach(c => {
      c.onclick = () => {
        if (c.classList.contains('locked')) { G.UI.toast(G.T('Ese Pokémon ya es un compañero.'), 2200); G.Audio.sfx('error'); return; }
        G.Bots.assign(slot, +c.dataset.dex);
        G.Audio.sfx('confirm');
        render();
      };
    });
    grid.querySelectorAll('canvas').forEach(cv => {
      const cell = cv.closest('.cell');
      if (cell) G.UI.sprite(cv, +cell.dataset.dex, { scale: 2, shadow: false });
    });
  }

  return { open };
})();
