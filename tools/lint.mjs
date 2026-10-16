// 구현 원칙 검사 (10.4)
//  - innerHTML 계열을 쓰지 않는다
//  - 색 값은 css/tokens.css에만 둔다
//  - 쓰인 CSS 변수는 tokens.css에 정의돼 있어야 한다
//   node tools/lint.mjs

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function files(dir, ext) {
  const out = [];
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(rel, ext));
    else if (entry.name.endsWith(ext)) out.push(rel);
  }
  return out;
}

const problems = [];
const report = (file, line, msg) => problems.push(`${file.replaceAll('\\', '/')}:${line}  ${msg}`);
const eachLine = (text, fn) => text.split('\n').forEach((l, i) => fn(l, i + 1));

const tokens = await readFile(path.join(ROOT, 'css/tokens.css'), 'utf8');
const defined = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
// 컴포넌트 안에서 범위를 좁혀 다시 정의하는 변수(.sheet의 --focus 등)도 정의로 친다
const cssFiles = await files('css', '.css');
for (const file of cssFiles) {
  const text = await readFile(path.join(ROOT, file), 'utf8');
  for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
}

for (const file of cssFiles) {
  const text = await readFile(path.join(ROOT, file), 'utf8');
  eachLine(text, (line, n) => {
    const code = line.replace(/\/\*.*?\*\//g, '');
    if (!file.endsWith('tokens.css') && /#[0-9a-f]{3,8}\b|\b(rgb|rgba|hsl|hsla)\(/i.test(code)) {
      report(file, n, '색 값은 tokens.css에만');
    }
    for (const m of code.matchAll(/var\((--[\w-]+)/g)) {
      if (!defined.has(m[1])) report(file, n, `정의되지 않은 변수 ${m[1]}`);
    }
  });
}

for (const file of await files('js', '.js')) {
  const text = await readFile(path.join(ROOT, file), 'utf8');
  eachLine(text, (line, n) => {
    if (/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write/.test(line)) {
      report(file, n, 'HTML 문자열 삽입 금지. textContent나 el()을 쓴다');
    }
    // replaceChildren/append는 null을 "null" 글자로 넣는다. dom.js의 fill/add를 쓴다.
    if (!file.replaceAll('\\', '/').endsWith('ui/dom.js') && /\.(replaceChildren|append)\(/.test(line)) {
      report(file, n, 'replaceChildren/append 대신 fill/add');
    }
    if (/#[0-9a-f]{6}\b|\b(rgb|rgba|hsl)\(/i.test(line)) report(file, n, '색 값은 tokens.css에만');
  });
}

// 장면 그림: 색은 클래스로만 받는다(fill·stroke에 색 값, style 속성, 스크립트 금지)
for (const file of await files('art', '.svg')) {
  const text = await readFile(path.join(ROOT, file), 'utf8');
  eachLine(text, (line, n) => {
    if (/(fill|stroke)="(?!none|currentColor)[^"]+"|#[0-9a-f]{3,8}\b|\brgb\(|style=|<script/i.test(line)) {
      report(file, n, '그림 안에 색이나 스크립트. class(bg/f1/ln/seal…)로만 칠한다');
    }
  });
}

for (const p of problems) console.log(`✗ ${p}`);
console.log(problems.length ? `\n문제 ${problems.length}건` : '문제 없음');
process.exitCode = problems.length ? 1 : 0;
