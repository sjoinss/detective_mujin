// 엔진 시험: 탐색·단서 획득·체크포인트·저장 코드
//   node tools/test-engine.mjs

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newCaseState, inspect, move, openScenes, visibleObjects, findScene, markRead, sourceLabel } from '../js/engine/clues.js';
import { newGame, openCase, updateCase, restartCase, currentCase } from '../js/engine/game.js';
import { encodeGame, decodeGame, checkGame } from '../js/engine/saveCode.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await readFile(path.join(ROOT, 'data/cases/case1.json'), 'utf8'));

let failed = 0;
let count = 0;
const check = (name, ok, detail = '') => {
  count++;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  ${detail}`}`);
};

// 시작
let st = newCaseState(data);
check('시작 장면에 들어가 있다', st.sceneId === data.start && st.have.includes(data.start));
check('시작 로그는 장면 하나', st.log.length === 1 && st.log[0].k === 'scene');

// 살펴보기 → 단서
let r = inspect(data, st, 'obj.switch');
check('스위치를 살펴보면 단서 하나', r.gained.length === 1 && r.gained[0] === 'clue.warmswitch');
check('얻은 곳이 기록된다', r.state.found['clue.warmswitch'] === 'obj.switch');
check('얻은 곳 이름', sourceLabel(data, 'obj.switch') === '방송실 · 예약 스위치');
check('안 읽은 줄 1', r.state.unread === 1);
st = r.state;

r = inspect(data, st, 'obj.switch');
check('다시 살펴보면 단서는 안 늘고 글만 다시', r.gained.length === 0 && r.state.log.at(-1).k === 'look');
st = r.state;

r = inspect(data, st, 'obj.gatelog');
check('다른 장면의 오브젝트는 살펴볼 수 없다', r.gained.length === 0 && r.state === st);

check('읽음 처리', markRead(st).unread === 0);

// 장면 이동
st = move(data, st, 'sc.staffroom');
check('교무실로 이동', st.sceneId === 'sc.staffroom' && st.log.at(-1).id === 'sc.staffroom');
check('같은 장면으로 이동은 무시', move(data, st, 'sc.staffroom') === st);
check('없는 장면으로 이동은 무시', move(data, st, 'sc.nowhere') === st);

// 퍼즐 없이 탐색으로 얻는 단서 전부
for (const scene of openScenes(data, st)) {
  st = move(data, st, scene.id);
  for (const obj of visibleObjects(st, findScene(data, scene.id))) st = inspect(data, st, obj.id).state;
}
const expected = data.scenes.flatMap((s) => s.objects.flatMap((o) => o.gives ?? []));
check('모든 장면을 돌면 탐색 단서를 전부 얻는다', expected.every((id) => st.have.includes(id)),
  expected.filter((id) => !st.have.includes(id)).join(', '));

// 조건이 걸린 장면·오브젝트
const gated = structuredClone(data);
gated.scenes[3].requires = ['clue.rollbook'];
gated.scenes[0].objects[0].requires = ['clue.wiring'];
let g = newCaseState(gated);
check('조건이 안 된 장면은 열리지 않는다', !openScenes(gated, g).some((s) => s.id === 'sc.archive'));
check('조건이 안 된 오브젝트는 보이지 않는다', !visibleObjects(g, gated.scenes[0]).some((o) => o.id === 'obj.switch'));
check('조건이 안 된 오브젝트는 살펴봐도 무시', inspect(gated, g, 'obj.switch').state === g);
g = inspect(gated, g, 'obj.wiring').state;
check('조건을 채우면 오브젝트가 보인다', visibleObjects(g, gated.scenes[0]).some((o) => o.id === 'obj.switch'));

// 게임·체크포인트·조각
let game = openCase(newGame('case1'), data);
check('사건을 펼치면 체크포인트가 남는다', game.checkpoints.case1 && currentCase(game) === game.checkpoints.case1);
const withFragment = { ...currentCase(game), have: [...currentCase(game).have, 'clue.ledgercopy'] };
game = updateCase(game, data, withFragment, ['clue.ledgercopy']);
check('조각 단서를 얻으면 메인 스토리 조각이 모인다', game.fragments.includes('frag.ledger'));
check('다시 펼쳐도 상태가 유지된다', openCase(game, data).cases.case1 === withFragment);
game = restartCase(game, data);
check('사건 처음부터: 체크포인트로 돌아가고 그 사건의 조각은 빠진다',
  currentCase(game) === game.checkpoints.case1 && !game.fragments.includes('frag.ledger'));

