// 대조표. 서류 두 장을 나란히 놓고 한 줄씩 짚는다.
// 왼쪽은 사건부의 단서, 오른쪽은 들은 진술과 다른 기록(단서).
// 짚은 두 줄이 사건 데이터의 대조 줄(board)과 맞으면 관계 문장이 완성된다. 틀려도 잃는 것은 없다.

import { gain, findClue } from './clues.js';

export function statementById(data, id) {
  for (const s of data.suspects ?? []) {
    for (const r of s.rounds ?? []) {
      const st = (r.statements ?? []).find((x) => x.id === id);
      if (st) return { suspect: s, statement: st };
    }
  }
  return null;
}

// 두 서류에 올라갈 줄
export function boardSheets(data, st) {
  const clues = st.have.map((id) => findClue(data, id)).filter(Boolean);
  const statements = (st.heard ?? []).map((id) => statementById(data, id)).filter(Boolean);
  return { clues, statements };
}

export function findLink(data, a, b) {
  return (data.board ?? []).find((l) => (l.left === a && l.right === b) || (l.left === b && l.right === a)) ?? null;
}

// result: 'linked' | 'already' | 'none'
export function connect(data, st, a, b) {
  const known = (id) => st.have.includes(id) || (st.heard ?? []).includes(id);
  if (!a || !b || a === b || !known(a) || !known(b)) return { result: 'none', state: st, gained: [], link: null };
  const link = findLink(data, a, b);
  if (!link) return { result: 'none', state: st, gained: [], link: null };
  if (st.have.includes(link.id)) return { result: 'already', state: st, gained: [], link };
  const { state, gained } = gain(data, { ...st, have: [...st.have, link.id] }, link.gives, link.id);
  return { result: 'linked', state, gained, link };
}

// 지금까지 짚은 대조 줄
export function linkedLines(data, st) {
  return (data.board ?? []).filter((l) => st.have.includes(l.id));
}
