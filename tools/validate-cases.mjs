// 사건 데이터 검증: "공정한 추리" 규칙을 데이터 단계에서 확인한다.
//
//   node tools/validate-cases.mjs            data/story.json에 등록된 장 전부
//   node tools/validate-cases.mjs a.json     지정한 사건 파일만
//   --strict                                 경고도 실패로 친다
//
// 오류가 하나라도 있으면 종료 코드 1.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { indexCase, explore } from '../js/engine/graph.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

// 2.8: 한 화면의 선택지, 장면의 살펴볼 곳, 라운드의 진술은 4개 이하.
const MAX_CHOICES = 4;
const HINT_PAGES = 3;
const PUZZLE_TYPES = ['wiring', 'lock', 'pieces', 'restore', 'sort', 'morse', 'optics', 'timeline', 'move', 'reconstruct'];

// 알 수 없는 키는 오류로 본다. 오타("give")를 잡고,
// 얻은 것을 다시 잃게 만드는 필드("once", "expires" 등)가 끼어드는 것을 막는다.
const KEYS = {
  case: ['schemaVersion', 'id', 'kind', 'chapter', 'title', 'difficulty', 'briefing', 'start', 'reportRequires', 'completeWhen',
    'objectives', 'scenes', 'puzzles', 'clues', 'suspects', 'board', 'accusation', 'solution', 'hints', 'han', 'result', 'endings', 'offer'],
  offer: ['text', 'accept', 'refuse'],
  briefing: ['summary', 'rumor', 'victim'],
  victim: ['name', 'age', 'role', 'text'],
  objective: ['when', 'text'],
  scene: ['id', 'name', 'alt', 'art', 'text', 'requires', 'objects'],
  object: ['id', 'label', 'hotspot', 'text', 'requires', 'gives', 'puzzle', 'input'],
  hotspot: ['x', 'y', 'w', 'h'],
  puzzle: ['id', 'type', 'title', 'requires', 'teaches', 'gives', 'config', 'answerNote', 'solvedText'],
  clue: ['id', 'name', 'text', 'people', 'image', 'alt', 'fragment', 'atmosphere', 'carry'],
  suspect: ['id', 'name', 'age', 'role', 'intro', 'onWrong', 'requires', 'suspectedBy', 'clearedBy', 'rounds'],
  round: ['id', 'requires', 'intro', 'statements', 'gives', 'skippable'],
  statement: ['id', 'text', 'contradictedBy', 'gives', 'onProven', 'reply'],
  link: ['id', 'left', 'right', 'sentence', 'gives'],
  accusation: ['method', 'motive'],
  option: ['id', 'text'],
  solution: ['culprit', 'method', 'motive', 'requires', 'evidence'],
  evidence: ['culprit', 'method', 'motive'],
  result: ['text'],
  han: ['when', 'text'],
  ending: ['title', 'text'],
};

// 2.6 서술 규칙에서 쓰지 않기로 한 표현. 경고만 낸다.
const STYLE_RULES = [
  [/(^|\s)것이다/, "'~것이다'"],
  [/에 대한/, "번역투 '~에 대한'"],
  [/되어지/, "이중 피동 '~되어지다'"],
  [/[이가] 아니라/, "'A가 아니라 B다' 구문"],
];
const POLITE = /(습니다|세요|해요|에요|예요|이죠)/;