// 저장 코드
game = updateCase(game, data, st, []);
const code = encodeGame(game);
const back = decodeGame(code);
check('저장 코드 왕복', back.ok && JSON.stringify(back.game) === JSON.stringify(game));
check('공백·줄바꿈이 섞여도 읽는다', decodeGame(code.replace(/(.{40})/g, '$1\n ')).ok);
check('잘린 코드는 거절', !decodeGame(code.slice(0, -10)).ok);
check('다른 게임 코드는 거절', decodeGame('hello').reason === '무진 사건부의 저장 코드가 아닙니다.');
check('버전이 다르면 old', checkGame({ ...game, v: 99 }) === 'old');
check('모양이 틀리면 broken', checkGame({ ...game, cases: { case1: { sceneId: 3 } } }) === 'broken');

// ---------- M3: 퍼즐·메모·심문·보고서·장 진행 ----------
const { solvePuzzle, puzzleOpen } = await import('../js/engine/clues.js');
const { notePages, turnNote } = await import('../js/engine/hints.js');
const { findSuspect, currentRound, hear, present, suspectDone } = await import('../js/engine/interrogation.js');
const { canReport, grade, closeCase } = await import('../js/engine/accusation.js');
const { chapterStatus } = await import('../js/engine/game.js');
const wiring = await import('../js/puzzles/wiring.js');
const lock = await import('../js/puzzles/lock.js');
const pieces = await import('../js/puzzles/pieces.js');
const story = JSON.parse(await readFile(path.join(ROOT, 'data/story.json'), 'utf8'));
const P = (id) => data.puzzles.find((p) => p.id === id);

check('배선: 정답', wiring.check(P('p.mixer').config, { tape: 'in2', timer: 'remote', amp: 'all' }));
check('배선: 하나 틀림', !wiring.check(P('p.mixer').config, { tape: 'in1', timer: 'remote', amp: 'all' }));
check('자물쇠: 정답, 공백 무시', lock.check(P('p.lock').config, ' 4196 '));
check('자물쇠: 오답', !lock.check(P('p.lock').config, '1469'));
check('조각: 처음 순서는 정답이 아니다', !pieces.check(P('p.tape').config, pieces.initialOrder(P('p.tape').config)));
check('조각: 정답', pieces.check(P('p.tape').config, ['t1', 't2', 't3', 't4', 't5']));

let play = newCaseState(data);
check('믹서를 살펴보기 전엔 퍼즐이 안 열린다', !puzzleOpen(data, play, 'p.mixer'));
check('안 열린 퍼즐은 풀 수 없다', solvePuzzle(data, play, 'p.mixer').state === play);
play = inspect(data, play, 'obj.mixer').state;
check('믹서를 살펴보면 퍼즐이 열린다', puzzleOpen(data, play, 'p.mixer'));

check('메모: 처음엔 한 장도 안 넘김', notePages(data, play, 'p.mixer').shown.length === 0);
for (let i = 0; i < 3; i++) play = turnNote(data, play, 'p.mixer');
check('메모 세 장 뒤에도 풀이 장은 아직', notePages(data, play, 'p.mixer').answer === '' && notePages(data, play, 'p.mixer').more);
play = turnNote(data, play, 'p.mixer');
check('네 번째로 넘기면 풀이 장', notePages(data, play, 'p.mixer').answer === P('p.mixer').answerNote && !notePages(data, play, 'p.mixer').more);
check('그 뒤로는 더 넘어가지 않는다', turnNote(data, play, 'p.mixer').notes['p.mixer'] === 4);

r = solvePuzzle(data, play, 'p.mixer');
check('믹서 풀이 → 예약 방송 단서', r.gained.includes('clue.timer') && r.state.log.some((e) => e.k === 'solve'));
check('푼 퍼즐은 다시 안 열린다', !puzzleOpen(data, r.state, 'p.mixer'));
play = r.state;

// 탐색 전부 → 나머지 퍼즐 → 심문 → 보고서
for (const scene of data.scenes) {
  play = move(data, play, scene.id);
  for (const obj of visibleObjects(play, scene)) play = inspect(data, play, obj.id).state;
}
play = solvePuzzle(data, play, 'p.lock').state;
play = solvePuzzle(data, play, 'p.tape').state;
check('감리 일지 사본(메인 조각) 확보', play.have.includes('clue.ledgercopy'));

