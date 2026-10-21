/* Account-free invitations. The room server lives on the host's computer. */
(() => {
  const texts = {
    'Configura tu equipo e invita amigos': ['Configure sua equipe e convide amigos', 'Set up your team and invite friends'],
    'Pega el enlace de un amigo': ['Cole o link de um amigo', 'Paste a friend’s link'],
    'Entrar por invitación': ['Entrar por convite', 'Join by invitation'],
    'Equipo e invitación': ['Equipe e convite', 'Team and invitation'],
    'Amigo invitado': ['Amigo convidado', 'Invited friend'],
    'Bot · un amigo puede ocupar su lugar': ['Bot · um amigo pode ocupar seu lugar', 'Bot · a friend can take this slot'],
    'Esperando un amigo': ['Aguardando um amigo', 'Waiting for a friend'],
    'Continuar partida': ['Continuar partida', 'Continue game'],
    'jugadores': ['jogadores', 'players'],
    'Los amigos pueden entrar durante la partida y reemplazar bots.': ['Os amigos podem entrar durante a partida e substituir bots.', 'Friends can join during the game and replace bots.'],
    'Puedes jugar ya. Comparte el enlace para que entren tus amigos.': ['Você já pode jogar. Compartilhe o link para seus amigos entrarem.', 'You can play now. Share the link so your friends can join.'],
    'Conectando con tus amigos…': ['Conectando com seus amigos…', 'Connecting to your friends…'],
    'Consigue otro Pokémon para añadir un bot.': ['Consiga outro Pokémon para adicionar um bot.', 'Get another Pokémon to add a bot.'],
    'La sala está llena (máximo 4).': ['A sala está cheia: já tem 4 jogadores.', 'The room is full: 4 players have joined.'],
    'Enlace de sala inválido.': ['Link de sala inválido.', 'Invalid room link.'],
    'Elige un Pokémon distinto de tu colección para cada bot.': ['Escolha um Pokémon diferente da sua coleção para cada bot.', 'Choose a different Pokémon from your collection for each bot.'],
    'Ese hueco está ocupado por un jugador.': ['Essa vaga está ocupada por um jogador.', 'That slot is occupied by a player.'],
    'Sólo el anfitrión puede cambiar los huecos.': ['Só o anfitrião pode alterar as vagas.', 'Only the host can change slots.'],
    'Elige bots o reserva huecos para amigos. Puedes empezar sin esperar.': ['Escolha bots ou reserve vagas para amigos. Você pode começar sem esperar.', 'Choose bots or reserve slots for friends. You can start without waiting.'],
    'La partida está en marcha. Comparte el enlace para invitar amigos.': ['A partida está em andamento. Compartilhe o link para convidar amigos.', 'The game is running. Share the link to invite friends.'],
    'Jugar con amigos': ['Jogar com amigos', 'Play with friends'],
    'Sin cuenta · enlace o código · hasta 4': ['Sem conta · link ou código · até 4', 'No account · link or code · up to 4'],
    'Sin cuenta, sin contraseña. Sólo tu apodo y el enlace de la sala.': ['Sem conta, sem senha. Apenas seu apelido e o link da sala.', 'No account or password. Just your nickname and the room link.'],
    'Tu apodo': ['Seu apelido', 'Your nickname'], 'Cómo te verán tus amigos': ['Como seus amigos verão você', 'How your friends will see you'],
    'Crear sala': ['Criar sala', 'Create room'], '¿Tienes una invitación?': ['Recebeu um convite?', 'Have an invitation?'],
    'Código o enlace de la sala': ['Código ou link da sala', 'Room code or link'], 'Entrar en la sala': ['Entrar na sala', 'Join room'],
    'Código de la sala': ['Código da sala', 'Room code'], 'Enlace para tu amigo': ['Link para seu amigo', 'Link for your friend'],
    'Copiar enlace': ['Copiar link', 'Copy link'], 'Compartir invitación': ['Compartilhar convite', 'Share invitation'],
    'Sin cuenta: crea una sala o introduce el código de tu amigo.': ['Sem conta: crie uma sala ou informe o código do seu amigo.', 'No account: create a room or enter your friend’s code.'],
    'Preparando el enlace público… espera unos segundos y vuelve a abrir esta pantalla.': ['Preparando o link público… aguarde alguns segundos e abra esta tela novamente.', 'Preparing the public link… wait a few seconds and reopen this screen.'],
    'Para jugar online, abre Jogar Online.bat en el ordenador del anfitrión.': ['Para jogar online, abra Jogar Online.bat no computador do anfitrião.', 'To play online, open Jogar Online.bat on the host’s computer.'],
    'Abre el juego con Jogar Online.bat.': ['Abra o jogo com Jogar Online.bat.', 'Open the game with Jogar Online.bat.'],
    'Usa un apodo de 2 a 20 letras o números.': ['Use um apelido de 2 a 20 letras ou números.', 'Use a nickname of 2 to 20 letters or numbers.'],
    'Introduce un código de 12 caracteres o un enlace de este mismo juego.': ['Informe um código de 12 caracteres ou um link deste mesmo jogo.', 'Enter a 12-character code or a link from this same game.'],
    'Comparte el enlace y espera a tus amigos. Hasta 4 jugadores.': ['Compartilhe o link e aguarde seus amigos. Até 4 jogadores.', 'Share the link and wait for your friends. Up to 4 players.'],
    'El anfitrión empezará la partida para todos.': ['O anfitrião iniciará a partida para todos.', 'The host will start the game for everyone.'],
    'El túnel todavía no está listo. Espera y vuelve a abrir la sala.': ['O túnel ainda não está pronto. Aguarde e abra a sala novamente.', 'The tunnel is not ready yet. Wait and reopen the room.'],
    'Envía este enlace a tu amigo. No necesita instalar nada ni crear cuenta.': ['Envie este link ao seu amigo. Ele não precisa instalar nada nem criar conta.', 'Send this link to your friend. No installation or account required.'],
    'Conexión directa': ['Conexão direta', 'Direct connection'], 'Conectado por el túnel': ['Conectado pelo túnel', 'Connected through the tunnel'],
    'Esperando a tu amigo…': ['Aguardando seu amigo…', 'Waiting for your friend…'], 'Todos conectados. Ya puedes empezar.': ['Todos conectados. Você já pode começar.', 'Everyone is connected. You can start.'],
    'Espera a que el anfitrión empiece.': ['Aguarde o anfitrião começar.', 'Wait for the host to start.'],
    '¡Entra en mi sala!': ['Entre na minha sala!', 'Join my room!'], 'Enlace copiado': ['Link copiado', 'Link copied'],
    'Selecciona y copia el enlace de la sala.': ['Selecione e copie o link da sala.', 'Select and copy the room link.'],
    'No se pudo conectar. Comprueba que el anfitrión sigue conectado.': ['Não foi possível conectar à sala. Confira se o anfitrião está com o jogo aberto e peça um novo convite.', 'Could not connect to the room. Check that the host has the game open and ask for a new invitation.'],
    'Abre el enlace completo de invitación en el navegador.': ['Abra o link completo do convite no navegador.', 'Open the full invitation link in your browser.'],
    'Se perdió la conexión con el anfitrión.': ['A conexão com o anfitrião foi perdida.', 'The connection to the host was lost.'],
    'Esa sala ya no existe. Pide un nuevo enlace.': ['Essa sala não existe mais. Peça um novo link.', 'This room no longer exists. Ask for a new link.'],
    'Elige tu Pokémon antes de entrar.': ['Escolha seu Pokémon antes de entrar.', 'Choose your Pokémon before joining.'],
    'La sala no respondió. Inténtalo de nuevo.': ['A sala não respondeu. Tente novamente.', 'The room did not respond. Try again.'],
    'Sin cuenta: tu progreso se guarda en este navegador. Las salas son temporales.': ['Sem conta: seu progresso fica salvo neste navegador. As salas são temporárias.', 'No account: your progress is saved in this browser. Rooms are temporary.'],
    'Esta versión no pide cuenta, correo, contraseña ni teléfono. Tu progreso se guarda sólo en este navegador. Cada dirección temporal tiene su propio guardado.': ['Esta versão não pede conta, e-mail, senha nem telefone. Seu progresso fica salvo apenas neste navegador. Cada endereço temporário tem seu próprio salvamento.', 'This version asks for no account, email, password or phone. Progress is saved only in this browser. Each temporary address has its own save.'],
    'Para jugar en grupo, el apodo y el Pokémon se comparten con los miembros de tu sala. Las salas viven en la memoria del ordenador del anfitrión y se eliminan al cerrarlo.': ['Para jogar em grupo, o apelido e o Pokémon são compartilhados com os participantes da sua sala. As salas ficam na memória do computador do anfitrião e são apagadas ao encerrá-lo.', 'Your nickname and Pokémon are shared with your room. Rooms live in the host computer’s memory and are removed when it closes.'],
    'Para borrar el progreso local, borra los datos de este sitio en tu navegador.': ['Para apagar o progresso local, apague os dados deste site no navegador.', 'To delete local progress, clear this site’s data in your browser.']
  };
  if (G.I18n.lang !== 'es') G.I18n.add(Object.fromEntries(Object.entries(texts).map(([key, values]) => [key, values[G.I18n.lang === 'pt' ? 0 : 1]])));
  const $ = id => document.getElementById(id);
  let pendingCode = '', publicBase = '', busy = false, androidServer = false, localBase = '', internetBase = '', tunnelMessage = '';
  let available = [], picked = null, source = 'host', editing = false, joinCode = '';
  function normalizeCode(value) {
    value = String(value || '').trim();
    if (/^https?:\/\//i.test(value)) {
      try {
        const u = new URL(value);
        if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return '';
        value = new URLSearchParams(u.hash.slice(1)).get('sala') || '';
      } catch { return ''; }
    }
    const code = value.replace(/[\s-]/g, '').toUpperCase();
    return /^[A-F0-9]{12}$/.test(code) ? code : '';
  }
  function notice(text, bad = false) { $('room-msg').textContent = text; $('room-msg').className = bad ? 'err' : 'note'; }
  function invitation() { const u = new URL('/', publicBase || location.origin); u.hash = 'sala=' + G.Social.room.id; return u.href; }
  async function serverInfo() {
    try {
      const r = await fetch('/api/server', { cache: 'no-store' });
      const data = r.ok ? await r.json() : null;
      if (data?.online) {
        androidServer = !!data.android;
        localBase = data.localUrl || '';
        internetBase = data.internetUrl || '';
        tunnelMessage = data.tunnelMessage || '';
        publicBase = data.publicUrl || '';
        if (androidServer) {
          notice((data.tunnelMessage || '') + (localBase ? ' Wi-Fi: ' + localBase : ' Conecte ao Wi-Fi para convidar pela rede local.'));
          return;
        }
        notice(publicBase || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
          ? 'Sin cuenta: crea una sala o introduce el código de tu amigo.'
          : 'Preparando el enlace público… espera unos segundos y vuelve a abrir esta pantalla.');
        return;
      }
    } catch { /* missing room server */ }
    notice('Para jugar online, abre Jogar Online.bat en el ordenador del anfitrión.', true);
  }
  function openJoin() {
    if (G.Social.room) { G.LobbyUI.open(); return; }
    G.UI.show('scr-friends', true);
    $('room-form').classList.remove('hidden'); $('room-pokemon').classList.add('hidden');
    try { $('room-name').value = localStorage.getItem('ps.roomName') || ''; } catch { /* unavailable */ }
    $('room-code').value = pendingCode; serverInfo();
  }
  async function open(mode) {
    if (G.Social.room?.mode === 'arena') { G.UI.toast('Saia da sala da Arena antes de entrar no Rogue.'); return; }
    if (G.Social.room) {
      if (mode === 'rogue' && G.Social.room.isHost && !G.Social.room.run) await G.Social.setSlots(G.Social.room.slots, 'rogue');
      G.LobbyUI.open(); return;
    }
    if (pendingCode) { openJoin(); return; }
    if (busy) return;
    const name = String(G.DB.user || 'Jogador').replace(/[^\p{L}\p{N}_ -]/gu, '').slice(0, 20);
    G.Social.setName(name.length >= 2 ? name : 'Jogador');
    busy = true;
    try {
      const r = await G.Social.createRoom({ mode });
      if (!r.ok) { openJoin(); $('room-create').classList.remove('hidden'); notice(r.error, true); return; }
      G.LobbyUI.open();
    } finally { busy = false; if (G.Social.room) render(); }
  }
  async function enter(join) {
    if (busy) return;
    if (!G.Social.setName($('room-name').value)) { notice('Usa un apodo de 2 a 20 letras o números.', true); return; }
    const code = join ? normalizeCode($('room-code').value) : '';
    if (join && !code) { notice('Introduce un código de 12 caracteres o un enlace de este mismo juego.', true); return; }
    busy = true; $('room-create').disabled = $('room-join').disabled = true; notice('Conectando…');
    try {
      if (join) {
        const input = $('room-code').value.trim();
        G.Social.setServer(/^https?:\/\//i.test(input) ? new URL(input).origin : location.origin);
        const r = await G.Social.roomCatalog(code);
        if (!r.ok) { notice(r.error, true); return; }
        pendingCode = input;
        available = r.catalog || []; joinCode = code; editing = false;
        source = G.Social.catalog().length ? 'local' : 'host'; picked = null;
        showPokemon(); return;
      }
      const r = await G.Social.createRoom();
      if (!r.ok) { notice(r.error, true); return; }
      pendingCode = '';
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      await serverInfo(); G.LobbyUI.open();
    } catch (e) { notice(e.message, true); }
    finally { busy = false; $('room-create').disabled = $('room-join').disabled = false; }
  }
  function showPokemon() {
    G.UI.show('scr-friends', true);
    $('room-form').classList.add('hidden'); $('room-pokemon').classList.remove('hidden');
    $('room-pokemon-title').textContent = G.T('Elige tu Pokémon para esta sala');
    $('room-pokemon-host').textContent = G.T('Colección del anfitrión');
    $('room-pokemon-local').textContent = G.T('Mi colección');
    $('room-pokemon-host').classList.toggle('gold', source === 'host');
    $('room-pokemon-local').classList.toggle('gold', source === 'local');
    $('room-pokemon-back').textContent = G.T('Volver'); $('room-pokemon-ok').textContent = G.T('Elegir y entrar');
    $('room-pokemon-note').textContent = G.T(source === 'host'
      ? 'Iniciales y Pokémon del anfitrión. Los prestados usan atributos base y no se añaden a tu colección.'
      : 'Tus Pokémon usan las mejoras, la variante shiny y el ataque inicial guardados en este dispositivo. Los iniciales nuevos usan atributos base.');
    const entries = new Map(G.STARTERS.map(s => [s.dex, { dex: s.dex, shiny: false }]));
    for (const entry of source === 'host' ? available : G.Social.catalog()) if (G.DEX_BY[entry.dex]) entries.set(entry.dex, entry);
    const grid = $('room-pokemon-grid'); grid.replaceChildren();
    picked = null; $('room-pokemon-ok').disabled = true; $('room-pokemon-stats').textContent = '';
    for (const entry of [...entries.values()].sort((a, b) => a.dex - b.dex)) for (const shiny of entry.shiny ? [false, true] : [false]) {
      const mon = G.DEX_BY[entry.dex], cell = document.createElement('button');
      cell.type = 'button'; cell.className = 'cell'; cell.dataset.dex = entry.dex; cell.dataset.shiny = String(shiny);
      cell.appendChild(G.UI.spriteCanvas(entry.dex, 92, 80, { scale: 2, shiny }));
      const title = document.createElement('b'); title.textContent = mon.name + (shiny ? ' ✨' : ''); cell.appendChild(title);
      cell.onclick = () => {
        grid.querySelectorAll('.on').forEach(c => c.classList.remove('on')); cell.classList.add('on');
        const own = source === 'local' && G.DB.owns(entry.dex);
        picked = { dex: entry.dex, shiny, source: source === 'host' ? 'host' : own ? 'local' : 'starter' };
        const perks = G.Upgrades.perks(own ? G.DB.upgradesOf(entry.dex) : {});
        $('room-pokemon-stats').textContent = `${mon.name} · HP ${Math.round(mon.hp + perks.hp)} · ${G.T('Daño')} ×${perks.atkMul.toFixed(2)} · ${G.T('Velocidad')} ×${perks.spdMul.toFixed(2)} · ${G.T('Movimiento inicial')}: ${G.T(G.Moves.BY_ID[own ? G.startMoveOf(entry.dex) : G.baseStartOf(entry.dex)].name)}`;
        $('room-pokemon-ok').disabled = false;
      };
      grid.appendChild(cell);
    }
    notice('');
  }
  async function confirmPokemon() {
    if (!picked || busy) return;
    busy = true; $('room-pokemon-ok').disabled = true;
    try {
      const selected = await G.Social.choosePokemon(picked);
      if (!selected.ok) { notice(selected.error, true); return; }
      const r = editing ? selected : await G.Social.joinRoom(joinCode);
      if (!r.ok) { notice(r.error, true); return; }
      pendingCode = '';
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      if (G.Social.room?.mode === 'arena') G.ArenaUI.open(); else G.LobbyUI.open();
    } catch (e) { notice(e.message, true); }
    finally { busy = false; $('room-pokemon-ok').disabled = false; }
  }
  function backToGame() {
    if (busy) return;
    if (G.Social.room) { G.LobbyUI.open(); return; }
    pendingCode = ''; G.Social.stop();
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    G.Flow.afterLoad();
  }
  function render() {
    const room = G.Social.room; if (!room) return;
    $('lobby-mode').value = room.mode === 'rogue' ? 'rogue' : 'survival';
    $('lobby-mode').disabled = !room.isHost || !!room.run;
    $('lobby-rogue-note').classList.toggle('hidden', room.mode !== 'rogue');
    $('lobby-menu').classList.toggle('hidden', !G.DB.save.partner || !!room.run);
    $('lobby-choose').classList.toggle('hidden', !room.open || !!room.run);
    $('lobby-join-form').classList.toggle('hidden', !!room.run);
    $('lobby-invitation').classList.toggle('hidden', !room.isHost);
    $('lobby-sub').textContent = room.run ? 'La partida está en marcha. Comparte el enlace para invitar amigos.' : room.isHost ? 'Elige bots o reserva huecos para amigos. Puedes empezar sin esperar.' : 'El anfitrión empezará la partida para todos.';
    $('lobby-code').value = room.id.match(/.{1,4}/g).join('-'); $('lobby-link').value = invitation();
    const localOnly = /^(localhost|127\.0\.0\.1)$/.test(new URL(invitation()).hostname);
    $('lobby-copy').disabled = $('lobby-share').disabled = localOnly;
    $('lobby-link-note').textContent = localOnly ? 'El túnel todavía no está listo. Espera y vuelve a abrir la sala.' : 'Envía este enlace a tu amigo. No necesita instalar nada ni crear cuenta.';
    $('lobby-wifi').classList.toggle('hidden', !androidServer || !localBase);
    if (androidServer) $('lobby-link-note').textContent = internetBase
      ? 'Convite pela internet pronto. Para a mesma rede, use Compartilhar Wi-Fi. Mantenha o jogo aberto no celular anfitrião.'
      : tunnelMessage + (localBase ? ' O convite atual funciona somente no mesmo Wi-Fi.' : ' Conecte ao Wi-Fi ou aguarde o convite pela internet.');
    const box = $('lobby-members'); box.replaceChildren();
    for (let i = 0; i < 4; i++) {
      const m = room.members.find(m => (m.slot ?? room.members.indexOf(m)) === i);
      const bot = (room.bots || []).find(b => b.slot === i);
      const card = document.createElement('div'); card.className = 'lob-card' + (m || bot ? '' : ' empty');
      if (m) {
        card.style.setProperty('--pc', G.Coop.COLORS[i]);
        card.appendChild(G.UI.spriteCanvas(m.dex, 120, 96, { scale: 2, lively: true, shiny: !!m.shiny }));
        const title = document.createElement('b'); title.setAttribute('translate', 'no'); title.textContent = m.name; card.appendChild(title);
        const monLabel = document.createElement('small'); monLabel.setAttribute('translate', 'no');
        monLabel.textContent = G.DEX_BY[m.dex].name + ' · ' + G.T(m.source === 'host' ? 'Prestado' : m.source === 'starter' ? 'Inicial' : 'Colección propia'); card.appendChild(monLabel);
        const state = document.createElement('small'), mode = G.Net.mode(m.uid);
        state.textContent = m.uid === room.host ? 'Anfitrión' : !room.isHost ? 'En la sala' : mode === 'direct' ? 'Conexión directa' : mode === 'relay' ? 'Conectado por el túnel' : 'Conectando…';
        card.appendChild(state);
      } else {
        if (bot) {
          card.appendChild(G.UI.spriteCanvas(bot.dex, 120, 96, { scale: 2, lively: true }));
          const title = document.createElement('b'); title.textContent = G.DEX_BY[bot.dex].name; card.appendChild(title);
        }
        const label = document.createElement('small'); label.textContent = G.T(bot ? 'Bot · un amigo puede ocupar su lugar' : 'Esperando un amigo'); card.appendChild(label);
        if (room.isHost && i > 0) {
          const mode = document.createElement('select'); mode.className = 'field'; mode.dataset.slotMode = i;
          for (const [value, text] of [['friend', 'Amigo invitado'], ['bot', 'Bot']]) {
            const option = document.createElement('option'); option.value = value; option.textContent = G.T(text); mode.appendChild(option);
          }
          mode.value = room.slots?.[i - 1]?.kind || 'friend';
          mode.onchange = () => configureSlot(i, mode.value);
          card.appendChild(mode);
          if (bot) {
            const select = document.createElement('select'); select.className = 'field'; select.dataset.slotPokemon = i;
            for (const mon of G.Social.catalog()) {
              const option = document.createElement('option'); option.value = mon.dex; option.textContent = G.DEX_BY[mon.dex].name; select.appendChild(option);
            }
            select.value = bot.dex; select.onchange = () => configureSlot(i, 'bot', +select.value); card.appendChild(select);
          }
        }
      }
      box.appendChild(card);
    }
    const ready = room.members.filter(m => m.uid !== room.host).every(m => ['direct', 'relay'].includes(G.Net.mode(m.uid)));
    const resuming = !!room.run && G.Coop.active;
    $('lobby-start').classList.toggle('hidden', !room.isHost && !resuming);
    $('lobby-start').disabled = (!room.isHost && !resuming) || (!room.run && !ready) || busy;
    $('lobby-start').textContent = G.T(room.run ? 'Continuar partida' : 'Jugar') + ' · ' + room.members.length + ' ' + G.T('jugadores') + (room.bots?.length ? ' + ' + room.bots.length + ' bots' : '');
    $('lobby-note').textContent = G.T(room.run ? 'Los amigos pueden entrar durante la partida y reemplazar bots.' : !room.isHost ? 'Espera a que el anfitrión empiece.' : ready ? 'Puedes jugar ya. Comparte el enlace para que entren tus amigos.' : 'Conectando con tus amigos…');
  }
  async function configureSlot(slot, kind, dex) {
    const room = G.Social.room; if (!room?.isHost) return;
    const slots = (room.slots || [{ kind: 'friend' }, { kind: 'friend' }, { kind: 'friend' }]).map(s => ({ ...s }));
    if (kind === 'bot') {
      dex ||= G.Social.catalog().find(m => !slots.some((s, i) => i !== slot - 1 && s.kind === 'bot' && s.dex === m.dex))?.dex;
      if (!dex) { G.UI.toast(G.T('Consigue otro Pokémon para añadir un bot.')); render(); return; }
    }
    slots[slot - 1] = kind === 'bot' ? { kind, dex } : { kind: 'friend' };
    const r = await G.Social.setSlots(slots); if (!r.ok) { G.UI.toast(r.error); render(); }
  }
  async function start() {
    const room = G.Social.room;
    if (!room || $('lobby-start').disabled || busy) return;
    if (room.run && G.Coop.active) { G.UI.hideAll(); G.UI.chrome(false); return; }
    if (!room.isHost) return;
    busy = true; render();
    try {
      const r = await G.Social.startRun(Math.floor(Math.random() * 1e6));
      if (!r.ok) { G.UI.toast(r.error); return; }
      const current = G.Social.room;
      if (!current?.run) return;
      const cfg = { k: 'start', mode: current.run.mode || current.mode, seed: current.run.seed, runId: current.run.id, host: current.host, bots: current.bots, members: current.members.map(m => ({ ...m })) };
      G.Net.broadcast(cfg); G.Flow.startCoop(cfg);
    } catch (e) { G.UI.toast(e.message); }
    finally { busy = false; if (G.UI.isOpen('scr-lobby')) render(); }
  }
  async function share(native, wifi = false) {
    await serverInfo(); render();
    if (!G.Social.room) return;
    const link = wifi && localBase ? new URL('/#sala=' + G.Social.room.id, localBase).href : invitation();
    try {
      if (native && androidServer && /PokeSurvivorAndroid\//.test(navigator.userAgent)) location.href = 'pokesurvivor://share?url=' + encodeURIComponent(link);
      else if (native && navigator.share) await navigator.share({ title: 'PokeSuvivor Friends', text: G.T('¡Entra en mi sala!'), url: link });
      else { await navigator.clipboard.writeText(link); G.UI.toast('Enlace copiado'); }
    } catch (e) { if (e.name !== 'AbortError') { $('lobby-link').focus(); $('lobby-link').select(); G.UI.toast('Selecciona y copia el enlace de la sala.'); } }
  }
  G.FriendsUI = { open };
  G.LobbyUI = { open() { if (!G.Social.room) { open(); return; } G.Social.refreshMember(); G.UI.show('scr-lobby', true); render(); serverInfo().then(render); }, close() { G.UI.hide('scr-lobby'); }, render };
  G.InvitePop = { refresh() {} }; G.NickUI = { skipped: true };
  G.SocialUI = {
    hasInvite() { return !!pendingCode; },
    consumeInvite() { if (pendingCode && !G.Social.room) open(); },
    init() {
      $('lobby-mode').onchange = async () => { const room = G.Social.room; if (!room?.isHost || room.run) return; const r = await G.Social.setSlots(room.slots, $('lobby-mode').value); if (!r.ok) { G.UI.toast(r.error); render(); } };
      $('lobby-title').textContent = G.T('Jugar');
      pendingCode = normalizeCode(new URLSearchParams(location.hash.slice(1)).get('sala'));
      $('room-form').onsubmit = e => { e.preventDefault(); enter(true); };
      document.querySelector('#scr-friends [data-back]').onclick = backToGame;
      $('room-pokemon-host').onclick = () => { source = 'host'; showPokemon(); };
      $('room-pokemon-local').onclick = () => { source = 'local'; showPokemon(); };
      $('room-pokemon-ok').onclick = confirmPokemon;
      $('room-pokemon-back').onclick = () => { if (editing) G.LobbyUI.open(); else open(); };
      $('lobby-join-form').onsubmit = async e => {
        e.preventDefault();
        const link = $('lobby-join-link').value.trim();
        if (!normalizeCode(link)) { G.UI.toast(G.T('Enlace de sala inválido.')); return; }
        await G.Social.leaveRoom(); pendingCode = link; openJoin();
      };
      $('lobby-choose').onclick = () => {
        available = G.Social.room?.catalog || []; editing = true;
        source = G.Social.choice?.source === 'host' ? 'host' : 'local'; showPokemon();
      };
      $('room-create').onclick = () => enter(false); $('lobby-start').onclick = start;
      $('btn-room').onclick = () => { G.UI.hide('scr-pause'); G.LobbyUI.open(); };
      $('lobby-copy').onclick = () => share(false); $('lobby-share').onclick = () => share(true);
      $('lobby-wifi').onclick = () => share(true, true);
      setInterval(() => {
        if (G.UI.isOpen('scr-lobby') && G.Social.room?.isHost) serverInfo().then(render);
      }, 5000);
      $('lobby-menu').onclick = () => G.MenuUI.open();
      $('lobby-leave').onclick = async () => { G.Game.quit(); await G.Social.leaveRoom(); G.Flow.afterLoad(); };
      G.Social.on(what => {
        const room = G.Social.room;
        if (room) { G.Net.open(room.id, room.isHost, room.host); G.Net.syncMembers(room.members.map(m => m.uid)); }
        else if (G.Net.open_) G.Net.close();
        if (what === 'room-closed') { G.UI.toast('La sala se ha cerrado'); if (G.UI.isOpen('scr-lobby')) G.Flow.afterLoad(); }
        if (G.UI.isOpen('scr-lobby') && room) render();
        if (room && G.Coop.active) G.Coop.syncRoom(room);
      });
      G.Net.onPeer(() => { if (G.UI.isOpen('scr-lobby')) render(); });
    }
  };
})();