export function validateCase(data, { label = '' } = {}) {
  const errors = [];
  const warnings = [];
  const err = (code, where, msg) => errors.push({ code, where, msg });
  const warn = (code, where, msg) => warnings.push({ code, where, msg });

  if (!isObj(data)) {
    err('SHAPE', label, '사건 파일의 최상위가 객체가 아니다');
    return { errors, warnings };
  }

  checkShape(data, err);

  const { ids, duplicates } = indexCase(data);
  for (const d of duplicates) err('DUP_ID', d.path, `id '${d.id}'가 ${d.firstPath}와 겹친다`);

  const kindOf = (id) => ids.get(id)?.kind;
  const ref = (id, kinds, where) => {
    if (typeof id !== 'string' || !id) return err('BAD_REF', where, '빈 참조');
    const kind = kindOf(id);
    if (!kind) return err('BAD_REF', where, `없는 id '${id}'`);
    if (kinds && !kinds.includes(kind)) err('BAD_REF', where, `'${id}'는 ${kind}. ${kinds.join('/')}여야 한다`);
  };
  const refs = (list, kinds, where) => (list ?? []).forEach((id, i) => ref(id, kinds, `${where}[${i}]`));

  // 참조 무결성
  refs(data.reportRequires, null, 'reportRequires');
  if (data.start) ref(data.start, ['scene'], 'start');
  else err('MISSING', 'start', '시작 장면이 없다');
  (data.objectives ?? []).forEach((o, i) => refs(o.when, null, `objectives[${i}].when`));

  each(data.scenes, 'scenes', (scene, sp) => {
    refs(scene.requires, null, `${sp}.requires`);
    each(scene.objects, `${sp}.objects`, (obj, op) => {
      refs(obj.requires, null, `${op}.requires`);
      refs(obj.gives, ['clue'], `${op}.gives`);
      if (obj.puzzle) ref(obj.puzzle, ['puzzle'], `${op}.puzzle`);
    });
  });
  each(data.puzzles, 'puzzles', (p, pp) => {
    refs(p.requires, null, `${pp}.requires`);
    refs(p.teaches, ['clue'], `${pp}.teaches`);
    refs(p.gives, ['clue'], `${pp}.gives`);
  });
  each(data.clues, 'clues', (c, cp) => refs(c.people, ['suspect'], `${cp}.people`));
  each(data.suspects, 'suspects', (s, sp) => {
    refs(s.requires, null, `${sp}.requires`);
    refs(s.suspectedBy, ['clue'], `${sp}.suspectedBy`);
    refs(s.clearedBy, ['clue'], `${sp}.clearedBy`);
    each(s.rounds, `${sp}.rounds`, (r, rp) => {
      refs(r.requires, null, `${rp}.requires`);
      refs(r.gives, ['clue'], `${rp}.gives`);
      each(r.statements, `${rp}.statements`, (st, stp) => {
        refs(st.contradictedBy, ['clue'], `${stp}.contradictedBy`);
        refs(st.gives, ['clue'], `${stp}.gives`);
        refs(st.onProven, ['clue'], `${stp}.onProven`);
      });
    });
  });
  each(data.board, 'board', (b, bp) => {
    ref(b.left, ['clue', 'statement'], `${bp}.left`);
    ref(b.right, ['clue', 'statement'], `${bp}.right`);
    refs(b.gives, ['clue'], `${bp}.gives`);
  });

  // kind: 'case'(보고서로 닫는 사건) | 'prologue' | 'final'(completeWhen으로 닫는다)
  const kind = data.kind ?? 'case';
  const isCase = kind === 'case';
  if (!['case', 'prologue', 'final'].includes(kind)) err('BAD_TYPE', 'kind', `알 수 없는 kind '${kind}'`);
  if (!isCase) {
    if (!data.completeWhen?.length) err('MISSING', 'completeWhen', `${kind}는 닫히는 조건(completeWhen)이 필요하다`);
    refs(data.completeWhen, null, 'completeWhen');
    if (data.solution || data.accusation) warn('UNUSED', 'solution', `${kind}에는 보고서가 없다. solution·accusation은 쓰이지 않는다`);
  }
  if (kind === 'final') {
    for (const e of ['truth', 'partial', 'cover']) {
      const end = data.endings?.[e];
      if (!nonEmpty(end?.title) || !Array.isArray(end?.text) || !end.text.length) err('MISSING', `endings.${e}`, '엔딩의 title과 text가 필요하다');
    }
    if (!(data.suspects ?? []).some((s) => (s.rounds ?? []).some((r) => r.skippable))) {
      warn('NO_SKIP', 'suspects', '대면에 넘어갈 수 있는 단계(skippable)가 없으면 조각이 모자랄 때 막힌다');
    }
  }
  (data.han ?? []).forEach((line, i) => {
    refs(line.when, null, `han[${i}].when`);
    if (!nonEmpty(line.text)) err('MISSING_TEXT', `han[${i}].text`, '한도윤의 말이 비었다');
  });

  const sol = data.solution ?? {};
  if (!data.solution) { if (isCase) err('MISSING', 'solution', '정답이 없다'); }
  else {
    ref(sol.culprit, ['suspect'], 'solution.culprit');
    ref(sol.method, ['method'], 'solution.method');
    ref(sol.motive, ['motive'], 'solution.motive');
    refs(sol.requires, ['clue'], 'solution.requires');
    for (const q of ['culprit', 'method', 'motive']) {
      const ev = sol.evidence?.[q] ?? [];
      if (!ev.length) err('NO_EVIDENCE', `solution.evidence.${q}`, '근거 단서가 하나도 없다');
      refs(ev, ['clue'], `solution.evidence.${q}`);
      for (const id of ev) {
        if (!(sol.requires ?? []).includes(id)) {
          err('EVIDENCE_NOT_REQUIRED', `solution.evidence.${q}`, `'${id}'가 solution.requires에 없다`);
        }
      }
    }
  }

  // 2.8 선택지 수
  each(data.scenes, 'scenes', (scene, sp) => {
    if ((scene.objects ?? []).length > MAX_CHOICES) {
      err('TOO_MANY', `${sp}.objects`, `살펴볼 곳이 ${scene.objects.length}곳. ${MAX_CHOICES}곳 이하로`);
    }
  });
  if ((data.scenes ?? []).length > MAX_CHOICES) warn('TOO_MANY', 'scenes', `장면이 ${data.scenes.length}개`);
  if ((data.suspects ?? []).length > MAX_CHOICES) {
    err('TOO_MANY', 'suspects', `용의자가 ${data.suspects.length}명. 범인 문항 선택지가 ${MAX_CHOICES}개를 넘는다`);
  }
  each(data.suspects, 'suspects', (s, sp) => each(s.rounds, `${sp}.rounds`, (r, rp) => {
    if ((r.statements ?? []).length > MAX_CHOICES) {
      err('TOO_MANY', `${rp}.statements`, `진술이 ${r.statements.length}개. ${MAX_CHOICES}개 이하로`);
    }
  }));
  for (const q of isCase ? ['method', 'motive'] : []) {
    const n = (data.accusation?.[q] ?? []).length;
    if (n > MAX_CHOICES) err('TOO_MANY', `accusation.${q}`, `선택지가 ${n}개`);
    if (n < 2) err('TOO_FEW', `accusation.${q}`, '선택지가 2개 미만이면 추리가 아니다');
  }

  // 접근성: 이름과 대체 텍스트
  each(data.scenes, 'scenes', (scene, sp) => {
    if (!nonEmpty(scene.name)) err('MISSING_NAME', `${sp}.name`, '장면 이름이 비었다');
    if (!nonEmpty(scene.alt)) err('MISSING_ALT', `${sp}.alt`, '장면 대체 텍스트가 비었다');
    each(scene.objects, `${sp}.objects`, (obj, op) => {
      if (!nonEmpty(obj.label)) err('MISSING_NAME', `${op}.label`, '살펴볼 곳의 이름(스크린리더가 읽는 이름)이 비었다');
      const h = obj.hotspot;
      if (h && !['x', 'y', 'w', 'h'].every((k) => typeof h[k] === 'number' && h[k] >= 0 && h[k] <= 100)) {
        err('BAD_HOTSPOT', `${op}.hotspot`, '핫스팟 좌표는 0~100 퍼센트');
      }
    });
  });
  // 단서는 사건부에 남아 여러 화면에서 다시 읽힌다. 짧고, 이름을 되풀이하지 않고, 이름은 명사로.
  const CLUE_MAX = 90;
  each(data.clues, 'clues', (c, cp) => {
    if (!nonEmpty(c.name)) err('MISSING_NAME', `${cp}.name`, '단서 이름이 비었다');
    if (!nonEmpty(c.text)) err('MISSING_TEXT', `${cp}.text`, '단서 설명이 비었다');
    if (nonEmpty(c.text) && c.text.length > CLUE_MAX) warn('CLUE_LONG', `${cp}.text`, `단서 설명 ${c.text.length}자. ${CLUE_MAX}자 안으로`);
    if (nonEmpty(c.text) && nonEmpty(c.name) && c.text.startsWith(c.name)) warn('CLUE_ECHO', `${cp}.text`, '설명이 이름을 되풀이하며 시작한다');
    if (nonEmpty(c.name) && /다$/.test(c.name)) warn('CLUE_NAME', `${cp}.name`, `이름이 문장이다("${c.name}를 내민다"처럼 어색해진다)`);
    if (c.image && !nonEmpty(c.alt)) err('MISSING_ALT', `${cp}.alt`, '단서 이미지에 대체 텍스트가 없다');
  });

  // 퍼즐: 유형, 여는 곳, 서진우 메모 세 장, 풀이 장
  const openers = new Map();
  for (const scene of data.scenes ?? []) {
    for (const obj of scene.objects ?? []) if (obj.puzzle) openers.set(obj.puzzle, obj.id);
  }
  const hints = data.hints ?? {};
  each(data.puzzles, 'puzzles', (p, pp) => {
    if (!PUZZLE_TYPES.includes(p.type)) err('BAD_TYPE', `${pp}.type`, `알 수 없는 퍼즐 유형 '${p.type}'`);
    if (!openers.has(p.id)) err('NO_OPENER', pp, `퍼즐 '${p.id}'를 여는 오브젝트가 없다`);
    if (!p.teaches?.length) err('NO_TEACHER', `${pp}.teaches`, '풀이 방법을 알려 주는 현장 단서가 없다(7.2)');
    if (!p.gives?.length) err('NO_REWARD', `${pp}.gives`, '퍼즐이 단서를 열어 주지 않는다(7장)');
    if (!nonEmpty(p.answerNote)) err('MISSING_HINT', `${pp}.answerNote`, '메모 세 장 뒤에 열리는 풀이 장이 없다');
    const pages = hints[p.id];
    if (!Array.isArray(pages) || pages.length !== HINT_PAGES || !pages.every(nonEmpty)) {
      err('MISSING_HINT', `hints.${p.id}`, `서진우 메모는 퍼즐마다 정확히 ${HINT_PAGES}장`);
    } else {
      pages.forEach((page, i) => {
        if (POLITE.test(page)) warn('VOICE', `hints.${p.id}[${i}]`, '서진우 메모에 존댓말. 가짜 페이지가 아니면 반말 메모체로');
      });
    }
    checkPuzzleConfig(p, pp, err);
    if (p.type === 'reconstruct') {
      (p.config?.rows ?? []).forEach((row, i) => refs(row.accept, ['clue'], `${pp}.config.rows[${i}].accept`));
    }
  });
  for (const key of Object.keys(hints)) {
    if (key === 'report') {
      // 보고서 메모: 풀이 장 없이 세 장
      const pages = hints.report;
      if (!Array.isArray(pages) || pages.length !== HINT_PAGES || !pages.every(nonEmpty)) {
        err('MISSING_HINT', 'hints.report', `보고서 메모는 정확히 ${HINT_PAGES}장`);
      }
    } else if (kindOf(key) !== 'puzzle') {
      err('BAD_REF', `hints.${key}`, `'${key}'는 퍼즐도 report도 아니다`);
    }
  }
  each(data.suspects, 'suspects', (s, sp) => {
    if (!Array.isArray(s.onWrong) || !s.onWrong.length || !s.onWrong.every(nonEmpty)) {
      warn('NO_ON_WRONG', `${sp}.onWrong`, '증거를 잘못 내밀었을 때 굳는 말투(onWrong)가 없다. 기본 문장이 나온다');
    }
  });

  // 도달 가능성: 끝까지 열어 보고 닫힌 채 남은 것을 찾는다
  const full = explore(data);
  const reach = (id) => full.have.has(id);
  const statementHeard = (id) => full.heard.has(id);

  for (const [id, { kind, path: where }] of ids) {
    if (['scene', 'object', 'puzzle'].includes(kind) && !reach(id)) {
      if (kind === 'puzzle') {
        const cycle = findCycle(id, data, ids, full);
        if (cycle) err('PUZZLE_CYCLE', where, `선행 조건이 돌고 돈다: ${cycle.join(' → ')}`);
        else err('UNREACHABLE', where, `퍼즐 '${id}'를 풀 수 있는 상태에 닿지 못한다`);
      } else {
        err('UNREACHABLE', where, `${kind} '${id}'에 닿지 못한다`);
      }
    }
    if (kind === 'clue' && !reach(id)) {
      err('UNREACHABLE_CLUE', where, `단서 '${id}'를 얻을 길이 없다`);
    }
  }
  (sol.requires ?? []).forEach((id, i) => {
    if (kindOf(id) === 'clue' && !reach(id)) {
      err('SOLUTION_UNREACHABLE', `solution.requires[${i}]`, `정답에 필요한 '${id}'를 얻을 수 없다`);
    }
  });
  (data.reportRequires ?? []).forEach((id, i) => {
    if (kindOf(id) && !reach(id)) err('UNREACHABLE', `reportRequires[${i}]`, `보고서 조건 '${id}'에 닿지 못한다`);
  });
  (data.completeWhen ?? []).forEach((id, i) => {
    if (kindOf(id) && !reach(id)) err('UNREACHABLE', `completeWhen[${i}]`, `닫히는 조건 '${id}'에 닿지 못한다`);
  });

  // 진술 모순과 용의자 소거
  each(data.suspects, 'suspects', (s, sp) => {
    const isCulprit = s.id === sol.culprit;
    // 4.2: 용의자마다 의심 지점 하나, 범인이 아니면 반증 단서 하나(보고서로 닫는 사건만)
    if (isCase && !s.suspectedBy?.length) err('NO_SUSPICION', `${sp}.suspectedBy`, `'${s.id}'를 의심할 지점이 없다`);
    (s.suspectedBy ?? []).forEach((id, i) => {
      if (kindOf(id) === 'clue' && !reach(id)) {
        err('SUSPICION_UNREACHABLE', `${sp}.suspectedBy[${i}]`, `의심 단서 '${id}'를 얻을 수 없다`);
      }
    });
    each(s.rounds, `${sp}.rounds`, (r, rp) => each(r.statements, `${rp}.statements`, (st, stp) => {
      if (!nonEmpty(st.text)) err('MISSING_TEXT', `${stp}.text`, '진술이 비었다');
      if (!statementHeard(st.id)) err('UNREACHABLE', stp, `진술 '${st.id}'를 들을 수 없다`);
      const by = st.contradictedBy ?? [];
      if (by.length && !by.some(reach)) {
        err('CONTRADICTION_UNREACHABLE', `${stp}.contradictedBy`, `모순 단서를 하나도 얻을 수 없다`);
      }
    }));
    if (!isCase) {
      // 최종장 대면: 단계마다 짚을 모순이 있어야 한다
      (s.rounds ?? []).forEach((r, i) => {
        if (!(r.statements ?? []).some((x) => x.contradictedBy?.length)) {
          warn('NO_CONTRADICTION', `${sp}.rounds[${i}]`, '이 단계엔 짚을 모순이 없다');
        }
      });
    } else if (isCulprit) {
      if (s.clearedBy?.length) err('CULPRIT_CLEARED', `${sp}.clearedBy`, '범인에게 소거 단서가 있다');
      const contradictions = (s.rounds ?? []).flatMap((r) => r.statements ?? []).filter((st) => st.contradictedBy?.length);
      if (!contradictions.length) err('NO_CONTRADICTION', sp, '범인 진술에 증명할 모순이 하나도 없다');
    } else {
      if (!s.clearedBy?.length) err('NO_CLEARING_CLUE', `${sp}.clearedBy`, `범인이 아닌 '${s.id}'를 소거할 단서가 없다`);
      (s.clearedBy ?? []).forEach((id, i) => {
        if (kindOf(id) === 'clue' && !reach(id)) {
          err('CLEARING_UNREACHABLE', `${sp}.clearedBy[${i}]`, `소거 단서 '${id}'를 얻을 수 없다`);
        }
      });
    }
  });
  each(data.board, 'board', (b, bp) => {
    if (!reach(b.id)) err('UNREACHABLE', bp, `대조 줄 '${b.id}'의 두 줄을 함께 짚을 수 없다`);
    if (!nonEmpty(b.sentence)) err('MISSING_TEXT', `${bp}.sentence`, '짚었을 때 완성되는 관계 문장이 없다');
  });

  // 7.2: 풀이를 알려 주는 단서는 그 퍼즐을 풀기 전에 얻을 수 있어야 한다
  each(data.puzzles, 'puzzles', (p, pp) => {
    if (!p.teaches?.length) return;
    const without = explore(data, { block: [p.id] });
    p.teaches.forEach((id, i) => {
      if (kindOf(id) === 'clue' && !without.have.has(id)) {
        err('TEACHES_TOO_LATE', `${pp}.teaches[${i}]`, `'${id}'는 '${p.id}'를 풀어야만 얻을 수 있다`);
      }
    });
  });

  // 어디에도 쓰이지 않는 단서
  const used = new Set();
  const use = (list) => (list ?? []).forEach((id) => used.add(id));
  (data.objectives ?? []).forEach((o) => use(o.when));
  (data.han ?? []).forEach((h) => use(h.when));
  use(data.completeWhen);
  use(data.reportRequires);
  for (const p of data.puzzles ?? []) {
    if (p.type === 'reconstruct') for (const row of p.config?.rows ?? []) use(row.accept);
  }
  for (const scene of data.scenes ?? []) {
    use(scene.requires);
    for (const obj of scene.objects ?? []) use(obj.requires);
  }
  for (const p of data.puzzles ?? []) { use(p.requires); use(p.teaches); }
  for (const s of data.suspects ?? []) {
    use(s.requires); use(s.suspectedBy); use(s.clearedBy);
    for (const r of s.rounds ?? []) {
      use(r.requires);
      for (const st of r.statements ?? []) use(st.contradictedBy);
    }
  }
  for (const b of data.board ?? []) use([b.left, b.right]);
  use(sol.requires);
  each(data.clues, 'clues', (c, cp) => {
    if (!used.has(c.id) && !c.fragment && !c.atmosphere) {
      warn('UNUSED_CLUE', cp, `단서 '${c.id}'가 추리 어디에도 쓰이지 않는다. 분위기용이면 atmosphere: true`);
    }
  });

  // 서술 규칙
  walkStrings(data, '', (text, where) => {
    for (const [re, name] of STYLE_RULES) {
      if (re.test(text)) warn('STYLE', where, `${name}: "${clip(text)}"`);
    }
  });

  return { errors, warnings };
}

