// css/tokens.css의 색 조합 대비 검사 (WCAG 2.2).
// 본문 글자 4.5:1, 테두리·포커스 링 같은 UI 요소 3:1.
//   node tools/check-contrast.mjs

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEXT = 4.5;
const UI = 3;

// [글자/앞, 바탕, 기준, 쓰이는 곳]
const PAIRS = [
  ['--text', '--bg', TEXT, '본문'],
  ['--text', '--surface', TEXT, '패널 본문'],
  ['--text', '--surface-raised', TEXT, '고른 선택지 로그'],
  ['--text-muted', '--bg', TEXT, '보조 글'],
  ['--text-muted', '--surface', TEXT, '패널 보조 글'],
  ['--text-muted', '--surface-raised', TEXT, '로그 보조 글'],
  ['--text-strong', '--bg', TEXT, '제목'],
  ['--accent-text', '--bg', TEXT, '인주 글씨'],
  ['--accent-text', '--surface', TEXT, '패널 인주 글씨'],
  ['--on-accent', '--accent', TEXT, '주 버튼'],
  ['--highlight-text', '--highlight-bg', TEXT, '형광펜'],
  ['--ok', '--bg', TEXT, '성공 문구'],
  ['--warn', '--bg', TEXT, '주의 문구'],
  ['--err', '--bg', TEXT, '오류 문구'],
  ['--err', '--surface', TEXT, '패널 오류 문구'],
  ['--focus', '--bg', UI, '포커스 링'],
  ['--focus', '--surface', UI, '패널 포커스 링'],
  ['--line-strong', '--bg', UI, '버튼·입력 테두리'],
  ['--line-strong', '--surface', UI, '패널 버튼 테두리'],
  ['--sheet-text', '--sheet-bg', TEXT, '서류 본문'],
  ['--sheet-text', '--sheet-bg-alt', TEXT, '서류 줄무늬'],
  ['--sheet-muted', '--sheet-bg', TEXT, '서류 보조 글'],
  ['--sheet-muted', '--sheet-bg-alt', TEXT, '서류 줄무늬 보조 글'],
  ['--sheet-accent', '--sheet-bg', TEXT, '서류 인주 글씨'],
  ['--sheet-accent', '--sheet-bg-alt', TEXT, '서류 줄무늬 인주 글씨'],
  ['--sheet-ok', '--sheet-bg', TEXT, '서류 확인 표시'],
  ['--memo-text', '--sheet-bg-alt', TEXT, '서진우 메모'],
  ['--memo-line', '--sheet-bg-alt', UI, '메모 왼쪽 줄'],
  ['--sheet-line', '--sheet-bg', UI, '서류 칸 테두리'],
  ['--sheet-focus', '--sheet-bg', UI, '서류 위 포커스 링'],
  ['--sheet-focus', '--sheet-bg-alt', UI, '서류 줄무늬 위 포커스 링'],
];

const css = await readFile(path.join(ROOT, 'css/tokens.css'), 'utf8');

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const vars = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const base = block(':root');
const modes = {
  '기본': base,
  '높은 대비': { ...base, ...block(':root[data-contrast="high"]') },
};

function resolve(vars, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`순환 참조 ${name}`);
  seen.add(name);
  const value = vars[name];
  if (value === undefined) throw new Error(`정의되지 않은 ${name}`);
  const ref = value.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolve(vars, ref[1], seen) : value;
}

function luminance(hex) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`hex 색이 아님: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

let failed = 0;
for (const [mode, vars] of Object.entries(modes)) {
  console.log(`\n[${mode}]`);
  for (const [fg, bg, min, use] of PAIRS) {
    const r = ratio(resolve(vars, fg), resolve(vars, bg));
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${r.toFixed(2).padStart(5)} ≥ ${min}  ${fg} / ${bg}  (${use})`);
  }
}
console.log(`\n${failed ? `실패 ${failed}건` : '전부 통과'}`);
process.exitCode = failed ? 1 : 0;