const kang = findSuspect(data, 's.kang');
let round = currentRound(play, kang);
check('강지훈 1라운드부터', round.id === 'r.kang.1');
r = present(data, play, round, 'st.kang.leave', 'clue.shell');
check('틀린 증거: wrong, 불안도만 오름', r.result === 'wrong' && r.state.unease > 0 && !r.state.have.includes('st.kang.leave'));
play = r.state;
r = present(data, play, round, 'st.kang.leave', 'clue.gatelog');
check('맞는 증거: 모순 증명', r.result === 'proven' && !r.roundDone);
play = r.state;
check('같은 진술에 다시 내밀면 already', present(data, play, round, 'st.kang.leave', 'clue.gatelog').result === 'already');
check('보고서는 아직', !canReport(data, play));
play = present(data, play, round, 'st.kang.key', 'clue.keyledger').state;
r = present(data, play, round, 'st.kang.work', 'clue.inquiry');
check('모순을 다 짚으면 라운드가 닫힌다', r.roundDone && r.state.have.includes('r.kang.1'));
play = r.state;
check('보고서를 쓸 수 있다', canReport(data, play));

const gu = findSuspect(data, 's.gu');
play = hear(data, play, currentRound(play, gu)).state;
check('구순자 증언을 들으면 소문 단서', play.have.includes('clue.rumor'));
check('짚을 모순이 없는 라운드는 듣는 것으로 끝난다', suspectDone(play, gu) && !currentRound(play, gu));
round = currentRound(play, kang);
check('테이프를 풀었으니 강지훈 2라운드', round?.id === 'r.kang.2');
play = present(data, play, round, 'st.kang.name', 'clue.rumor').state;
check('강지훈: 다 들었다', suspectDone(play, kang));

// ---------- M4: 들은 진술, 대조표, 보고서 메모 ----------
const { boardSheets, connect, linkedLines } = await import('../js/engine/board.js');
// 위 흐름에서 강지훈은 present만 거쳤다. 화면처럼 라운드를 들은 것으로 한다.
for (const rd of kang.rounds) play = hear(data, play, rd).state;
check('들은 진술이 기록된다', ['st.kang.leave', 'st.gu.rumor', 'st.kang.name'].every((id) => play.heard.includes(id)));
check('이미 들은 라운드를 다시 들어도 상태가 그대로', hear(data, play, kang.rounds[0]).state === play);
check('대조표 오른쪽에 들은 진술이 올라간다', boardSheets(data, play).statements.some((x) => x.statement.id === 'st.kang.leave'));
let b = connect(data, play, 'clue.gatelog', 'st.kang.leave');
check('대조: 맞는 두 줄 → linked', b.result === 'linked' && b.state.have.includes('b.gate'));
check('대조: 순서를 바꿔도 같다', connect(data, play, 'st.kang.leave', 'clue.gatelog').result === 'linked');
play = b.state;
check('대조: 다시 짚으면 already', connect(data, play, 'clue.gatelog', 'st.kang.leave').result === 'already');
check('대조: 안 맞는 두 줄 → none, 상태 그대로', connect(data, play, 'clue.shell', 'clue.timer').state === play);
check('대조: 같은 줄 두 번은 none', connect(data, play, 'clue.timer', 'clue.timer').result === 'none');
check('대조: 모르는 줄은 none', connect(data, newCaseState(data), 'clue.gatelog', 'st.kang.leave').result === 'none');
check('맞물린 줄 목록', linkedLines(data, play).map((l) => l.id).join() === 'b.gate');

let rn = newCaseState(data);
for (let i = 0; i < 5; i++) rn = turnNote(data, rn, 'report');
check('보고서 메모: 세 장에서 멈추고 풀이 장은 없다', rn.notes.report === 3 && !notePages(data, rn, 'report').more && notePages(data, rn, 'report').answer === '');