export function validateStory(story, cases) {
  const errors = [];
  const warnings = [];
  const err = (code, where, msg) => errors.push({ code, where, msg });

  const chapterIds = new Set();
  each(story.chapters, 'chapters', (ch, cp) => {
    if (chapterIds.has(ch.id)) err('DUP_ID', cp, `장 id '${ch.id}'가 겹친다`);
    chapterIds.add(ch.id);
  });
  each(story.chapters, 'chapters', (ch, cp) => {
    (ch.requires ?? []).forEach((id, i) => {
      if (!chapterIds.has(id)) err('BAD_REF', `${cp}.requires[${i}]`, `없는 장 '${id}'`);
    });
    const data = cases.get(ch.id);
    if (data && data.id !== ch.id) err('BAD_REF', cp, `파일 안의 id '${data.id}'가 장 id '${ch.id}'와 다르다`);
  });

  const listed = new Set();
  each(story.fragments, 'fragments', (f, fp) => {
    listed.add(f.id);
    if (!chapterIds.has(f.chapter)) return err('BAD_REF', `${fp}.chapter`, `없는 장 '${f.chapter}'`);
    const data = cases.get(f.chapter);
    if (!data) return;
    if (!(data.clues ?? []).some((c) => c.fragment === f.id)) {
      err('FRAGMENT_MISSING', fp, `'${f.chapter}'에 조각 '${f.id}'를 담은 단서가 없다`);
    }
  });
  for (const [chapter, data] of cases) {
    each(data.clues, 'clues', (c, cp) => {
      if (c.carry && !listed.has(c.carry)) {
        err('BAD_REF', `${chapter}: ${cp}.carry`, `story.json에 없는 조각 '${c.carry}'`);
      }
      if (c.fragment && !listed.has(c.fragment)) {
        err('BAD_REF', `${chapter}: ${cp}.fragment`, `story.json에 없는 조각 '${c.fragment}'`);
      }
    });
  }
  return { errors, warnings };
}

