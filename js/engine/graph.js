// 사건 데이터의 id 색인과 도달 가능성 계산.
// 게임 엔진과 tools/validate-cases.mjs가 같은 규칙을 쓰도록 여기 한 곳에 둔다.
//
// 조건(requires)은 id 문자열 배열이고 모두 만족해야 한다(AND).
// id 종류에 따라 뜻이 정해진다.
//   단서 id      → 그 단서를 가졌다
//   장면 id      → 그 장면에 들어갈 수 있다
//   오브젝트 id  → 그 오브젝트를 살펴봤다
//   퍼즐 id      → 그 퍼즐을 풀었다
//   용의자 id    → 그 용의자를 심문할 수 있다
//   진술 id      → 그 진술의 모순을 증명했다
//   라운드 id    → 그 라운드의 모순을 모두 증명했다
//   대조 줄 id   → 대조표에서 그 두 줄을 짚었다
// 조건은 얻기만 하고 잃지 않는다. 그래서 한 번 열린 길은 닫히지 않고,
// 놓치면 다시 못 얻는 단서가 구조적으로 생기지 않는다.

export function indexCase(data) {
  const ids = new Map();
  const duplicates = [];
  const add = (kind, node, path) => {
    if (!node || typeof node.id !== 'string') return;
    const prev = ids.get(node.id);
    if (prev) duplicates.push({ id: node.id, path, firstPath: prev.path });
    else ids.set(node.id, { kind, node, path });
  };

  (data.scenes ?? []).forEach((scene, i) => {
    add('scene', scene, `scenes[${i}]`);
    (scene.objects ?? []).forEach((obj, j) => add('object', obj, `scenes[${i}].objects[${j}]`));
  });
  (data.puzzles ?? []).forEach((p, i) => add('puzzle', p, `puzzles[${i}]`));
  (data.clues ?? []).forEach((c, i) => add('clue', c, `clues[${i}]`));
  (data.suspects ?? []).forEach((s, i) => {
    add('suspect', s, `suspects[${i}]`);
    (s.rounds ?? []).forEach((r, j) => {
      add('round', r, `suspects[${i}].rounds[${j}]`);
      (r.statements ?? []).forEach((st, k) =>
        add('statement', st, `suspects[${i}].rounds[${j}].statements[${k}]`));
    });
  });
  (data.board ?? []).forEach((b, i) => add('link', b, `board[${i}]`));
  for (const key of ['method', 'motive']) {
    (data.accusation?.[key] ?? []).forEach((o, i) => add(key, o, `accusation.${key}[${i}]`));
  }
  return { ids, duplicates };
}

// 조건을 만족하는 것부터 차례로 열어 가며, 끝까지 열 수 있는 모든 것을 구한다.
// block에 넣은 퍼즐은 풀리지 않는다고 가정한다(퍼즐 이전에 얻을 수 있는지 확인할 때 쓴다).
// carry 단서(앞선 사건에서 넘어오는 메인 스토리 조각)는 처음부터 가진 것으로 본다.
// 조각을 다 모았을 때 끝까지 풀 수 있는지를 확인하는 셈이다. 모자랄 때는 최종장이 빈칸·넘어가기로 받는다.
export function explore(data, { block = [] } = {}) {
  const blocked = new Set(block);
  const have = new Set((data.clues ?? []).filter((c) => c.carry).map((c) => c.id));
  const heard = new Set();
  const sources = new Map();
  let changed = true;

  const met = (req) => (req ?? []).every((id) => have.has(id));
  const gain = (clueIds, from) => {
    for (const id of clueIds ?? []) {
      if (!sources.has(id)) sources.set(id, []);
      sources.get(id).push(from);
      if (!have.has(id)) { have.add(id); changed = true; }
    }
  };
  const open = (node, gives) => {
    if (have.has(node.id)) return;
    have.add(node.id);
    changed = true;
    gain(gives, node.id);
  };

  const openers = new Map();
  for (const scene of data.scenes ?? []) {
    for (const obj of scene.objects ?? []) {
      if (!obj.puzzle) continue;
      if (!openers.has(obj.puzzle)) openers.set(obj.puzzle, []);
      openers.get(obj.puzzle).push(obj.id);
    }
  }

  while (changed) {
    changed = false;

    for (const scene of data.scenes ?? []) {
      if (met(scene.requires)) open(scene, []);
      if (!have.has(scene.id)) continue;
      for (const obj of scene.objects ?? []) {
        if (met(obj.requires)) open(obj, obj.gives);
      }
    }

    for (const p of data.puzzles ?? []) {
      if (blocked.has(p.id)) continue;
      const reachable = (openers.get(p.id) ?? []).some((id) => have.has(id));
      if (reachable && met(p.requires)) open(p, p.gives);
    }

    for (const s of data.suspects ?? []) {
      if (met(s.requires)) open(s, []);
      if (!have.has(s.id)) continue;
      for (const r of s.rounds ?? []) {
        if (!met(r.requires)) continue;
        for (const st of r.statements ?? []) {
          if (!heard.has(st.id)) {
            heard.add(st.id);
            changed = true;
            gain(st.gives, st.id);
          }
          if ((st.contradictedBy ?? []).some((id) => have.has(id))) open(st, st.onProven);
        }
        const contradictable = (r.statements ?? []).filter((st) => st.contradictedBy?.length);
        if (contradictable.every((st) => have.has(st.id))) open(r, r.gives);
      }
    }

    for (const link of data.board ?? []) {
      const ready = [link.left, link.right].every((id) => have.has(id) || heard.has(id));
      if (ready) open(link, link.gives);
    }
  }

  return { have, heard, sources };
}

// 지금 화면에 띄울 목표 한 줄. 조건을 만족하는 마지막 항목을 쓴다.
export function currentObjective(data, have) {
  let text = '';
  for (const o of data.objectives ?? []) {
    if ((o.when ?? []).every((id) => have.has(id))) text = o.text;
  }
  return text;
}
