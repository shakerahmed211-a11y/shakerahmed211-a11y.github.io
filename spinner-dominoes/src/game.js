// Double-six set: seven values (blank through six), 28 physical tiles.
export const RULES_VERSION = 'spinner-double-six-v1';
export const MAX_PIP = 6;
export const TOTAL_TILES = ((MAX_PIP + 1) * (MAX_PIP + 2)) / 2;

export function createSet() {
  const tiles = [];
  for (let a = 0; a <= MAX_PIP; a++) for (let b = a; b <= MAX_PIP; b++) tiles.push({ id: `d${a}-${b}`, a, b });
  return tiles;
}
export const pip = v => v;
export const tileValue = t => pip(t.a) + pip(t.b);
export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function deal(names, random = Math.random, round = 0, starterMode = 'official') {
  if (names.length < 2 || names.length > 4) throw new Error('يلزم من لاعبين إلى أربعة.');
  const bag = shuffle(createSet(), random), count = 7;
  const hands = names.map(() => bag.splice(0, count));
  const firstDouble = starterMode === 'repeat-six' ? MAX_PIP : MAX_PIP - (round % (MAX_PIP + 1));
  const starter = `d${firstDouble}-${firstDouble}`;
  let startPlayer = hands.findIndex(h => h.some(t => t.id === starter));
  let startTile;
  if (startPlayer < 0) {
    // Rules require drawing until the starter is found; the drawer keeps it in hand.
    startPlayer = 0;
    while (bag.length) { const t = bag.shift(); if (t.id === starter) { startTile = t; hands[startPlayer].push(t); break; } hands[startPlayer].push(t); }
  } else startTile = hands[startPlayer].find(t => t.id === starter);
  hands[startPlayer] = hands[startPlayer].filter(t => t.id !== startTile.id);
  return { hands, bag, startPlayer, startTile };
}
function setOpenEnds(state) {
  return state.ends.filter(e => !e.used);
}
export function getLegalMoves(state, hand) {
  if (!state.started) return [];
  const ends = state.forced ? state.forced.slots.map(slot => ({ ...slot, forced: true })) : setOpenEnds(state);
  const result = [];
  for (const tile of hand) for (const end of ends) {
    const matches = [tile.a, tile.b].filter(v => v === end.value);
    if (!matches.length) continue;
    for (const as of new Set(matches)) result.push({ tileId: tile.id, endId: end.id, as, forced: !!end.forced });
  }
  return result;
}
function end(id, value, parentId, arm = 'end') { return { id, value, parentId, arm, used: false }; }
export function beginRound(names, round = 0, random = Math.random, settings = {}) {
  const starterMode = settings.starterMode || 'official';
  const dealt = deal(names, random, round, starterMode), start = dealt.startTile;
  // The opening double is already laid. Its first three plays fill three arms.
  const n = start.a;
  const slots = [0,1,2,3].map(i => end(`root-${i}`, n, start.id, `arm-${i}`));
  const state = {
    started: true, round, roundsTotal: settings.roundsTotal || 10, teamMode: !!settings.teamMode,
    starterMode, speed: settings.speed || 'normal',
    players: names.map((name, i) => ({ name, hand: dealt.hands[i], score: 0, online: true })),
    bag: dealt.bag, board: [{ tile: start, endId: null, as: n, opening: true }],
    ends: slots, forced: { tileId: start.id, value: n, slots: slots.slice(0,3), remaining: 3 }, forcedQueue: [],
    turn: dealt.startPlayer, passes: 0, lastMessage: `${names[dealt.startPlayer]} بدأ بالقطعة الافتتاحية.`, finished: false,
    roundWinner: null, result: null, targetScore: 100, log: [`بدأت الجولة بالقطعة ${start.a} | ${start.b}.`]
  };
  // Record the opening tile in the starter's hand-independent board. The starter is turn owner.
  state.turn = (dealt.startPlayer + 1) % names.length;
  return state;
}
export function place(state, playerIndex, move) {
  if (state.finished) return { ok: false, reason: 'انتهت الجولة بالفعل.' };
  if (playerIndex !== state.turn) return { ok: false, reason: 'ليس دورك الآن.' };
  const hand = state.players[playerIndex].hand;
  const tile = hand.find(t => t.id === move.tileId);
  if (!tile) return { ok: false, reason: 'هذه القطعة ليست في يدك.' };
  const legal = getLegalMoves(state, hand).find(m => m.tileId === move.tileId && m.endId === move.endId);
  if (!legal) return { ok: false, reason: state.forced ? 'يجب اللعب على أحد الأذرع المفتوحة للقطعة المزدوجة.' : 'القطعة لا تطابق طرفًا مفتوحًا.' };
  const target = state.ends.find(e => e.id === move.endId);
  if (!target || target.used) return { ok: false, reason: 'هذا الطرف لم يعد متاحًا.' };
  target.used = true;
  const other = tile.a === target.value ? tile.b : tile.a;
  state.players[playerIndex].hand = hand.filter(t => t.id !== tile.id);
  state.board.push({ tile, endId: target.id, as: move.as ?? target.value, opening: false });
  if (tile.a === tile.b) {
    // A double creates three side arms; the next three successful plays must fill them.
    const n = tile.a;
    const slots = [0,1,2].map(i => end(`${tile.id}-${state.board.length}-${i}`, n, tile.id, `arm-${i}`));
    state.ends.push(...slots);
    const nextForced = { tileId: tile.id, value: n, slots, remaining: 3 };
    if (state.forced) state.forcedQueue.push(nextForced); else state.forced = nextForced;
  } else state.ends.push(end(`${tile.id}-${state.board.length}`, other, tile.id));
  if (state.forced && state.forced.tileId !== tile.id) {
    state.forced.slots = state.forced.slots.filter(e => e.id !== target.id);
    state.forced.remaining = state.forced.slots.length;
    if (!state.forced.remaining) state.forced = state.forcedQueue.shift() || null;
  }
  state.passes = 0;
  state.log.push(`${state.players[playerIndex].name} لعب ${displayTile(tile)}.`);
  if (state.players[playerIndex].hand.length === 0) return finishRound(state, playerIndex);
  state.turn = (state.turn + 1) % state.players.length;
  return { ok: true };
}
export function drawOrPass(state, playerIndex) {
  if (state.finished) return { ok: false, reason: 'انتهت الجولة.' };
  if (playerIndex !== state.turn) return { ok: false, reason: 'ليس دورك الآن.' };
  if (getLegalMoves(state, state.players[playerIndex].hand).length) return { ok: false, reason: 'لديك حركة قانونية؛ العب قطعة قبل السحب أو التمرير.' };
  let drawn = 0;
  while (state.bag.length) {
    const tile = state.bag.shift(); state.players[playerIndex].hand.push(tile); drawn++;
    if (getLegalMoves(state, state.players[playerIndex].hand).length) {
      state.log.push(`${state.players[playerIndex].name} سحب ${drawn} قطعة ووجد حركة.`);
      return { ok: true, drew: true, drawn, playable: true };
    }
  }
  if (drawn) state.log.push(`${state.players[playerIndex].name} سحب ${drawn} قطعة دون حركة.`);
  state.log.push(`${state.players[playerIndex].name} مرّر.`);
  state.passes++;
  if (state.passes >= state.players.length) finishRound(state, null);
  else state.turn = (state.turn + 1) % state.players.length;
  return { ok: true, drew: false, passed: true };
}
function finishRound(state, winner) {
  state.finished = true; state.roundWinner = winner;
  state.players.forEach(p => p.score += p.hand.reduce((s,t) => s + tileValue(t), 0));
  state.result = winner === null ? 'blocked' : 'out';
  state.log.push(winner === null ? 'أُغلقت الجولة؛ أضيفت قيمة القطع الباقية إلى النتائج.' : `${state.players[winner].name} أنهى قطعه.`);
  return { ok: true, finished: true };
}
export function nextRound(state, random = Math.random) {
  if (!state.finished) return { ok: false, reason: 'لا تبدأ جولة جديدة قبل انتهاء الحالية.' };
  if (state.round >= (state.roundsTotal || 10) - 1) return { ok: false, reason: 'اكتملت أيادي المباراة.' };
  const names = state.players.map(p => p.name), scores = state.players.map(p => p.score);
  const next = beginRound(names, state.round + 1, random, { roundsTotal: state.roundsTotal || 10, teamMode: state.teamMode, starterMode: state.starterMode, speed: state.speed });
  next.players.forEach((p,i) => p.score = scores[i]);
  next.targetScore = state.targetScore;
  return { ok: true, state: next };
}
export function displayTile(t) { return `${t.a} | ${t.b}`; }
export function hint(state, playerIndex) {
  const moves = getLegalMoves(state, state.players[playerIndex].hand);
  if (!moves.length) return 'لا توجد قطعة قابلة للعب؛ اسحب أو مرّر.';
  const chosen = [...moves].sort((a,b) => tileValue(state.players[playerIndex].hand.find(t=>t.id===b.tileId))-tileValue(state.players[playerIndex].hand.find(t=>t.id===a.tileId)))[0];
  const t = state.players[playerIndex].hand.find(x=>x.id===chosen.tileId);
  return `جرّب القطعة ${displayTile(t)} على الطرف ${chosen.as}.`;
}
export function chooseAiMove(state, playerIndex, difficulty = 'medium', random = Math.random) {
  const moves = getLegalMoves(state, state.players[playerIndex].hand);
  if (!moves.length) return null;
  if (difficulty === 'easy') return moves[Math.floor(random()*moves.length)];
  const scored = moves.map(m => {
    const tile = state.players[playerIndex].hand.find(t=>t.id===m.tileId);
    let score = tileValue(tile) * (difficulty === 'hard' ? 1.2 : 1);
    if (tile.a === tile.b) score += 1;
    return { m, score: score + random()*.2 };
  }).sort((a,b)=>b.score-a.score);
  return scored[0].m;
}