// ---------- 세부 검사 ----------

function checkShape(data, err) {
  const keys = (obj, kind, where) => {
    if (!isObj(obj)) return err('SHAPE', where, `${kind}는 객체여야 한다`);
    for (const k of Object.keys(obj)) {
      if (!KEYS[kind].includes(k)) err('UNKNOWN_KEY', `${where}.${k}`, `${kind}에 없는 키 '${k}'`);
    }
  };
  const list = (value, where) => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) { err('SHAPE', where, '배열이어야 한다'); return []; }
    return value;
  };

  keys(data, 'case', '');
  if (data.briefing) {
    keys(data.briefing, 'briefing', 'briefing');
    if (data.briefing.victim) keys(data.briefing.victim, 'victim', 'briefing.victim');
  }
  list(data.objectives, 'objectives').forEach((o, i) => keys(o, 'objective', `objectives[${i}]`));
  list(data.scenes, 'scenes').forEach((s, i) => {
    keys(s, 'scene', `scenes[${i}]`);
    list(s.objects, `scenes[${i}].objects`).forEach((o, j) => {
      keys(o, 'object', `scenes[${i}].objects[${j}]`);
      if (o?.hotspot) keys(o.hotspot, 'hotspot', `scenes[${i}].objects[${j}].hotspot`);
    });
  });
  list(data.puzzles, 'puzzles').forEach((p, i) => keys(p, 'puzzle', `puzzles[${i}]`));
  list(data.clues, 'clues').forEach((c, i) => keys(c, 'clue', `clues[${i}]`));
  list(data.suspects, 'suspects').forEach((s, i) => {
    keys(s, 'suspect', `suspects[${i}]`);
    list(s.rounds, `suspects[${i}].rounds`).forEach((r, j) => {
      keys(r, 'round', `suspects[${i}].rounds[${j}]`);
      list(r.statements, `suspects[${i}].rounds[${j}].statements`)
        .forEach((st, k) => keys(st, 'statement', `suspects[${i}].rounds[${j}].statements[${k}]`));
    });
  });
  list(data.board, 'board').forEach((b, i) => keys(b, 'link', `board[${i}]`));
  if (data.accusation) {
    keys(data.accusation, 'accusation', 'accusation');
    for (const q of ['method', 'motive']) {
      list(data.accusation[q], `accusation.${q}`).forEach((o, i) => keys(o, 'option', `accusation.${q}[${i}]`));
    }
  }
  if (data.solution) {
    keys(data.solution, 'solution', 'solution');
    if (data.solution.evidence) keys(data.solution.evidence, 'evidence', 'solution.evidence');
  }
  if (data.result) keys(data.result, 'result', 'result');
  list(data.han, 'han').forEach((h, i) => keys(h, 'han', `han[${i}]`));
  if (data.offer) keys(data.offer, 'offer', 'offer');
  if ((data.kind === 'final') && !(nonEmpty(data.offer?.accept) && nonEmpty(data.offer?.refuse) && data.offer?.text?.length)) {
    err('MISSING', 'offer', '최종장에는 한도윤의 제안(offer: text, accept, refuse)이 필요하다');
  }
  if (data.endings) {
    if (!isObj(data.endings)) err('SHAPE', 'endings', 'endings는 truth/partial/cover 객체');
    else {
      for (const [k, v] of Object.entries(data.endings)) {
        if (!['truth', 'partial', 'cover'].includes(k)) err('UNKNOWN_KEY', `endings.${k}`, `모르는 엔딩 '${k}'`);
        keys(v, 'ending', `endings.${k}`);
      }
    }
  }
  list(data.scenes, 'scenes').forEach((s, i) => list(s.objects, `scenes[${i}].objects`).forEach((o, j) => {
    if (o?.input !== undefined && o.input !== 'playerName') err('BAD_TYPE', `scenes[${i}].objects[${j}].input`, "input은 'playerName'만");
  }));
  if (data.hints !== undefined && !isObj(data.hints)) err('SHAPE', 'hints', 'hints는 퍼즐 id → 메모 배열');

  for (const field of ['id', 'title']) {
    if (!nonEmpty(data[field])) err('MISSING', field, `${field}가 비었다`);
  }
  if (!list(data.scenes, 'scenes').length) err('MISSING', 'scenes', '장면이 하나도 없다');
}

