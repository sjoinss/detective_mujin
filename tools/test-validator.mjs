// 검증 스크립트 자체의 시험. case1을 일부러 망가뜨려 각 규칙이 걸리는지 본다.
//   node tools/test-validator.mjs

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCase } from './validate-cases.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = JSON.parse(await readFile(path.join(ROOT, 'data/cases/case1.json'), 'utf8'));

const find = (data, id) => {
  for (const s of data.scenes) {
    if (s.id === id) return s;
    for (const o of s.objects) if (o.id === id) return o;
  }
  for (const list of [data.puzzles, data.clues, data.suspects]) {
    for (const x of list) if (x.id === id) return x;
  }
  for (const s of data.suspects) {
    for (const r of s.rounds) {
      if (r.id === id) return r;
      for (const st of r.statements) if (st.id === id) return st;
    }
  }
  throw new Error(`시험 데이터에 '${id}'가 없다`);
};

const cases = [
  ['원본은 오류 없음', null, () => {}],
  ['id 중복', 'DUP_ID', (d) => d.clues.push({ ...d.clues[0] })],
  ['없는 id 참조', 'BAD_REF', (d) => { find(d, 'st.kang.leave').contradictedBy = ['clue.nope']; }],
  ['알 수 없는 키(한 번만 열리는 오브젝트)', 'UNKNOWN_KEY', (d) => { find(d, 'obj.gatelog').once = true; }],
  ['정답 단서를 얻을 길이 없음', 'SOLUTION_UNREACHABLE', (d) => { find(d, 'obj.gatelog').gives = []; }],
  ['모순 단서를 얻을 길이 없음', 'CONTRADICTION_UNREACHABLE', (d) => { find(d, 'obj.gatelog').gives = []; }],
  ['퍼즐 선행 조건 순환', 'PUZZLE_CYCLE', (d) => {
    find(d, 'p.mixer').requires = ['clue.tapename'];
    find(d, 'p.tape').requires = ['clue.timer'];
  }],
  ['풀이 단서가 퍼즐 뒤에만 나옴', 'TEACHES_TOO_LATE', (d) => { find(d, 'p.lock').teaches = ['clue.ledgercopy']; }],
  ['메모가 두 장뿐', 'MISSING_HINT', (d) => { d.hints['p.mixer'].pop(); }],
  ['풀이 장 없음', 'MISSING_HINT', (d) => { delete find(d, 'p.lock').answerNote; }],
  ['범인 아닌 용의자에게 소거 단서 없음', 'NO_CLEARING_CLUE', (d) => { find(d, 's.min').clearedBy = []; }],
  ['용의자에게 의심 지점 없음', 'NO_SUSPICION', (d) => { find(d, 's.gu').suspectedBy = []; }],
  ['범인에게 소거 단서', 'CULPRIT_CLEARED', (d) => { find(d, 's.kang').clearedBy = ['clue.drivelog']; }],
  ['살펴볼 곳 5곳', 'TOO_MANY', (d) => {
    find(d, 'sc.staffroom').objects.push({ id: 'obj.extra', label: '창문', gives: [] });
  }],
  ['장면 대체 텍스트 없음', 'MISSING_ALT', (d) => { find(d, 'sc.archive').alt = ''; }],
  ['오브젝트 이름 없음', 'MISSING_NAME', (d) => { find(d, 'obj.shell').label = ' '; }],
  ['퍼즐을 여는 곳 없음', 'NO_OPENER', (d) => { delete find(d, 'obj.tapebox').puzzle; }],
  ['자물쇠 정답 자릿수 틀림', 'BAD_CONFIG', (d) => { find(d, 'p.lock').config.answer = '419'; }],
  ['배선 정답이 없는 단자', 'BAD_CONFIG', (d) => { find(d, 'p.mixer').config.answer.tape = 'in9'; }],
  ['근거가 requires에 없음', 'EVIDENCE_NOT_REQUIRED', (d) => { d.solution.evidence.motive.push('clue.shell'); }],
  ['닿을 수 없는 장면', 'UNREACHABLE', (d) => { find(d, 'sc.archive').requires = ['clue.nowhere']; d.clues.push({ id: 'clue.nowhere', name: 'x', text: 'x' }); }],
  ['서술 규칙 위반은 경고', 'STYLE', (d) => { find(d, 'sc.stairs').text = ['그건 사고였던 것이다.']; }, 'warning'],
];

let failed = 0;
for (const [name, code, mutate, level = 'error'] of cases) {
  const data = structuredClone(base);
  mutate(data);
  const { errors, warnings } = validateCase(data);
  const pool = level === 'warning' ? warnings : errors;
  const ok = code === null ? errors.length === 0 : pool.some((e) => e.code === code);
  if (!ok) failed++;
  const got = code === null ? errors.map((e) => e.code) : pool.map((e) => e.code);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  기대 ${code ?? '오류 없음'}, 실제 [${got.join(', ')}]`}`);
}
console.log(`\n${failed ? `실패 ${failed}건` : `전부 통과 (${cases.length}건)`}`);
process.exitCode = failed ? 1 : 0;
