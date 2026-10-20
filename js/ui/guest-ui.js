/* Account-free invitations. The room server lives on the host's computer. */
(() => {
  const texts = {
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
    'No se pudo conectar. Abre el juego con Jogar Online.bat.': ['Não foi possível conectar. Abra o jogo com Jogar Online.bat.', 'Could not connect. Open the game with Jogar Online.bat.'],
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
  function normalizeCode(value) {
    value = String(value || '').trim();
    if (/^https?:\/\//i.test(value)) {
      try {
        const u = new URL(value);
        if (u.origin !== location.origin && u.origin !== publicBase) return '';
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
  function open() {
    if (G.Social.room) { G.LobbyUI.open(); return; }
    G.UI.show('scr-friends', true);
    try { $('room-name').value = localStorage.getItem('ps.roomName') || ''; } catch { /* unavailable */ }
    $('room-code').value = pendingCode; serverInfo();
  }
  async function enter(join) {
    if (busy) return;
    if (!G.Social.setName($('room-name').value)) { notice('Usa un apodo de 2 a 20 letras o números.', true); return; }
    const code = join ? normalizeCode($('room-code').value) : '';
    if (join && !code) { notice('Introduce un código de 12 caracteres o un enlace de este mismo juego.', true); return; }
    busy = true; $('room-create').disabled = $('room-join').disabled = true; notice('Conectando…');
    try {
      const r = await (join ? G.Social.joinRoom(code) : G.Social.createRoom());
      if (!r.ok) { notice(r.error, true); return; }
      pendingCode = '';
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
      await serverInfo(); G.LobbyUI.open();
    } catch (e) { notice(e.message, true); }
    finally { busy = false; $('room-create').disabled = $('room-join').disabled = false; }
  }
  function render() {
    const room = G.Social.room; if (!room) return;
    $('lobby-invitation').classList.toggle('hidden', !room.isHost);
    $('lobby-sub').textContent = room.isHost ? 'Comparte el enlace y espera a tus amigos. Hasta 4 jugadores.' : 'El anfitrión empezará la partida para todos.';
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
      const m = room.members[i], card = document.createElement('div'); card.className = 'lob-card' + (m ? '' : ' empty');
      if (m) {
        card.style.setProperty('--pc', G.Coop.COLORS[i]);
        card.appendChild(G.UI.spriteCanvas(m.dex, 120, 96, { scale: 2, lively: true, shiny: !!m.shiny }));
        const title = document.createElement('b'); title.setAttribute('translate', 'no'); title.textContent = m.name; card.appendChild(title);
        const state = document.createElement('small'), mode = G.Net.mode(m.uid);
        state.textContent = m.uid === room.host ? 'Anfitrión' : !room.isHost ? 'En la sala' : mode === 'direct' ? 'Conexión directa' : mode === 'relay' ? 'Conectado por el túnel' : 'Conectando…';
        card.appendChild(state);
      } else card.textContent = 'Libre';
      box.appendChild(card);
    }
    const ready = room.members.length >= 2 && room.members.filter(m => m.uid !== room.host).every(m => ['direct', 'relay'].includes(G.Net.mode(m.uid)));
    $('lobby-start').classList.toggle('hidden', !room.isHost);
    $('lobby-start').disabled = !room.isHost || !ready || busy;
    $('lobby-start').textContent = 'Empezar partida (' + room.members.length + '/4)';
    $('lobby-note').textContent = !room.isHost ? 'Espera a que el anfitrión empiece.' : room.members.length < 2 ? 'Esperando a tu amigo…' : ready ? 'Todos conectados. Ya puedes empezar.' : 'Conectando con tus amigos…';
  }
  async function start() {
    const room = G.Social.room;
    if (!room?.isHost || $('lobby-start').disabled || busy) return;
    busy = true; render();
    try {
      const r = await G.Social.setOpen(false);
      if (!r.ok) { G.UI.toast(r.error); return; }
      const current = G.Social.room;
      if (!current || current.members.length < 2) { if (current) await G.Social.setOpen(true); return; }
      const cfg = { k: 'start', seed: Math.floor(Math.random() * 1e6), host: current.host, members: current.members.map(m => ({ ...m })) };
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
      else if (native && navigator.share) await navigator.share({ title: 'PokéSurvivor', text: G.T('¡Entra en mi sala!'), url: link });
      else { await navigator.clipboard.writeText(link); G.UI.toast('Enlace copiado'); }
    } catch (e) { if (e.name !== 'AbortError') { $('lobby-link').focus(); $('lobby-link').select(); G.UI.toast('Selecciona y copia el enlace de la sala.'); } }
  }
  G.FriendsUI = { open };
  G.LobbyUI = { open() { if (!G.Social.room) { open(); return; } G.Social.refreshMember(); G.UI.show('scr-lobby', true); render(); serverInfo().then(render); }, close() { G.UI.hide('scr-lobby'); }, render };
  G.InvitePop = { refresh() {} }; G.NickUI = { skipped: true };
  G.SocialUI = {
    consumeInvite() { if (pendingCode && !G.Social.room) open(); },
    init() {
      $('lobby-title').textContent = G.I18n.lang === 'en' ? 'Room' : 'Sala';
      pendingCode = normalizeCode(new URLSearchParams(location.hash.slice(1)).get('sala'));
      $('room-form').onsubmit = e => { e.preventDefault(); enter(true); };
      $('room-create').onclick = () => enter(false); $('lobby-start').onclick = start;
      $('lobby-copy').onclick = () => share(false); $('lobby-share').onclick = () => share(true);
      $('lobby-wifi').onclick = () => share(true, true);
      setInterval(() => {
        if (G.UI.isOpen('scr-lobby') && G.Social.room?.isHost) serverInfo().then(render);
      }, 5000);
      $('lobby-menu').onclick = () => G.MenuUI.open();
      $('lobby-leave').onclick = async () => { await G.Social.leaveRoom(); G.MenuUI.open(); };
      G.Social.on(what => {
        const room = G.Social.room;
        if (room) { G.Net.open(room.id, room.isHost, room.host); G.Net.syncMembers(room.members.map(m => m.uid)); }
        else if (G.Net.open_) G.Net.close();
        if (what === 'room-closed') { G.UI.toast('La sala se ha cerrado'); if (G.UI.isOpen('scr-lobby')) G.MenuUI.open(); }
        if (G.UI.isOpen('scr-lobby') && room) render();
      });
      G.Net.onPeer(() => { if (G.UI.isOpen('scr-lobby')) render(); });
    }
  };
})();
