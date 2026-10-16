// 최종장: 엔딩 판정.
//   은폐(cover)   한도윤의 제안을 받아들였다
//   진실(truth)   거절했고, 메인 조각 5개를 다 모았고, 대면의 모순을 하나도 넘기지 않고 다 증명했다
//   불완전(partial) 거절했지만 조각이나 증명이 모자란다
// 사건 1~5를 다 풀어야 최종장이 열리므로 "5개 사건 정답"은 이미 만족한다.

export const ENDINGS = ['truth', 'partial', 'cover'];

function contradictable(data) {
  return (data.suspects ?? []).flatMap((s) => (s.rounds ?? []).flatMap((r) => r.statements ?? []))
    .filter((st) => st.contradictedBy?.length);
}

export function confrontationProven(data, st) {
  return contradictable(data).every((x) => st.have.includes(x.id)) && !(st.skipped ?? []).length;
}

export function allFragments(story, game) {
  return (story.fragments ?? []).every((f) => game.fragments.includes(f.id));
}

export function decideEnding({ data, story, game, st, accept }) {
  if (accept) return 'cover';
  return allFragments(story, game) && confrontationProven(data, st) ? 'truth' : 'partial';
}

export function setEnding(game, ending) {
  return ENDINGS.includes(ending) ? { ...game, ending } : game;
}