function checkPuzzleConfig(p, where, err) {
  const c = p.config;
  if (!isObj(c)) return err('BAD_CONFIG', `${where}.config`, 'config가 없다');
  const bad = (msg) => err('BAD_CONFIG', `${where}.config`, msg);

  if (p.type === 'wiring') {
    const plugs = new Set((c.plugs ?? []).map((x) => x.id));
    const jacks = new Set((c.jacks ?? []).map((x) => x.id));
    const answer = c.answer ?? {};
    for (const [plug, jack] of Object.entries(answer)) {
      if (!plugs.has(plug)) bad(`answer의 '${plug}'가 plugs에 없다`);
      if (!jacks.has(jack)) bad(`answer의 '${jack}'가 jacks에 없다`);
    }
    for (const plug of plugs) if (!(plug in answer)) bad(`'${plug}'의 정답 단자가 없다`);
  } else if (p.type === 'lock') {
    if (!Number.isInteger(c.digits) || c.digits < 1) bad('digits는 1 이상의 정수');
    else if (typeof c.answer !== 'string' || !new RegExp(`^\\d{${c.digits}}$`).test(c.answer)) {
      bad(`answer는 ${c.digits}자리 숫자 문자열`);
    }
  } else if (p.type === 'pieces') {
    const pieces = (c.pieces ?? []).map((x) => x.id);
    const answer = c.answer ?? [];
    const same = pieces.length === answer.length && [...pieces].sort().join() === [...answer].sort().join();
    if (!same) bad('answer는 pieces의 순열이어야 한다');
  } else if (p.type === 'restore') {
    if (!nonEmpty(c.text) || !nonEmpty(c.label) || !nonEmpty(c.answerLabel)) bad('text, label, answerLabel이 필요하다');
    if (!nonEmpty(c.answer) || !String(c.text).includes(c.answer)) bad('answer는 text 안에 있어야 한다(자국을 읽고 옮겨 적는다)');
    if (!(c.target >= 0 && c.target <= 100)) bad('target은 0~100');
    if (!(c.tolerance > 0 && c.tolerance < 30)) bad('tolerance는 0보다 크고 30보다 작게');
  } else if (p.type === 'sort') {
    const items = new Set((c.items ?? []).map((x) => x.id));
    const cats = new Set((c.categories ?? []).map((x) => x.id));
    if (cats.size < 2) bad('갈래(categories)는 둘 이상');
    if (!(c.items ?? []).every((x) => nonEmpty(x.label) && nonEmpty(x.detail))) bad('항목마다 label과 detail이 필요하다');
    for (const id of items) if (!cats.has(c.answer?.[id])) bad(`'${id}'의 정답 갈래가 없거나 categories에 없다`);
  } else if (p.type === 'move') {
    const items = (c.items ?? []);
    if (items.length < 2 || items.length > MAX_CHOICES) bad(`옮길 것은 2~${MAX_CHOICES}개`);
    if (!items.some((x) => x.id === c.answer)) bad('answer가 items에 없다');
    if (!items.filter((x) => x.id !== c.answer).every((x) => nonEmpty(x.text))) bad('틀린 항목마다 그 뒤에 있던 것(text)이 필요하다');
  } else if (p.type === 'morse') {
    if (!Array.isArray(c.signal) || !c.signal.every((g) => g === '/' || /^[·—]+$/.test(g))) bad('signal은 "·"와 "—" 묶음, 쉼은 "/"');
    if (!nonEmpty(c.answer) || !nonEmpty(c.answerLabel)) bad('answer와 answerLabel이 필요하다');
    const letters = c.signal.filter((g) => g !== '/').length;
    if (nonEmpty(c.answer) && c.answer.replace(/\s/g, '').length !== letters) bad(`answer 글자 수(${c.answer.length})가 신호 묶음 수(${letters})와 다르다`);
  } else if (p.type === 'optics') {
    const mirrors = c.mirrors ?? [];
    if (!mirrors.length) bad('mirrors가 없다');
    for (const m of mirrors) {
      const a = c.answer?.[m.id];
      if (!Number.isInteger(a) || a < c.min || a > c.max || (a - c.min) % c.step !== 0) bad(`'${m.id}' 정답 각도가 min/max/step에 맞지 않는다`);
    }
  } else if (p.type === 'reconstruct') {
    const rows = c.rows ?? [];
    if (rows.length < 3) bad('칸(rows)은 셋 이상');
    for (const row of rows) {
      if (!nonEmpty(row.time) || !nonEmpty(row.event) || !row.accept?.length) bad(`'${row.id}' 칸에 time·event·accept가 필요하다`);
    }
  } else if (p.type === 'timeline') {
    const ids = (c.items ?? []).map((x) => x.id);
    const same = ids.length === (c.answer ?? []).length && [...ids].sort().join() === [...c.answer].sort().join();
    if (!same) bad('answer는 items의 순열이어야 한다');
    if (ids.length < 3) bad('순서를 잡을 줄이 셋 이상이어야 퍼즐이 된다');
  }
}

