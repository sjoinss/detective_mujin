// 게임 전체 상태: 장마다의 사건 상태, 사건 시작 체크포인트, 모은 메인 스토리 조각.
// 저장 형식이므로 모양을 바꾸면 state.js의 SAVE_VERSION을 올린다.

import { SAVE_VERSION } from '../state.js';
import { newCaseState, findClue, gain } from './clues.js';

// player: 프롤로그에서 인계 칸에 적은 이름(없을 수 있다). ending: 최종장에서 닿은 엔딩.
export function newGame(firstCase) {
  return { v: SAVE_VERSION, current: firstCase, cases: {}, checkpoints: {}, fragments: [], player: '', ending: '' };
}

export function setPlayer(game, name) {
  return { ...game, player: String(name ?? '').trim().slice(0, 12) };
}

// 사건을 펼친다. 처음이면 새 상태를 만들고 그 순간을 체크포인트로 남긴다.
export function openCase(game, data) {
  if (game.cases[data.id]) return { ...game, current: data.id };
  // 앞선 사건에서 모은 조각은 이 사건의 단서로 들고 들어온다
  const carried = (data.clues ?? []).filter((c) => c.carry && game.fragments.includes(c.carry)).map((c) => c.id);
  const fresh = { ...gain(data, newCaseState(data), carried, 'carry').state, unread: 0 };
  return {
    ...game,
    current: data.id,
    cases: { ...game.cases, [data.id]: fresh },
    checkpoints: { ...game.checkpoints, [data.id]: fresh },
  };
}

// 사건 상태를 바꾼다. 새로 얻은 단서에 메인 스토리 조각이 있으면 함께 모은다.
export function updateCase(game, data, caseState, gained = []) {
  const fragments = [...game.fragments];
  for (const id of gained) {
    const frag = findClue(data, id)?.fragment;
    if (frag && !fragments.includes(frag)) fragments.push(frag);
  }
  return { ...game, cases: { ...game.cases, [data.id]: caseState }, fragments };
}

// 사건을 체크포인트(사건을 처음 펼친 때)로 되돌린다.
// 그 사건에서 모은 조각은 다시 모아야 하므로 뺀다.
export function restartCase(game, data) {
  const checkpoint = game.checkpoints[data.id] ?? newCaseState(data);
  const own = new Set((data.clues ?? []).map((c) => c.fragment).filter(Boolean));
  return {
    ...game,
    cases: { ...game.cases, [data.id]: checkpoint },
    fragments: game.fragments.filter((f) => !own.has(f)),
  };
}

// 장마다 상태: 'missing'(아직 데이터 없음) | 'locked' | 'open' | 'active'(진행 중) | 'solved'
// 아직 데이터가 없는 장은 선행 조건에서 건너뛴다.
export function chapterStatus(story, game) {
  const ready = new Map((story.chapters ?? []).map((c) => [c.id, c.ready === true]));
  const solved = (id) => game?.cases?.[id]?.solved === true;
  const out = {};
  for (const ch of story.chapters ?? []) {
    if (!ready.get(ch.id)) { out[ch.id] = 'missing'; continue; }
    if (solved(ch.id)) { out[ch.id] = 'solved'; continue; }
    const blocked = (ch.requires ?? []).some((id) => ready.get(id) && !solved(id));
    if (blocked) out[ch.id] = 'locked';
    else out[ch.id] = game?.cases?.[ch.id] ? 'active' : 'open';
  }
  return out;
}

export function currentCase(game) {
  return game?.cases?.[game.current] ?? null;
}