const right = {
  culprit: { answer: 's.kang', evidence: ['clue.gatelog', 'clue.keyledger'] },
  method: { answer: 'm.timer', evidence: ['clue.timer', 'clue.autopsy'] },
  motive: { answer: 'mo.ledger', evidence: ['clue.inquiry'] },
};
check('보고서 정답', grade(data, right).correct);
check('범인만 틀림 → 범인 칸만', grade(data, { ...right, culprit: { answer: 's.min', evidence: ['clue.gatelog'] } }).wrong.join() === 'culprit');
check('근거가 틀리면 그 칸이 어긋난다', grade(data, { ...right, method: { answer: 'm.timer', evidence: ['clue.shell'] } }).wrong.join() === 'method');
check('근거 셋은 안 된다', grade(data, { ...right, method: { answer: 'm.timer', evidence: ['clue.timer', 'clue.autopsy', 'clue.handrail'] } }).wrong.join() === 'method');
check('근거 없음은 안 된다', !grade(data, { ...right, motive: { answer: 'mo.ledger', evidence: [] } }).correct);

const prologueData = JSON.parse(await readFile(path.join(ROOT, 'data/cases/prologue.json'), 'utf8'));
const fresh = newGame('prologue');
check('장 진행: 처음엔 프롤로그만 열리고 사건 1은 locked', chapterStatus(story, fresh).prologue === 'open' && chapterStatus(story, fresh).case1 === 'locked');
let g2 = openCase(fresh, prologueData);
g2 = updateCase(g2, prologueData, closeCase(currentCase(g2)));
check('장 진행: 프롤로그를 닫으면 사건 1 open', chapterStatus(story, g2).case1 === 'open');
g2 = openCase(g2, data);
const notReady = story.chapters.find((c) => !c.ready)?.id;
check('장 진행: 데이터 없는 장은 missing', !notReady || chapterStatus(story, g2)[notReady] === 'missing');
check('장 진행: 펼친 사건은 active, 다음 사건은 locked', chapterStatus(story, g2).case1 === 'active' && chapterStatus(story, g2).case2 === 'locked');
g2 = updateCase(g2, data, closeCase(currentCase(g2)));
check('장 진행: 보고서 통과 → solved, 다음 사건 open', chapterStatus(story, g2).case1 === 'solved' && chapterStatus(story, g2).case2 === 'open' && chapterStatus(story, g2).case3 === 'locked');
check('저장 코드: 새 필드(notes·unease·solved)도 통과', checkGame(updateCase(g2, data, play)) === 'ok' && decodeGame(encodeGame(updateCase(g2, data, play))).ok);

// ---------- M5: 새 퍼즐 유형 ----------
const restore = await import('../js/puzzles/restore.js');
const sort = await import('../js/puzzles/sort.js');
const movePz = await import('../js/puzzles/move.js');
const rcfg = { text: '세탁 14:40', target: 72, tolerance: 7, answer: '14:40' };
check('복원: 빛이 맞으면 다 읽힌다', restore.maskText(rcfg.text, restore.blur(rcfg, 75)) === rcfg.text);
check('복원: 빛이 멀면 가려진다', restore.maskText(rcfg.text, restore.blur(rcfg, 5)).includes('░'));
check('복원: 더 멀수록 더 가려진다',
  [...restore.maskText(rcfg.text, restore.blur(rcfg, 5))].filter((c) => c === '░').length
  >= [...restore.maskText(rcfg.text, restore.blur(rcfg, 50))].filter((c) => c === '░').length);
check('복원: 공백 섞인 답도 맞다', restore.check(rcfg, ' 14:40 ') && !restore.check(rcfg, '14:04'));
const scfg = { answer: { a: 'x', b: 'y' } };
check('분류: 정답/오답', sort.check(scfg, { a: 'x', b: 'y' }) && !sort.check(scfg, { a: 'x' }));
const mcfg = { answer: 'w', items: [{ id: 'b', label: '침대', text: '벽지뿐' }, { id: 'w', label: '옷장' }] };
check('옮기기: 정답/오답, 틀린 것은 그 뒤 글', movePz.check(mcfg, 'w') && !movePz.check(mcfg, 'b') && movePz.wrongText(mcfg, 'b') === '벽지뿐');

