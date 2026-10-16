// 사건 하나의 진행 상태와 탐색·단서 획득. 순수 함수만 두고 DOM과 저장은 모른다.
//
// 사건 상태
//   sceneId  지금 있는 장면
//   have     조건 토큰(들어간 장면, 살펴본 오브젝트, 얻은 단서 …). graph.js와 같은 뜻
//   found    { 단서 id: 얻은 곳(오브젝트·퍼즐·진술 id) }
//   log      글 흐름. 글 자체 대신 id만 적어서 데이터 문장을 고쳐도 저장이 그대로 맞는다
//              { k: 'scene' | 'look' | 'clue' | 'solve' | 'han', id }   han의 id는 'han.<줄 번호>'
//   unread   사건부에 새로 더해졌지만 아직 펼쳐 보지 않은 줄 수
//   notes    { 퍼즐 id: 넘긴 메모 장 수 }  (hints.js)
//   heard    들은 진술 id                   (interrogation.js, 대조표·사건부 진술 탭이 쓴다)
//   unease   숨은 불안도 0~1                (interrogation.js)
//   solved   보고서가 통과해 사건이 닫혔다   (accusation.js)

const met = (req, have) => (req ?? []).every((id) => have.includes(id));

export function newCaseState(data) {
  const empty = { sceneId: data.start, have: [], found: {}, log: [], unread: 0 };
  return enter(empty, data.start);
}

export function findScene(data, id) {
  return (data.scenes ?? []).find((s) => s.id === id) ?? null;
}

export function findObject(data, id) {
  for (const scene of data.scenes ?? []) {
    const obj = (scene.objects ?? []).find((o) => o.id === id);
    if (obj) return { scene, obj };
  }
  return null;
}

export function findClue(data, id) {
  return (data.clues ?? []).find((c) => c.id === id) ?? null;
}

// 지금 갈 수 있는 장면
export function openScenes(data, st) {
  return (data.scenes ?? []).filter((s) => met(s.requires, st.have));
}

// 장면에서 눈에 띄는 오브젝트. 조건이 안 된 것은 아직 보이지 않는다.
export function visibleObjects(st, scene) {
  return (scene?.objects ?? []).filter((o) => met(o.requires, st.have));
}

export function has(st, id) {
  return st.have.includes(id);
}

export function move(data, st, sceneId) {
  const scene = findScene(data, sceneId);
  if (!scene || !met(scene.requires, st.have)) return st;
  if (st.sceneId === sceneId) return st;
  return enter(st, sceneId);
}

function enter(st, sceneId) {
  return {
    ...st,
    sceneId,
    have: st.have.includes(sceneId) ? st.have : [...st.have, sceneId],
    log: [...st.log, { k: 'scene', id: sceneId }],
  };
}

// 살펴보기. 처음 살펴볼 때 단서를 얻고, 다시 살펴보면 글만 다시 나온다.
export function inspect(data, st, objectId) {
  const hit = findObject(data, objectId);
  if (!hit || hit.scene.id !== st.sceneId || !met(hit.obj.requires, st.have)) {
    return { state: st, gained: [] };
  }
  const looked = {
    ...st,
    have: st.have.includes(objectId) ? st.have : [...st.have, objectId],
    log: [...st.log, { k: 'look', id: objectId }],
  };
  return gain(data, looked, hit.obj.gives, objectId);
}

// 단서 얻기. 퍼즐·심문도 이것을 쓴다.
export function gain(data, st, clueIds, sourceId) {
  const gained = (clueIds ?? []).filter((id) => !st.have.includes(id) && findClue(data, id));
  if (!gained.length) return { state: st, gained };
  const found = { ...st.found };
  for (const id of gained) found[id] = sourceId;
  return {
    state: {
      ...st,
      have: [...st.have, ...gained],
      found,
      log: [...st.log, ...gained.map((id) => ({ k: 'clue', id }))],
      unread: st.unread + gained.length,
    },
    gained,
  };
}

export function findPuzzle(data, id) {
  return (data.puzzles ?? []).find((p) => p.id === id) ?? null;
}

// 퍼즐을 열 수 있는가: 여는 오브젝트를 살펴봤고, 조건을 채웠고, 아직 안 풀었다.
export function puzzleOpen(data, st, puzzleId) {
  const p = findPuzzle(data, puzzleId);
  if (!p || st.have.includes(p.id) || !met(p.requires, st.have)) return false;
  return (data.scenes ?? []).some((s) => (s.objects ?? []).some((o) => o.puzzle === p.id && st.have.includes(o.id)));
}

export function solvePuzzle(data, st, puzzleId) {
  if (!puzzleOpen(data, st, puzzleId)) return { state: st, gained: [] };
  const p = findPuzzle(data, puzzleId);
  const solved = { ...st, have: [...st.have, p.id], log: [...st.log, { k: 'solve', id: p.id }] };
  return gain(data, solved, p.gives, p.id);
}

// 한도윤에게 묻는다: 조건을 만족하는 마지막 줄이 글 흐름에 남는다. 같은 말을 연달아 남기지 않는다.
export function hanLine(data, st) {
  let index = -1;
  (data.han ?? []).forEach((line, i) => { if (met(line.when, st.have)) index = i; });
  return index;
}

export function askHan(data, st) {
  const index = hanLine(data, st);
  if (index < 0) return st;
  const id = `han.${index}`;
  const last = st.log[st.log.length - 1];
  if (last?.k === 'han' && last.id === id) return st;
  return { ...st, log: [...st.log, { k: 'han', id }] };
}

// 사건을 닫는 조건(프롤로그·최종장). 보고서 대신 이 조건으로 닫힌다.
export function complete(data, st) {
  return !!data.completeWhen?.length && met(data.completeWhen, st.have);
}

export function markRead(st) {
  return st.unread ? { ...st, unread: 0 } : st;
}

// 얻은 단서를 얻은 순서대로
export function foundClues(data, st) {
  return st.have.map((id) => findClue(data, id)).filter(Boolean);
}

// 단서를 얻은 곳의 이름: "방송실 · 예약 스위치"
export function sourceLabel(data, sourceId) {
  if (sourceId === 'carry') return '앞선 사건부';
  const hit = findObject(data, sourceId);
  if (hit) return `${hit.scene.name} · ${hit.obj.label}`;
  const puzzle = (data.puzzles ?? []).find((p) => p.id === sourceId);
  if (puzzle) return puzzle.title;
  for (const s of data.suspects ?? []) {
    for (const r of s.rounds ?? []) {
      if (r.id === sourceId || (r.statements ?? []).some((st) => st.id === sourceId)) return `${s.name}의 말`;
    }
  }
  return '';
}

// 사건 데이터가 바뀌어 저장된 장면이 사라졌을 때 등, 저장 상태를 데이터에 맞춘다.
export function reconcile(data, st) {
  if (findScene(data, st.sceneId)) return st;
  return { ...st, sceneId: data.start };
}
