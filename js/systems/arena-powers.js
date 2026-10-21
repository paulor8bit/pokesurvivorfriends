/* Permanent Arena moves, separate from survival upgrades and bot affinity. */
G.ArenaPowers = (() => {
  const COST = 150;
  function defaults(dex) {
    const mon = G.DEX_BY[dex]; if (!mon) return [];
    const ids = [...new Set([G.Moves.startFor(mon), ...G.Moves.poolFor(mon)])];
    const moves = ids.map(id => G.Moves.BY_ID[id]).filter(m => m && m.kind !== 'buff');
    return [...moves, ...G.Moves.ALL.filter(m => m.kind !== 'buff' && !moves.includes(m))].slice(0, 4).map(m => m.id);
  }
  function pool(dex) {
    const mon = G.DEX_BY[dex]; if (!mon) return [];
    return [...new Set([...defaults(dex), ...G.Moves.poolFor(mon)])].filter(id => G.Moves.BY_ID[id]?.kind !== 'buff' && G.Moves.BY_ID[id]);
  }
  function normalize(dex, ids) {
    const allowed = pool(dex), chosen = [];
    for (let slot = 0; slot < 4; slot++) {
      const id = ids?.[slot];
      chosen.push(allowed.includes(id) && !chosen.includes(id) ? id : defaults(dex).find(m => !chosen.includes(m)));
    }
    return chosen;
  }
  function profile(dex) {
    const base = defaults(dex), p = G.DB.save.arenaTraining?.[dex], allowed = pool(dex);
    const learned = [...new Set([...base, ...(Array.isArray(p?.learned) ? p.learned : []).filter(id => allowed.includes(id))])];
    const loadout = normalize(dex, (Array.isArray(p?.loadout) ? p.loadout : []).map(id => learned.includes(id) ? id : null));
    return { learned, loadout };
  }
  function moves(dex, ids = profile(dex).loadout) {
    return normalize(dex, ids).map(id => { const m = G.Moves.BY_ID[id]; return { id, name: m.name, type: m.type, power: m.dmg, tempo: m.cd }; });
  }
  function equip(dex, slot, id) {
    if (!G.DB.owns(dex) && !G.STARTERS.some(m => m.dex === dex)) return { ok: false, error: 'Escolha um Pokémon disponível na Arena.' };
    if (!Number.isInteger(slot) || slot < 0 || slot > 3 || !pool(dex).includes(id)) return { ok: false, error: 'Poder incompatível com este Pokémon.' };
    const p = profile(dex);
    const cost = p.learned.includes(id) ? 0 : COST;
    if (G.DB.save.coins < cost) return { ok: false, error: 'Moedas insuficientes.' };
    const other = p.loadout.indexOf(id);
    if (other >= 0 && other !== slot) p.loadout[other] = p.loadout[slot];
    p.loadout[slot] = id; if (!p.learned.includes(id)) p.learned.push(id);
    const save = G.DB.save, previous = save.arenaTraining?.[dex], ledger = save.led, updated = save.updated;
    save.arenaTraining ||= {}; save.arenaTraining[dex] = p;
    save.coins -= cost;
    if (!G.DB.commit()) {
      save.coins += cost; save.led = ledger; save.updated = updated;
      if (previous) save.arenaTraining[dex] = previous; else delete save.arenaTraining[dex];
      return { ok: false, error: 'Não foi possível salvar a compra. Suas moedas foram mantidas.' };
    }
    return { ok: true, cost };
  }
  return { COST, defaults, pool, normalize, profile, moves, equip };
})();