// 풀 수 없는 퍼즐이 자기 자신을 기다리는지 찾는다. 닿지 못한 노드만 따라간다.
function findCycle(start, data, ids, full) {
  const givers = new Map();
  const addGiver = (clue, deps) => {
    if (!givers.has(clue)) givers.set(clue, []);
    givers.get(clue).push(deps);
  };
  const openersOf = new Map();
  for (const scene of data.scenes ?? []) {
    for (const obj of scene.objects ?? []) {
      for (const c of obj.gives ?? []) addGiver(c, obj.id);
      if (obj.puzzle) {
        if (!openersOf.has(obj.puzzle)) openersOf.set(obj.puzzle, []);
        openersOf.get(obj.puzzle).push(obj.id);
      }
    }
  }
  for (const p of data.puzzles ?? []) for (const c of p.gives ?? []) addGiver(c, p.id);
  for (const s of data.suspects ?? []) {
    for (const r of s.rounds ?? []) {
      for (const c of r.gives ?? []) addGiver(c, r.id);
      for (const st of r.statements ?? []) {
        for (const c of st.gives ?? []) addGiver(c, r.id);
        for (const c of st.onProven ?? []) addGiver(c, st.id);
      }
    }
  }
  for (const b of data.board ?? []) for (const c of b.gives ?? []) addGiver(c, b.id);

  const depsOf = (id) => {
    const entry = ids.get(id);
    if (!entry) return [];
    const { kind, node } = entry;
    if (kind === 'clue') return givers.get(id) ?? [];
    if (kind === 'puzzle') return [...(node.requires ?? []), ...(openersOf.get(id) ?? [])];
    if (kind === 'object') {
      const scene = (data.scenes ?? []).find((s) => (s.objects ?? []).includes(node));
      return [...(node.requires ?? []), scene?.id].filter(Boolean);
    }
    if (kind === 'statement') return node.contradictedBy ?? [];
    return node.requires ?? [];
  };

  const stack = [];
  const seen = new Set();
  const dfs = (id) => {
    if (full.have.has(id)) return null;
    if (id === start && stack.length) return [...stack, id];
    if (seen.has(id)) return null;
    seen.add(id);
    stack.push(id);
    for (const dep of depsOf(id)) {
      const found = dfs(dep);
      if (found) return found;
    }
    stack.pop();
    return null;
  };
  const cycle = dfs(start);
  return cycle && cycle.some((id, i) => i > 0 && i < cycle.length - 1 && ids.get(id)?.kind === 'puzzle') ? cycle : null;
}