// ---------- M6: 신호·광학·시간표 ----------
const morse = await import('../js/puzzles/morse.js');
const optics = await import('../js/puzzles/optics.js');
const timeline = await import('../js/puzzles/timeline.js');
const mc = { answer: 'SOS2247', signal: ['···', '/', '——'] };
check('모스: 띄어쓰기·소문자·빗금 섞여도 맞다', morse.check(mc, 'sos / 22 47') && !morse.check(mc, 'SOS2274'));
check('모스: 기호를 짧/길로 읽는다', morse.spoken(mc.signal) === '짧 짧 짧, 쉼, 길 길');
const oc = { mirrors: [{ id: 'a', label: '아래 거울' }, { id: 'b', label: '위 거울' }], answer: { a: 45, b: 135 } };
check('광학: 정답', optics.check(oc, { a: 45, b: '135' }));
check('광학: 처음 어긋난 거울을 알려 준다', optics.wrongText(oc, { a: 45, b: 90 }).includes('위 거울') && optics.wrongText(oc, { a: 0, b: 90 }).includes('아래 거울'));
const tc = { answer: ['x', 'y', 'z'] };
check('시간표: 처음 순서는 정답이 아니고 정답은 통과', !timeline.check(tc, timeline.initialOrder(tc)) && timeline.check(tc, ['x', 'y', 'z']));

// ---------- 준비된 모든 사건을 엔진만으로 끝까지 풀어 본다 ----------
const { PUZZLES } = await import('../js/puzzles/index.js');
const { complete, askHan, hanLine } = await import('../js/engine/clues.js');
const { skipRound } = await import('../js/engine/interrogation.js');
const { decideEnding, confrontationProven } = await import('../js/engine/final.js');
// 재구성은 가진 조각에 따라 정답이 달라진다: 놓을 수 있는 칸엔 가진 조각, 나머진 빈칸
const answerOf = (p, have = new Set()) => (p.type === 'reconstruct'
  ? Object.fromEntries(p.config.rows.map((r) => [r.id, r.accept.find((id) => have.has(id)) ?? '']))
  : p.config.answer);
const WRONG = {
  wiring: () => ({}),
  lock: () => '0000',
  pieces: (p) => [...p.config.answer].reverse(),
  restore: () => 'x',
  sort: () => ({}),
  move: () => null,
  morse: () => 'SOS',
  optics: () => ({}),
  timeline: (p) => [...p.config.answer].reverse(),
  reconstruct: (p) => Object.fromEntries(p.config.rows.map((r) => [r.id, 'clue.nope'])),
};
const wrongOf = (p) => WRONG[p.type](p);

// 화면에서 할 수 있는 일을 바뀌는 게 없을 때까지 되풀이한다.
// 짚을 증거가 없는 단계는 skippable이면 넘어간다.
function autoplay(cd, start) {
  let s = start;
  let guard = 0;
  let changed = true;
  const puzzleOk = [];
  while (changed && guard++ < 60) {
    const before = JSON.stringify(s);
    for (const scene of openScenes(cd, s)) {
      s = move(cd, s, scene.id);
      for (const obj of visibleObjects(s, findScene(cd, scene.id))) s = inspect(cd, s, obj.id).state;
    }
    s = askHan(cd, s);
    for (const p of cd.puzzles) {
      if (!puzzleOpen(cd, s, p.id)) continue;
      const kind = PUZZLES[p.type];
      const ctx = { have: new Set(s.have) };
      puzzleOk.push(kind.check(p.config, answerOf(p, ctx.have), ctx) && !kind.check(p.config, wrongOf(p), ctx));
      s = solvePuzzle(cd, s, p.id).state;
    }
    for (const sus of cd.suspects) {
      const rd = currentRound(s, sus);
      if (!rd) continue;
      s = hear(cd, s, rd).state;
      for (const stmt of rd.statements) {
        const c = (stmt.contradictedBy ?? []).find((id) => s.have.includes(id));
        if (c) s = present(cd, s, rd, stmt.id, c).state;
      }
      if (!s.have.includes(rd.id) && rd.skippable) s = skipRound(s, rd);
    }
    for (const l of cd.board ?? []) s = connect(cd, s, l.left, l.right).state;
    changed = JSON.stringify(s) !== before;
  }
  return { s, puzzleOk };
}

const fullGame = (cd, fragments) => openCase({ ...newGame(cd.id), fragments }, cd);
const allFrags = story.fragments.map((f) => f.id);

