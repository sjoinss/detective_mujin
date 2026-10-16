// 서진우 메모(힌트). 퍼즐마다 세 장, 다 넘기면 풀이가 적힌 마지막 장.
// 보고서 메모(hints.report)는 세 장뿐이고 풀이 장이 없다.
// 몇 장 넘겼는지는 화면에 숫자로 나오지 않는다. 넘긴 장이 보일 뿐이다.

export const REPORT_NOTES = 'report';

function answerOf(data, key) {
  return (data.puzzles ?? []).find((p) => p.id === key)?.answerNote ?? '';
}

function maxTurns(data, key) {
  return (data.hints?.[key] ?? []).length + (answerOf(data, key) ? 1 : 0);
}

export function notePages(data, st, key) {
  const pages = data.hints?.[key] ?? [];
  const turned = st.notes?.[key] ?? 0;
  return {
    shown: pages.slice(0, turned),
    answer: turned > pages.length ? answerOf(data, key) : '',
    more: turned < maxTurns(data, key),
  };
}

export function turnNote(data, st, key) {
  const turned = Math.min(maxTurns(data, key), (st.notes?.[key] ?? 0) + 1);
  return { ...st, notes: { ...(st.notes ?? {}), [key]: turned } };
}