// ---------- 도우미 ----------

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function clip(s) { return s.length > 30 ? `${s.slice(0, 30)}…` : s; }
function each(list, where, fn) {
  if (Array.isArray(list)) list.forEach((item, i) => fn(item ?? {}, `${where}[${i}]`));
}
function walkStrings(value, where, fn) {
  if (typeof value === 'string') fn(value, where);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, `${where}[${i}]`, fn));
  else if (isObj(value)) {
    for (const [k, v] of Object.entries(value)) walkStrings(v, where ? `${where}.${k}` : k, fn);
  }
}

async function readJson(file) {
  const text = await readFile(file, 'utf8');
  return JSON.parse(text);
}

function report(label, { errors, warnings }) {
  const mark = errors.length ? '✗' : '✓';
  console.log(`${mark} ${label}  오류 ${errors.length} · 경고 ${warnings.length}`);
  for (const e of errors) console.log(`    오류 [${e.code}] ${e.where}: ${e.msg}`);
  for (const w of warnings) console.log(`    경고 [${w.code}] ${w.where}: ${w.msg}`);
}

async function main(argv) {
  const strict = argv.includes('--strict');
  const files = argv.filter((a) => !a.startsWith('--'));
  let errorCount = 0;
  let warningCount = 0;
  const tally = (r) => { errorCount += r.errors.length; warningCount += r.warnings.length; };

  if (files.length) {
    for (const file of files) {
      let result;
      try { result = validateCase(await readJson(file), { label: file }); }
      catch (e) { result = { errors: [{ code: 'READ', where: file, msg: e.message }], warnings: [] }; }
      report(path.relative(ROOT, path.resolve(file)) || file, result);
      tally(result);
    }
  } else {
    const story = await readJson(path.join(DATA, 'story.json'));
    const cases = new Map();
    const pending = [];
    for (const ch of story.chapters ?? []) {
      const file = path.join(DATA, ch.file);
      let data;
      try { data = await readJson(file); }
      catch (e) {
        if (e.code === 'ENOENT' && !ch.ready) { pending.push(`${ch.id} (${ch.file})`); continue; }
        if (e.code === 'ENOENT') {
          const result = { errors: [{ code: 'MISSING_FILE', where: ch.file, msg: 'ready: true인데 파일이 없다' }], warnings: [] };
          report(`data/${ch.file}`, result);
          tally(result);
          continue;
        }
        const result = { errors: [{ code: 'READ', where: ch.file, msg: e.message }], warnings: [] };
        report(`data/${ch.file}`, result);
        tally(result);
        continue;
      }
      cases.set(ch.id, data);
      const result = validateCase(data, { label: ch.file });
      // 장면 그림 파일이 실제로 있는가
      for (const [i, scene] of (data.scenes ?? []).entries()) {
        if (!scene.art) continue;
        try { await readFile(path.join(ROOT, scene.art)); }
        catch { result.errors.push({ code: 'MISSING_ART', where: `scenes[${i}].art`, msg: `그림 파일이 없다: ${scene.art}` }); }
      }
      report(`data/${ch.file}`, result);
      tally(result);
    }
    const storyResult = validateStory(story, cases);
    report('data/story.json', storyResult);
    tally(storyResult);
    if (pending.length) console.log(`\n아직 작성하지 않은 장: ${pending.join(', ')}`);
  }

  const failed = errorCount > 0 || (strict && warningCount > 0);
  console.log(`\n${failed ? '실패' : '통과'}: 오류 ${errorCount} · 경고 ${warningCount}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
