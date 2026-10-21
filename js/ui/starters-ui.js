/* Escolha direta do Pokémon inicial, sem questionário. */
G.StartersUI = (() => {
  const $ = G.UI.$;
  let picked = null;

  function init() {
    $('starter-ok').onclick = () => { if (picked) choose(picked); };
  }

  function start() {
    picked = null;
    G.UI.chrome(false);
    $('starter-ok').disabled = true;
    $('starter-info').textContent = 'Selecciona un Pokémon';
    const grid = $('starter-grid');
    grid.innerHTML = '';
    for (const s of G.STARTERS) {
      const mon = G.DEX_BY[s.dex];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.dex = s.dex;
      cell.setAttribute('aria-pressed', 'false');
      cell.appendChild(G.UI.spriteCanvas(s.dex, 92, 80, { scale: 2 }));
      cell.insertAdjacentHTML('beforeend', `<b>${mon.name}</b>`);
      cell.onclick = () => {
        grid.querySelectorAll('.cell').forEach(c => { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
        cell.classList.add('on');
        cell.setAttribute('aria-pressed', 'true');
        picked = s.dex;
        const mv = G.Moves.BY_ID[s.start];
        $('starter-info').innerHTML = `${G.UI.typeChips(mon.types)} ${G.Icons.html('move:' + s.start, 16)} ${mv.name}`;
        $('starter-ok').disabled = false;
      };
      grid.appendChild(cell);
    }
    G.UI.show('scr-starters');
  }

  function choose(dex) {
    const save = G.DB.save;
    save.starter = dex;
    save.partner = dex;
    save.personality = null;
    G.DB.grant(dex, 'starter');
    G.DB.commit();
    G.UI.toast('¡' + G.DEX_BY[dex].name + ' se une a ti!');
    G.Flow.goMenu();
  }

  return { init, start };
})();