for (const ch of story.chapters.filter((c) => c.ready)) {
  const cd = JSON.parse(await readFile(path.join(ROOT, 'data', ch.file), 'utf8'));
  const game = fullGame(cd, allFrags);
  const { s, puzzleOk } = autoplay(cd, currentCase(game));
  const allClues = cd.clues.every((c) => s.have.includes(c.id));
  check(`${ch.id}: 퍼즐 정답은 맞고 오답은 틀린다`, puzzleOk.length === cd.puzzles.length && puzzleOk.every(Boolean));
  check(`${ch.id}: 끝까지 풀면 단서를 전부 얻는다`, allClues, cd.clues.filter((c) => !s.have.includes(c.id)).map((c) => c.id).join(', '));
  check(`${ch.id}: 용의자를 다 들었다`, cd.suspects.every((sus) => suspectDone(s, sus)));
  check(`${ch.id}: 대조 줄을 다 짚었다`, linkedLines(cd, s).length === (cd.board ?? []).length);
  if ((cd.kind ?? 'case') === 'case') {
    const answers = Object.fromEntries(['culprit', 'method', 'motive'].map((q) =>
      [q, { answer: cd.solution[q], evidence: cd.solution.evidence[q].slice(0, 2) }]));
    check(`${ch.id}: 보고서를 쓸 수 있고 정답이 통과한다`, canReport(cd, s) && grade(cd, answers).correct);
  } else {
    check(`${ch.id}: 닫히는 조건에 닿는다`, complete(cd, s));
  }
  if (cd.han?.length) check(`${ch.id}: 한도윤에게 물으면 글 흐름에 한 줄 남는다`, s.log.some((e) => e.k === 'han' && e.id === `han.${hanLine(cd, s)}`));
}

// ---------- M7: 최종장 엔딩 ----------
const fd = JSON.parse(await readFile(path.join(ROOT, 'data/final.json'), 'utf8'));
{
  const g = fullGame(fd, allFrags);
  check('최종장: 모은 조각 다섯이 단서로 넘어온다', fd.clues.filter((c) => c.carry).every((c) => currentCase(g).have.includes(c.id)));
  const { s } = autoplay(fd, currentCase(g));
  check('최종장: 조각을 다 모으면 대면을 넘김 없이 증명한다', confrontationProven(fd, s));
  check('엔딩: 거절 → 진실', decideEnding({ data: fd, story, game: g, st: s, accept: false }) === 'truth');
  check('엔딩: 받아들임 → 은폐', decideEnding({ data: fd, story, game: g, st: s, accept: true }) === 'cover');
}
{
  // 사건 2·3·4의 조각을 놓친 채로 왔다
  const some = ['frag.ledger', 'frag.register'];
  const g = fullGame(fd, some);
  check('최종장: 놓친 조각은 넘어오지 않는다', !currentCase(g).have.includes('clue.cf.tab'));
  const { s, puzzleOk } = autoplay(fd, currentCase(g));
  check('최종장: 조각이 모자라도 빈칸을 두고 타임라인을 넘어간다', s.have.includes('p.timeline') && puzzleOk.every(Boolean));
  check('최종장: 증거 없는 단계는 넘어가고 끝까지 닿는다', complete(fd, s) && (s.skipped ?? []).length > 0);
  check('엔딩: 조각이 모자라면 거절해도 불완전', decideEnding({ data: fd, story, game: g, st: s, accept: false }) === 'partial');
}
{
  // 조각은 다 있어도 한 단계를 넘기면 진실 엔딩이 아니다
  const g = fullGame(fd, allFrags);
  let s = currentCase(g);
  s = autoplay(fd, s).s;
  const skippedOnce = { ...s, skipped: ['r.han.2'] };
  check('엔딩: 대면 한 단계를 넘겼으면 불완전', decideEnding({ data: fd, story, game: g, st: skippedOnce, accept: false }) === 'partial');
}
{
  const pd = JSON.parse(await readFile(path.join(ROOT, 'data/cases/prologue.json'), 'utf8'));
  let s = newCaseState(pd);
  s = askHan(pd, s);
  const once = s.log.length;
  s = askHan(pd, s);
  check('한도윤: 같은 말을 연달아 남기지 않는다', s.log.length === once);
  const { setPlayer } = await import('../js/engine/game.js');
  check('이름: 앞뒤 공백을 지우고 12자까지', setPlayer(newGame('prologue'), '  가나다라마바사아자차카타파하  ').player.length === 12);
}

console.log(`\n${failed ? `실패 ${failed}건` : `전부 통과 (${count}건)`}`);
process.exitCode = failed ? 1 : 0;
