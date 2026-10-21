/* Separate Arena scene: survival combat and saves are never replaced. */
G.ArenaUI = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const R = G.ArenaRules, defaults = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'];
  const keys = () => { const v = G.Settings.get('arenaKeys'); return Array.isArray(v) && v.length === 4 && v.every(k => typeof k === 'string') ? v : defaults.slice(); };
  const label = code => code.replace('Numpad', 'Num ').replace('Digit', '').replace('Key', '').replace('Arrow', '');
  let visible = false, engine = null, state = null, humanId = '0:0', guest = false, roomId = null;
  let config = { dex: 0, bot: 7, mode: 'bot', name: '' }, held = new Set(), touch = { x: 0, y: 0 }, attacks = [];
  let last = 0, sendAt = 0, lastFrame = 0, readyAt = 0, panelAt = 0, phase = '', anims = new Map(), initialized = false, busy = false;
  let stage = null, stageRound = -1, seenEvent = 0, seenSerial = -1, pickerTarget = 'dex', presentationPhase = '';
  function movesFor(dex) {
    const ids = [...new Set([G.Moves.startFor(G.DEX_BY[dex]), ...G.Moves.poolFor(G.DEX_BY[dex])])];
    const moves = ids.map(id => G.Moves.BY_ID[id]).filter(m => m && m.kind !== 'buff');
    const fallback = G.Moves.ALL.filter(m => m.kind !== 'buff' && !moves.includes(m));
    return [...moves, ...fallback].slice(0, 4).map(m => ({ id: m.id, name: m.name, type: m.type }));
  }
  function spec(dex, name, human = false) {
    const mon = G.DEX_BY[dex] || G.DEX_BY[25];
    return { dex: mon.dex, name, types: mon.types, moves: movesFor(mon.dex), human };
  }
  function owned() { return [...new Set([...(Object.keys(G.DB.save?.owned || {}).map(Number)), ...G.STARTERS.map(m => m.dex)])].filter(d => G.DEX_BY[d]); }
  function options(value) { return owned().map(d => `<option value="${d}" ${d === value ? 'selected' : ''}>${esc(G.DEX_BY[d].name)}</option>`).join(''); }
  function message(s) { const el = $('arena-message'); if (el) el.textContent = s; else G.UI.toast(s); }
  function hasInvite() { return /^#arena=/i.test(location.hash); }
  function open() {
    if (visible) return;
    if (G.Coop.active || (G.Game.state !== 'ui' && G.Game.state !== 'over')) { G.UI.toast('Termine a partida atual antes de entrar na Arena.'); return; }
    visible = true; engine = null; state = null; phase = ''; guest = false; roomId = null;
    seenEvent = 0; seenSerial = -1; stage = null; stageRound = -1; presentationPhase = ''; G.FX.clear();
    config.dex = G.DB.save.partner || 1; config.name = G.Social.me?.name || G.DB.user || 'Treinador';
    G.Game.toUI(); G.UI.show('scr-arena'); G.UI.chrome(false); setup();
    last = performance.now(); requestAnimationFrame(loop);
  }
  function setup() {
    const room = G.Social.room, arenaRoom = room?.mode === 'arena';
    $('scr-arena').innerHTML = `<div class="box arena-setup"><div class="arena-heading"><div><small>CAMPEONATO EM DUPLAS</small><h1>Arena 2 × 2</h1></div><button id="arena-back" class="btn">Voltar</button></div>
      <p class="arena-intro">Oito duplas. Quartas, semifinal e final. Vença com seu Pokémon e um amigo ou bot.</p>
      <div class="arena-character-select"><div id="arena-portrait-player"></div><div class="arena-picker"><h2>ESCOLHA SEU POKÉMON</h2><div class="arena-player-tabs"><button id="arena-pick-player" class="btn small">P1 · Você</button><button id="arena-pick-bot" class="btn small">P2 · Bot</button></div><p id="arena-picker-hint" class="sub"></p><div id="arena-pokemon-grid" class="grid arena-pokemon-grid"></div></div><div id="arena-portrait-partner"></div></div>
      <div class="arena-fields"><label>Apelido<input id="arena-name" maxlength="20" value="${esc(config.name)}"></label>
      <label>Seu Pokémon<select id="arena-pokemon">${options(config.dex)}</select></label>
      <label>Sua dupla<select id="arena-partner"><option value="bot" ${config.mode === 'bot' ? 'selected' : ''}>Bot</option><option value="friend" ${config.mode === 'friend' ? 'selected' : ''}>Amigo por convite</option></select></label>
      <label>Pokémon do bot<select id="arena-bot">${options(config.bot)}</select></label></div>
      <div id="arena-preview" class="arena-preview"></div>
      <p class="sub">Quatro ataques manuais, com recargas independentes. Mire no rival mais próximo. Mova com WASD, setas ou o controle de toque. Maçãs recuperam 25% do HP; os rivais também podem pegá-las.</p>
      <div class="row wrap"><button id="arena-start" class="btn gold">Começar com bot</button><button id="arena-create" class="btn">Criar convite</button><button id="arena-controls" class="btn">Configurar teclas</button></div>
      <div class="arena-invite"><label>Entrar com amigo: cole o convite ou código<input id="arena-invite" autocomplete="off" placeholder="Link da Arena ou código"></label><button id="arena-join" class="btn">Entrar</button></div>
      <div id="arena-room" class="arena-room"></div><p id="arena-message" role="status"></p></div>`;
    $('arena-back').onclick = close;
    $('arena-controls').onclick = () => G.SettingsUI.open('ctl');
    for (const id of ['arena-name', 'arena-pokemon', 'arena-bot', 'arena-partner']) $(id).onchange = () => { readConfig(); preview(); };
    $('arena-start').onclick = start; $('arena-create').onclick = create; $('arena-join').onclick = join;
    $('arena-pick-player').onclick = () => { pickerTarget = 'dex'; renderPicker(); };
    $('arena-pick-bot').onclick = () => { pickerTarget = 'bot'; renderPicker(); };
    if (hasInvite()) $('arena-invite').value = location.href;
    if (room && !arenaRoom) {
      $('arena-room').textContent = 'Você está em uma sala de sobrevivência. Saia dela antes de criar ou entrar em uma Arena.';
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Sair da sala atual';
      b.onclick = async () => { await G.Social.leaveRoom(); setup(); }; $('arena-room').appendChild(b);
    } else if (arenaRoom) {
      roomId = room.id; guest = !room.isHost; config.mode = 'friend';
      $('arena-partner').value = 'friend'; $('arena-pokemon').disabled = true;
      $('arena-room').textContent = 'Dupla: ' + room.members.map(m => m.name).join(' + ') + (room.members.length < 2 ? ' · aguardando amigo' : ' · pronta');
      $('arena-create').textContent = 'Compartilhar convite'; $('arena-create').onclick = share;
      $('arena-join').disabled = true;
    }
    preview();
  }
  function readConfig() {
    config.dex = Number($('arena-pokemon').value); config.bot = Number($('arena-bot').value);
    config.mode = $('arena-partner').value; config.name = $('arena-name').value.trim();
  }
  function preview() {
    $('arena-preview').innerHTML = movesFor(config.dex).map((m, i) => `<div>${G.Icons.html('move:' + m.id, 24)}<b>${esc(G.T(m.name))}</b><small>${esc(R.SKILLS[i].role)} · ${R.SKILLS[i].cooldown}s · ${esc(label(keys()[i]))}</small></div>`).join('');
    const room = G.Social.room;
    $('arena-bot').disabled = config.mode !== 'bot' || room?.mode === 'arena';
    $('arena-start').textContent = room?.mode === 'arena' ? guest ? 'Aguardando anfitrião' : 'Começar com amigo' : config.mode === 'bot' ? 'Começar com bot' : 'Crie um convite para seu amigo';
    $('arena-start').disabled = busy || (!!room && (room.mode !== 'arena' || !room.isHost || room.members.length !== 2)) || (!room && config.mode === 'friend');
    $('arena-create').disabled = busy || (!!room && room.mode !== 'arena');
    renderSelection(); renderPicker();
  }
  function portrait(dex, title, name) {
    const card = document.createElement('article'); card.className = 'arena-mon-card';
    const heading = document.createElement('small'); heading.textContent = title; card.appendChild(heading);
    if (dex && G.DEX_BY[dex]) {
      const cv = G.UI.spriteCanvas(dex, 160, 190, { scale: 6, hero: true, lively: true }); cv.dataset.dex = dex;
      cv.setAttribute('aria-label', G.DEX_BY[dex].name); card.appendChild(cv);
      const h = document.createElement('b'); h.textContent = G.DEX_BY[dex].name; card.appendChild(h);
      const types = document.createElement('div'); types.innerHTML = G.UI.typeChips(G.DEX_BY[dex].types); card.appendChild(types);
    } else { const wait = document.createElement('div'); wait.className = 'arena-waiting'; wait.innerHTML = G.Icons.html('friends', 42); card.appendChild(wait); }
    const p = document.createElement('span'); p.textContent = name; card.appendChild(p); return card;
  }
  function renderSelection() {
    const box = $('arena-portrait-player'), room = G.Social.room;
    if (!box) return; box.replaceChildren(portrait(config.dex, 'P1 · SEU POKÉMON', config.name || 'Você'));
    const friend = room?.mode === 'arena' && room.members.find(m => m.uid !== G.Social.uid);
    $('arena-portrait-partner').replaceChildren(config.mode === 'bot' ? portrait(config.bot, 'P2 · PARCEIRO BOT', 'Seu companheiro na Arena') : portrait(friend?.dex, 'AMIGO CONVIDADO', friend?.name || 'Aguardando seu amigo'));
    box.classList.toggle('choosing', pickerTarget === 'dex'); $('arena-portrait-partner').classList.toggle('choosing', pickerTarget === 'bot');
    $('arena-pick-player').disabled = room?.mode === 'arena';
    $('arena-pick-bot').disabled = config.mode !== 'bot' || room?.mode === 'arena';
  }
  function renderPicker() {
    const locked = G.Social.room?.mode === 'arena';
    if (config.mode !== 'bot') pickerTarget = 'dex';
    $('arena-pick-player').classList.toggle('gold', pickerTarget === 'dex'); $('arena-pick-bot').classList.toggle('gold', pickerTarget === 'bot');
    $('arena-picker-hint').textContent = locked ? 'Dupla confirmada. Aguarde o início do campeonato.' : pickerTarget === 'dex' ? 'Escolha o seu personagem na grade.' : 'Escolha o Pokémon do seu parceiro bot.';
    const grid = $('arena-pokemon-grid'); grid.replaceChildren();
    grid.onkeydown = e => {
      const buttons = [...grid.querySelectorAll('button:not(:disabled)')], at = buttons.indexOf(document.activeElement);
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.code];
      if (move === undefined || at < 0) return; e.preventDefault();
      buttons[Math.max(0, Math.min(buttons.length - 1, at + move))].focus();
    };
    for (const dex of owned()) {
      const b = document.createElement('button'); b.className = 'cell' + (config[pickerTarget] === dex ? ' on' : ''); b.dataset.dex = dex; b.disabled = locked;
      b.setAttribute('aria-label', G.DEX_BY[dex].name); b.setAttribute('aria-pressed', String(config[pickerTarget] === dex));
      b.appendChild(G.UI.spriteCanvas(dex, 84, 74, { hero: true, scale: 2 })); const name = document.createElement('b'); name.textContent = G.DEX_BY[dex].name; b.appendChild(name);
      const inspect = () => {
        if (locked) return;
        $(pickerTarget === 'dex' ? 'arena-portrait-player' : 'arena-portrait-partner').replaceChildren(portrait(dex, pickerTarget === 'dex' ? 'P1 · SEU POKÉMON' : 'P2 · PARCEIRO BOT', 'Clique ou aperte Enter para confirmar'));
      };
      b.onfocus = b.onpointerenter = inspect;
      b.onpointerleave = () => { if (document.activeElement !== b) renderSelection(); };
      b.onclick = () => { config[pickerTarget] = dex; $(pickerTarget === 'dex' ? 'arena-pokemon' : 'arena-bot').value = String(dex); G.Audio.sfx('select'); preview(); };
      grid.appendChild(b);
    }
    $('arena-portrait-player').classList.toggle('choosing', pickerTarget === 'dex'); $('arena-portrait-partner').classList.toggle('choosing', pickerTarget === 'bot');
  }
  const choice = () => ({ dex: config.dex, source: G.DB.owns(config.dex) ? 'local' : 'starter', shiny: false });
  async function create() {
    if (busy) return; readConfig();
    if (G.Social.room) { message('Saia da sala atual antes de criar outra.'); return; }
    if (!G.Social.setName(config.name)) { message('Use um apelido de 2 a 20 letras ou números.'); return; }
    busy = true; preview();
    try { const r = await G.Social.createRoom({ mode: 'arena', choice: choice() }); if (!r.ok) throw Error(r.error); setup(); await share(); }
    catch (e) { message(e.message); } finally { busy = false; if ($('arena-start')) preview(); }
  }
  async function share() {
    try {
      const info = await (await fetch('/api/server', { cache: 'no-store' })).json();
      const base = G.Social.room.isHost ? info.publicUrl || info.localUrl || location.origin : G.Social.serverBase;
      if (/^(localhost|127\.0\.0\.1)$/.test(new URL(base).hostname)) { message('O convite público está sendo preparado. Tente compartilhar novamente em alguns segundos.'); return; }
      const link = new URL('/#arena=' + G.Social.room.id, base).href;
      if (/PokeSurvivorAndroid\//.test(navigator.userAgent)) location.href = 'pokesurvivor://share?url=' + encodeURIComponent(link);
      else if (navigator.share) await navigator.share({ title: 'Arena 2 × 2', url: link });
      else if (navigator.clipboard) await navigator.clipboard.writeText(link);
      $('arena-invite').value = link; message('Convite pronto. Envie ao seu amigo e mantenha o jogo aberto.');
    } catch (e) { if (e.name !== 'AbortError') message('Não foi possível compartilhar. Tente novamente.'); }
  }
  async function join() {
    if (busy) return; readConfig();
    if (G.Social.room) { message('Saia da sala atual antes de entrar em outra.'); return; }
    let code = $('arena-invite').value.trim();
    try {
      let base = location.origin;
      if (/^https?:\/\//i.test(code)) { const url = new URL(code); base = url.origin; code = new URLSearchParams(url.hash.slice(1)).get('arena') || ''; }
      code = code.replace(/[\s-]/g, '').toUpperCase(); if (!/^[A-F0-9]{12}$/.test(code)) throw Error('Convite da Arena inválido.');
      if (!G.Social.setName(config.name)) throw Error('Use um apelido de 2 a 20 letras ou números.');
      busy = true; G.Social.setServer(base); await G.Social.choosePokemon(choice());
      const r = await G.Social.joinRoom(code); if (!r.ok) throw Error(r.error);
      if (r.room.mode !== 'arena') { await G.Social.leaveRoom(); throw Error('Este convite é de sobrevivência. Use a tela Jogar.'); }
      guest = true; roomId = r.room.id; setup();
    } catch (e) { message(e.message); } finally { busy = false; if ($('arena-start')) preview(); }
  }
  async function start() {
    if (busy) return; readConfig(); const room = G.Social.room;
    if (room && (room.mode !== 'arena' || !room.isHost || room.members.length !== 2)) return;
    if (!room && config.mode !== 'bot') return;
    busy = true;
    try {
      if (room) { const result = await G.Social.startRun(Math.floor(Math.random() * 1000000)); if (!result.ok) throw Error(result.error); }
      guest = false; roomId = room?.id || null; humanId = '0:0';
      const friends = room ? room.members.map(m => spec(m.dex, m.name, true)) : [spec(config.dex, config.name || 'Você', true), spec(config.bot, 'Parceiro bot')];
      const pool = G.DEX.filter(m => G.SPRITE_META[m.dex]);
      const teams = [{ name: 'Sua dupla', fighters: friends }];
      for (let i = 1; i < 8; i++) teams.push({ name: 'Dupla ' + i, fighters: [0, 1].map(() => { const m = G.U.pick(pool); return spec(m.dex, m.name); }) });
      engine = new R.Tournament(teams, Math.floor(Math.random() * 0xffffffff), (type, types) => G.Types.mult(type, types));
      state = engine.state; phase = ''; scene(); sendFrame();
    } catch (e) { message(e.message); } finally { busy = false; }
  }
  function scene() {
    G.UI.hideAll(); $('scr-arena').classList.remove('hidden'); G.UI.chrome(false);
    $('scr-arena').innerHTML = `<canvas id="arena-canvas" aria-label="Campo de batalha da Arena"></canvas>
      <div class="arena-top"><div><b>Arena 2 × 2</b><span id="arena-status"></span></div><div><button id="arena-settings" class="btn small">Teclas</button><button id="arena-exit" class="btn small">Sair</button></div></div>
      <div id="arena-bracket" class="arena-bracket"></div><div id="arena-notice" role="status"></div>
      <div id="arena-stick" aria-label="Arraste para mover"><span>＋</span></div><div id="arena-attacks" class="arena-attacks"></div>`;
    $('arena-settings').onclick = () => G.SettingsUI.open('ctl'); $('arena-exit').onclick = close;
    $('arena-attacks').innerHTML = R.SKILLS.map((s, i) => `<button data-arena-attack="${i}" aria-label="Ataque ${i + 1}"><i></i><kbd></kbd><b></b><small></small></button>`).join('');
    $('arena-attacks').querySelectorAll('button').forEach(b => b.onpointerdown = e => { e.preventDefault(); attacks.push(Number(b.dataset.arenaAttack)); });
    const stick = $('arena-stick'); let origin = null;
    stick.onpointerdown = e => { e.preventDefault(); origin = { id: e.pointerId, x: e.clientX, y: e.clientY }; stick.setPointerCapture(e.pointerId); };
    stick.onpointermove = e => { if (origin?.id !== e.pointerId) return; const x = (e.clientX - origin.x) / 38, y = (e.clientY - origin.y) / 38, d = Math.max(1, Math.hypot(x, y)); touch = { x: x / d, y: y / d }; };
    stick.onpointerup = stick.onpointercancel = () => { origin = null; touch = { x: 0, y: 0 }; };
    phase = ''; held.clear(); attacks = []; lastFrame = performance.now(); renderPanel();
  }
  function bracket() {
    const s = state, box = $('arena-bracket');
    box.replaceChildren();
    const title = document.createElement('h2'); title.textContent = s.phase === 'champion' ? 'Sua dupla é campeã!' : s.phase === 'eliminated' ? 'Sua dupla foi eliminada' : s.phase === 'draw' ? 'Empate! Vamos repetir a batalha.' : ['Quartas de final', 'Semifinal', 'Final'][s.round]; box.appendChild(title);
    const rounds = document.createElement('div'); rounds.className = 'arena-rounds';
    for (let r = 0; r < 3; r++) {
      const col = document.createElement('div'); col.className = 'arena-round';
      const h = document.createElement('h3'); h.textContent = ['Quartas', 'Semifinal', 'Final'][r]; col.appendChild(h);
      for (const m of s.rounds[r] || Array.from({ length: 4 >> r }, () => ({ a: null, b: null, winner: null }))) {
        const card = document.createElement('div'); card.className = 'arena-match';
        for (const team of [m.a, m.b]) { const row = document.createElement('div'); row.textContent = team === null ? 'A definir' : s.teams[team].name;
          if (team !== null) { const portraits = document.createElement('span'); portraits.className = 'arena-bracket-mons'; for (const f of s.teams[team].fighters) portraits.appendChild(G.UI.spriteCanvas(f.dex, 32, 28, { hero: true, scale: 1 })); row.prepend(portraits); }
          if (team !== null) { row.title = s.teams[team].fighters.map(f => G.DEX_BY[f.dex].name).join(' + '); if (m.winner === team) row.classList.add('winner'); if (team === 0) row.classList.add('your-team'); } card.appendChild(row); }
        col.appendChild(card);
      }
      rounds.appendChild(col);
    }
    box.appendChild(rounds);
    const p = document.createElement('p'); p.textContent = s.champion !== null ? 'Campeã: ' + s.teams[s.champion].name : 'Cada rodada começa com HP cheio e as quatro recargas prontas. As outras chaves são simuladas.'; box.appendChild(p);
    if (!guest && ['bracket', 'draw'].includes(s.phase)) { const b = document.createElement('button'); b.id = 'arena-next'; b.className = 'btn gold'; b.textContent = s.phase === 'draw' ? 'Repetir batalha' : 'Entrar na batalha'; b.onclick = () => { if (s.phase === 'draw') engine.rematch(); else engine.begin(); renderPanel(); sendFrame(); }; box.appendChild(b); }
    else if (guest && s.phase === 'bracket') { const p = document.createElement('p'); p.textContent = 'Aguardando o anfitrião iniciar a rodada.'; box.appendChild(p); }
    if (['champion', 'eliminated'].includes(s.phase)) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Voltar ao menu'; b.onclick = close; box.appendChild(b); }
  }
  function renderPanel() {
    if (!state || !$('arena-canvas')) return;
    const battle = state.phase === 'battle';
    $('arena-bracket').classList.toggle('hidden', battle); $('arena-stick').classList.toggle('hidden', !battle); $('arena-attacks').classList.toggle('hidden', !battle);
    if (phase !== state.phase + state.round) { phase = state.phase + state.round; if (!battle) bracket(); }
    const fighter = state.fighters.find(f => f.id === humanId);
    $('arena-status').textContent = ['Quartas', 'Semifinal', 'Final'][Math.min(state.round, 2)] + (battle ? ' · ' + Math.ceil(Math.max(0, 90 - state.time)) + 's' : '');
    $('arena-notice').textContent = guest && performance.now() - lastFrame > 2500 ? 'Aguardando conexão com o anfitrião…' : battle && fighter?.hp <= 0 ? 'Você caiu. Sua dupla ainda pode vencer!' : battle && state.time > 90 ? 'Prorrogação: todos perdem HP até restar uma dupla.' : '';
    if (fighter) $('arena-attacks').querySelectorAll('button').forEach((b, i) => {
      const cd = fighter.cooldowns[i]; b.disabled = fighter.hp <= 0 || cd > 0 || G.SettingsUI.isOpen;
      if (b.dataset.move !== fighter.moves[i].id) { b.dataset.move = fighter.moves[i].id; b.querySelector('i').innerHTML = G.Icons.html('move:' + fighter.moves[i].id, 24); }
      b.querySelector('kbd').textContent = label(keys()[i]); b.querySelector('b').textContent = G.T(fighter.moves[i].name);
      b.querySelector('small').textContent = cd > 0 ? cd.toFixed(1) + 's' : R.SKILLS[i].role;
      b.style.setProperty('--attack-color', G.U.TYPE_COLOR[fighter.moves[i].type] || '#ffcb3d');
    });
  }
  function nativeStage(round) {
    if (stage && stageRound === round) return stage;
    stageRound = round; stage = document.createElement('canvas'); stage.width = R.WIDTH; stage.height = R.HEIGHT;
    const ctx = stage.getContext('2d'), bi = round % G.Tiles.NORMAL, size = 16 * G.Tiles.T * G.Sprites.PX;
    ctx.imageSmoothingEnabled = false;
    const terrain = (x, y) => x <= 0 || x >= 34 || y <= 0 || y >= 20 ? 'wall' : 'floor';
    const dirt = (x, y) => Math.hypot(x - R.WIDTH / 4, y - R.HEIGHT / 4) < 115 || Math.abs(y - R.HEIGHT / 4) < 24 ? 0.85 : 0.2;
    for (let y = 0; y * size < R.HEIGHT; y++) for (let x = 0; x * size < R.WIDTH; x++) {
      const tile = G.Tiles.paintChunk(x, y, 16, terrain, dirt, bi, 7321);
      ctx.drawImage(tile, x * size, y * size, size, size);
    }
    for (const x of [12, R.WIDTH - 10]) for (const y of [120, 320, 530]) {
      const tree = G.Tiles.propSprite(bi, 'tree'); ctx.drawImage(tree, x - tree.width, y - tree.height * 2, tree.width * 2, tree.height * 2);
    }
    return stage;
  }
  function present(dt) {
    const s = state, key = s.phase + ':' + s.serial;
    if (s.serial !== seenSerial) { seenSerial = s.serial; G.FX.clear(); anims.clear(); }
    if (key !== presentationPhase) {
      if (s.phase === 'battle') { G.Audio.music(G.BIOME_MUSIC[s.round % 3]); G.Audio.sfx('boss'); }
      else if (s.phase === 'champion') { G.Audio.music('village'); G.Audio.sfx('legend'); }
      else if (s.phase === 'eliminated') { G.Audio.music('village'); G.Audio.sfx('gameover'); }
      else if (s.phase === 'bracket' && presentationPhase.startsWith('battle')) { G.Audio.music('village'); G.Audio.sfx('levelup'); }
      presentationPhase = key;
    }
    for (const e of s.events || []) {
      if (e.id <= seenEvent) continue; seenEvent = e.id;
      const move = G.Moves.BY_ID[e.move] || { id: '', type: e.type || 'normal' }, vis = G.VFX.forMove(move), col = G.U.TYPE_COLOR[e.type] || '#fff';
      if (e.kind === 'cast') {
        const kind = e.index === 2 ? 'melee' : e.index === 3 ? 'nova' : move.kind || 'projectile';
        G.Audio.sfx('shot', { kind, type: e.type });
        if (e.index < 2) { G.FX.sp('impact', vis.pal, e.x + Math.cos(e.angle) * 24, e.y - G.LIFT + Math.sin(e.angle) * 24, { life: 0.15, scale: 1 }); }
        else if (e.index === 2) {
          for (let d = 0; d < R.SKILLS[2].range; d += 28) G.FX.sp(vis.proj, vis.pal, e.x + Math.cos(e.angle) * d, e.y + Math.sin(e.angle) * d - G.LIFT, { life: 0.25, angle: e.angle });
          G.FX.slash(e.x + Math.cos(e.angle) * 120, e.y + Math.sin(e.angle) * 120 - G.LIFT, e.angle, 60, 2.3, col, vis);
        } else {
          G.FX.ring(e.x, e.y, 12, R.SKILLS[3].range, col, 0.45, 4);
          for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; G.FX.sp(vis.aura || vis.proj, vis.pal, e.x, e.y - G.LIFT, { vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, angle: a, life: 0.5 }); }
        }
      } else if (e.kind === 'hit') {
        G.FX.sp('impact', vis.pal, e.x, e.y - 24, { life: 0.18, scale: 1.2, fade: false });
        G.FX.burst(e.x, e.y - 20, col, 5, 85); G.FX.dmgText(e.x, e.y - 60, e.amount, '#fff');
        G.Audio.sfx(e.faint ? 'faint' : e.fighter === humanId ? 'hurt' : 'hit');
      } else if (e.kind === 'heal') {
        G.FX.ring(e.x, e.y, 5, 44, '#73ed94', 0.5, 3); G.FX.sp('heart', 'grass', e.x, e.y - 24, { vy: -45, life: 0.6 });
        G.FX.dmgText(e.x, e.y - 60, '+' + e.amount + ' HP', '#87ff9d'); G.Audio.sfx('heal');
      }
    }
    G.FX.update(dt);
  }
  function draw(dt) {
    const cv = $('arena-canvas'); if (!cv || !state) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5), width = cv.clientWidth, height = cv.clientHeight;
    if (cv.width !== Math.round(width * dpr) || cv.height !== Math.round(height * dpr)) { cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr); }
    const ctx = cv.getContext('2d'), scale = Math.min(width / R.WIDTH, height / R.HEIGHT), ox = (width - R.WIDTH * scale) / 2, oy = (height - R.HEIGHT * scale) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#091424'; ctx.fillRect(0, 0, width, height); ctx.translate(ox, oy); ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(nativeStage(state.round), 0, 0);
    for (const a of state.apples) {
      const y = a.y - (a.fall || 0) * 180;
      ctx.fillStyle = '#0005'; ctx.beginPath(); ctx.ellipse(a.x, a.y + 8, 15, 6, 0, 0, 7); ctx.fill();
      G.Icons.draw(ctx, 'berry', a.x - 15, y - 22, 30);
      ctx.font = '12px Pixelify, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#c8ffd3'; ctx.fillText('+25% HP', a.x, y + 18);
    }
    for (const p of state.shots) {
      const move = G.Moves.BY_ID[p.move] || { id: '', type: p.type }, vis = G.VFX.forMove(move);
      const angle = G.VFX.isDir(vis.proj) ? Math.atan2(p.vy, p.vx) : G.VFX.spins(vis.proj) ? state.time * 9 : 0;
      G.VFX.draw(ctx, vis.proj, vis.pal, p.x, p.y - G.LIFT, { angle, scale: 1.5, frame: Math.floor(state.time * 12) });
      if (vis.trail && Math.random() < dt * 20) G.FX.trail(vis.trail, vis.pal, p.x, p.y - G.LIFT, p.vx, p.vy);
    }
    for (const f of state.fighters.slice().sort((a, b) => a.y - b.y)) {
      let anim = anims.get(f.id + ':' + f.dex);
      if (!anim) { anim = new G.Sprites.Animator(f.dex, Math.min(1.4, 60 / G.Sprites.bodyHeight(f.dex))); anims.set(f.id + ':' + f.dex, anim); G.Sprites.preload([f.dex], 8000, false); }
      anim.loop(f.hp <= 0 ? 'Faint' : f.cast > 0 ? 'Attack' : f.moving ? 'Walk' : 'Idle'); anim.dir = G.Sprites.dirFromAngle(f.angle); anim.update(dt);
      ctx.globalAlpha = f.hp > 0 ? 1 : 0.35; G.Sprites.drawShadow(ctx, f.dex, f.x, f.y, anim.scale);
      ctx.strokeStyle = f.team === 0 ? '#68def0' : '#ff7183'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y + 2, 25, 10, 0, 0, 7); ctx.stroke();
      anim.draw(ctx, f.x, f.y, { flash: f.flash > 0, alpha: f.hp > 0 ? 1 : 0.35 }); ctx.globalAlpha = 1;
      ctx.font = '17px Pixelify, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#081323'; ctx.lineWidth = 4;
      const name = f.name + (f.id === humanId ? ' · VOCÊ' : ''); ctx.strokeText(name, f.x, f.y - 72); ctx.fillText(name, f.x, f.y - 72);
      ctx.fillStyle = '#081323'; ctx.fillRect(f.x - 43, f.y - 62, 86, 11); ctx.fillStyle = f.hp < 60 ? '#ff6a74' : '#64dfac'; ctx.fillRect(f.x - 41, f.y - 60, 82 * f.hp / f.maxHp, 7);
      ctx.font = '13px Pixelify, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(Math.ceil(f.hp) + ' / ' + f.maxHp, f.x, f.y - 34);
    }
    G.FX.draw(ctx);
  }
  function sendFrame(to) {
    if (!engine || !roomId) return;
    const msg = { k: 'arena-frame', room: roomId, state: engine.state };
    if (to) G.Net.send(to, msg); else G.Net.broadcast(msg);
  }
  function loop(now) {
    if (!visible) return; const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (state) {
      const blocked = G.SettingsUI.isOpen || document.hidden;
      const x = blocked ? 0 : touch.x || ((held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0));
      const y = blocked ? 0 : touch.y || ((held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0));
      if (now - sendAt > 50) {
        const input = { x, y, attack: blocked ? undefined : attacks.shift() };
        if (guest) G.Net.toHost({ k: 'arena-input', room: roomId, ...input }); else engine.input(humanId, input);
        sendAt = now;
      }
      if (!guest) { if (roomId || !blocked) engine.step(dt); if (now - readyAt > 85) { sendFrame(); readyAt = now; } }
      present(!roomId && blocked ? 0 : dt);
      if (now - panelAt > 80 || phase !== state.phase + state.round) { renderPanel(); panelAt = now; } draw(dt);
    } else if (guest && now - readyAt > 1000 && G.Social.room?.run) { G.Net.toHost({ k: 'arena-ready', room: roomId }); readyAt = now; }
    requestAnimationFrame(loop);
  }
  async function close() {
    if (busy) return;
    visible = false; engine = null; state = null; held.clear(); touch = { x: 0, y: 0 }; attacks = []; anims.clear(); G.FX.clear(); stage = null;
    $('scr-arena').classList.add('hidden');
    if (G.Social.room?.mode === 'arena') await G.Social.leaveRoom();
    roomId = null; if (hasInvite()) history.replaceState(null, '', location.pathname + location.search);
    G.Flow.goMenu();
  }
  function init() {
    if (initialized) return; initialized = true;
    addEventListener('keydown', e => {
      if (!visible || !state || G.SettingsUI.isOpen || e.target.matches('input,select,textarea')) return;
      if (e.code === 'Escape') { e.preventDefault(); G.Input.endFrame(); held.clear(); G.SettingsUI.open('ctl'); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const index = keys().indexOf(e.code);
      if (index >= 0) { e.preventDefault(); if (!e.repeat && attacks.length < 4) attacks.push(index); }
      held.add(e.code);
    });
    addEventListener('keyup', e => held.delete(e.code)); addEventListener('blur', () => { held.clear(); attacks = []; touch = { x: 0, y: 0 }; });
    G.Social.on(() => {
      if (!visible) return;
      const room = G.Social.room;
      if (roomId && (!room || room.id !== roomId)) { visible = false; state = null; engine = null; roomId = null; G.FX.clear(); stage = null; $('scr-arena').classList.add('hidden'); G.UI.toast('A sala da Arena foi encerrada.'); G.Flow.goMenu(); return; }
      if (room?.mode === 'arena') {
        roomId = room.id; guest = !room.isHost;
        if (engine) {
          const friend = room.members.find(m => m.uid !== room.host);
          engine.state.teams[0].fighters[1].human = !!friend;
          const f = engine.state.fighters.find(f => f.id === '0:1'); if (f) f.human = !!friend;
          if (!friend) G.UI.toast('Seu amigo saiu. Um bot assumiu a vaga.');
        } else if ($('arena-start')) { readConfig(); setup(); }
      }
    });
    G.Net.on((from, msg) => {
      const room = G.Social.room;
      if (!visible || !room || room.mode !== 'arena' || msg?.room !== room.id) return;
      if (room.isHost && engine && room.members.some(m => m.uid === from && m.uid !== room.host)) {
        if (msg.k === 'arena-input') engine.input('0:1', msg);
        if (msg.k === 'arena-ready') sendFrame(from);
      } else if (!room.isHost && from === room.host && msg.k === 'arena-frame' && room.run && msg.state?.teams?.length === 8) {
        state = msg.state; humanId = '0:1'; guest = true; roomId = room.id;
        if (!$('arena-canvas')) scene(); lastFrame = performance.now();
      }
    });
  }
  return { init, open, close, hasInvite, keys, keyLabel: label, defaults, get state() { return state; }, get active() { return visible; } };
})();
