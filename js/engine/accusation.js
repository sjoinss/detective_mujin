// 수사 보고서(최종 추리). 범인·수법·동기 세 칸, 칸마다 근거 단서 1~2개.
// 틀리면 어느 칸이 어긋났는지만 알려 준다. 점수는 없다.

export const QUESTIONS = ['culprit', 'method', 'motive'];
export const MAX_EVIDENCE = 2;

const met = (req, have) => (req ?? []).every((id) => have.includes(id));

// 보고서를 쓸 수 있는가. 사건 데이터의 reportRequires(없으면 정답에 필요한 단서 전부).
export function canReport(data, st) {
  return met(data.reportRequires ?? data.solution?.requires, st.have);
}

// answers: { culprit: { answer, evidence: [] }, method: {...}, motive: {...} }
// → { correct, wrong: ['culprit', ...] }
export function grade(data, answers) {
  const sol = data.solution;
  const wrong = QUESTIONS.filter((q) => {
    const a = answers?.[q];
    const evidence = a?.evidence ?? [];
    return !a
      || a.answer !== sol[q]
      || evidence.length < 1
      || evidence.length > MAX_EVIDENCE
      || !evidence.every((id) => (sol.evidence?.[q] ?? []).includes(id));
  });
  return { correct: wrong.length === 0, wrong };
}

export function closeCase(st) {
  return { ...st, solved: true };
}
