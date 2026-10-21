// Only public collection choices are shared; never saves, currency or private files.
const STARTERS = new Set([1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501, 650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912, 54, 79]);
function catalogOf(input) {
  const out = new Map();
  for (const m of Array.isArray(input) ? input.slice(0, 1025) : []) {
    const dex = Number(m?.dex);
    if (Number.isInteger(dex) && dex >= 1 && dex <= 1025) out.set(dex, { dex, shiny: m.shiny === true });
  }
  return [...out.values()];
}
function choiceOf(input, room) {
  const source = ['host', 'starter'].includes(input.source) ? input.source : 'local';
  const dex = Number(input.dex);
  if (source === 'starter' && !STARTERS.has(dex)) throw Error('Ese Pokémon no está disponible en esta sala.');
  if (source === 'host' && !STARTERS.has(dex) && !room?.catalog.some(m => m.dex === dex)) throw Error('Ese Pokémon no está disponible en esta sala.');
  const entry = room?.catalog.find(m => m.dex === dex);
  return { source, shiny: source === 'host' ? !!entry?.shiny && input.shiny === true : source === 'starter' ? false : input.shiny === true };
}
function originAllowed(origin, host) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) && (url.host === host || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch { return false; }
}
function slotsOf(input, catalog) {
  const used = new Set();
  return Array.from({ length: 3 }, (_, i) => {
    const slot = input?.[i];
    if (slot?.kind !== 'bot') return { kind: 'friend' };
    const dex = Number(slot.dex);
    if (!catalog.some(m => m.dex === dex) || used.has(dex)) throw Error('Elige un Pokémon distinto de tu colección para cada bot.');
    used.add(dex); return { kind: 'bot', dex };
  });
}
function freeSlot(room) {
  const occupied = new Set([...room.members.values()].map(m => m.slot));
  const free = [1, 2, 3].filter(i => !occupied.has(i));
  return free.find(i => room.slots[i - 1].kind !== 'bot') ?? free[0];
}
function roomView(room) {
  const members = [...room.members.values()].sort((a, b) => a.slot - b.slot);
  const occupied = new Set(members.map(m => m.slot));
  const bots = room.slots.flatMap((s, i) => s.kind === 'bot' && !occupied.has(i + 1) ? [{ ...s, slot: i + 1 }] : []);
  return { id: room.id, host: room.host, mode: room.mode || 'survival', open: room.open, catalog: room.catalog, members, slots: room.slots, bots, run: room.run };
}
module.exports = { catalogOf, choiceOf, originAllowed, slotsOf, freeSlot, roomView };
