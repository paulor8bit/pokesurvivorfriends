/* Pokémon iniciais e seus movimentos. A escolha é feita pelo jogador. */
G.STARTERS = [
  { dex: 1,   start: 'vine-whip',     traits: ['leal', 'paciente'] },
  { dex: 4,   start: 'ember',         traits: ['valiente', 'impulsivo'] },
  { dex: 7,   start: 'water-gun',     traits: ['prudente', 'leal'] },
  { dex: 152, start: 'vine-whip',     traits: ['dulce', 'paciente'] },
  { dex: 155, start: 'ember',         traits: ['tímido', 'impulsivo'] },
  { dex: 158, start: 'water-gun',     traits: ['travieso', 'valiente'] },
  { dex: 252, start: 'razor-leaf',    traits: ['sereno', 'astuto'] },
  { dex: 255, start: 'ember',         traits: ['alegre', 'valiente'] },
  { dex: 258, start: 'water-gun',     traits: ['tenaz', 'leal'] },
  { dex: 387, start: 'vine-whip',     traits: ['paciente', 'tenaz'] },
  { dex: 390, start: 'ember',         traits: ['travieso', 'alegre'] },
  { dex: 393, start: 'bubble',        traits: ['orgulloso', 'prudente'] },
  { dex: 495, start: 'razor-leaf',    traits: ['orgulloso', 'astuto'] },
  { dex: 498, start: 'ember',         traits: ['tenaz', 'alegre'] },
  { dex: 501, start: 'water-gun',     traits: ['valiente', 'travieso'] },
  { dex: 650, start: 'vine-whip',     traits: ['travieso', 'tenaz'] },
  { dex: 653, start: 'ember',         traits: ['astuto', 'sereno'] },
  { dex: 656, start: 'water-gun',     traits: ['sereno', 'astuto'] },
  { dex: 722, start: 'razor-leaf',    traits: ['sereno', 'dulce'] },
  { dex: 725, start: 'ember',         traits: ['solitario', 'orgulloso'] },
  { dex: 728, start: 'bubble',        traits: ['alegre', 'dulce'] },
  { dex: 810, start: 'vine-whip',     traits: ['alegre', 'travieso'] },
  { dex: 813, start: 'ember',         traits: ['impulsivo', 'alegre'] },
  { dex: 816, start: 'water-gun',     traits: ['tímido', 'astuto'] },
  { dex: 906, start: 'razor-leaf',    traits: ['solitario', 'astuto'] },
  { dex: 909, start: 'ember',         traits: ['tranquilo', 'tenaz'] },
  { dex: 912, start: 'water-gun',     traits: ['orgulloso', 'prudente'] },
  { dex: 54,  start: 'confusion',     traits: ['caótico', 'tímido'] },
  { dex: 79,  start: 'confusion',     traits: ['tranquilo', 'paciente'] }
];

G.STARTER_BY = {};
for (const s of G.STARTERS) G.STARTER_BY[s.dex] = s;

/** Movimiento inicial de serie de cualquier Pokémon (starter o del gacha). */
G.baseStartOf = dex => {
  const s = G.STARTER_BY[dex];
  return s ? s.start : G.Moves.startFor(G.DEX_BY[dex]);
};

/** Ataques que se pueden elegir para empezar (Mejoras → Movimiento inicial): los suyos, sin potenciadores. */
G.startChoices = dex => G.Moves.poolFor(G.DEX_BY[dex]).filter(id => G.Moves.BY_ID[id].kind !== 'buff');

/**
 * Movimiento con el que empieza: el elegido con la mejora Movimiento inicial
 * (si la tiene comprada para ese Pokémon y sigue siendo de los suyos) o el de serie.
 */
G.startMoveOf = dex => {
  const s = G.DB && G.DB.save, pick = s && s.pstart && s.pstart[dex];
  if (pick && s.pupg && s.pupg[dex] && s.pupg[dex].start && G.startChoices(dex).includes(pick)) return pick;
  return G.baseStartOf(dex);
};
