// 심문. 진술 하나를 골라 사건부에서 증거를 꺼낸다.
// 맞으면 모순이 증명되고, 틀리면 말투가 굳고 라운드가 닫혀 처음부터 다시 듣는다(게임 오버 없음).
// 신뢰도 같은 수치는 없다. 틀릴 때마다 숨은 불안도만 조금 오른다.

import { gain } from './clues.js';

const met = (req, have) => (req ?? []).every((id) => have.includes(id));
const UNEASE_STEP = 0.15;

export function findSuspect(data, id) {
  return (data.suspects ?? []).find((s) => s.id === id) ?? null;
}

export function suspectOpen(st, suspect) {
  return met(suspect.requires, st.have);
}

// 지금 들을 라운드: 조건을 채웠고 아직 끝나지 않은 첫 라운드
export function currentRound(st, suspect) {
  return (suspect.rounds ?? []).find((r) => met(r.requires, st.have) && !st.have.includes(r.id)) ?? null;
}

// 들을 라운드가 남지 않았고, 열린 라운드는 모두 끝났다
export function suspectDone(st, suspect) {
  return !currentRound(st, suspect) && (suspect.rounds ?? []).some((r) => st.have.includes(r.id));
}

// 라운드를 듣는다. 듣기만 해도 적히는 증언을 얻는다.
// 짚을 모순이 없는 라운드는 듣는 것으로 끝난다.
export function hear(data, st, round) {
  const heard = [...new Set([...(st.heard ?? []), ...(round.statements ?? []).map((s) => s.id)])];
  let state = heard.length === (st.heard ?? []).length ? st : { ...st, heard };
  const gained = [];
  for (const statement of round.statements ?? []) {
    const r = gain(data, state, statement.gives, statement.id);
    state = r.state;
    gained.push(...r.gained);
  }
  const nothingToProve = !(round.statements ?? []).some((s) => s.contradictedBy?.length);
  if (nothingToProve && !state.have.includes(round.id)) {
    const r = gain(data, { ...state, have: [...state.have, round.id] }, round.gives, round.id);
    state = r.state;
    gained.push(...r.gained);
  }
  return { state, gained };
}

// 다 들은 뒤 다시 찾아왔을 때 보여 줄 라운드: 열린 라운드 중 마지막
export function lastRound(st, suspect) {
  return [...(suspect.rounds ?? [])].reverse().find((r) => met(r.requires, st.have)) ?? null;
}

// 넘어가기: skippable 라운드에서 내밀 증거가 없을 때. 라운드는 닫히지만 증명은 남지 않는다.
export function skipRound(st, round) {
  if (!round.skippable || st.have.includes(round.id)) return st;
  return { ...st, have: [...st.have, round.id], skipped: [...(st.skipped ?? []), round.id] };
}

// 증거 제시
// result: 'proven' | 'wrong' | 'already'
export function present(data, st, round, statementId, clueId) {
  const statement = (round.statements ?? []).find((s) => s.id === statementId);
  if (!statement || !st.have.includes(clueId)) return { result: 'wrong', state: st, gained: [], roundDone: false };
  if (st.have.includes(statement.id)) return { result: 'already', state: st, gained: [], roundDone: false };

  if (!(statement.contradictedBy ?? []).includes(clueId)) {
    const unease = Math.min(1, (st.unease ?? 0) + UNEASE_STEP);
    return { result: 'wrong', state: { ...st, unease }, gained: [], roundDone: false };
  }

  let { state, gained } = gain(data, { ...st, have: [...st.have, statement.id] }, statement.onProven, statement.id);
  const contradictable = (round.statements ?? []).filter((s) => s.contradictedBy?.length);
  const roundDone = contradictable.every((s) => state.have.includes(s.id));
  if (roundDone) {
    const r = gain(data, { ...state, have: [...state.have, round.id] }, round.gives, round.id);
    state = r.state;
    gained = [...gained, ...r.gained];
  }
  return { result: 'proven', state, gained, roundDone };
}
