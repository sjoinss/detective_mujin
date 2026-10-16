// 배포 캐시 무효화: index.html의 CSS·JS 주소에 내용 해시를 붙인다.
//   node tools/stamp.mjs          index.html을 고쳐 쓴다
//   node tools/stamp.mjs --check  고쳐 쓰지 않고, 해시가 지금 파일과 맞는지만 본다(lint가 부른다)
//
// 정적 호스팅에서는 브라우저가 예전 모듈과 새 모듈을 섞어 불러와 화면이 멈출 수 있다.
// 파일이 바뀌면 주소(?v=해시)가 바뀌므로 브라우저가 새로 받는다.
// JS는 import map으로 모든 모듈 주소를 해시 붙은 주소로 바꾼다. 빌드 단계는 없다.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- stamp:start -->';
const END = '<!-- stamp:end -->';

async function files(dir, ext) {
  const out = [];
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...await files(rel, ext));
    else if (entry.name.endsWith(ext)) out.push(rel);
  }
  return out.sort();
}

const hash = async (rel) => createHash('sha1').update(await readFile(path.join(ROOT, rel))).digest('hex').slice(0, 10);

export async function stampBlock() {
  const css = ['css/tokens.css', 'css/base.css', 'css/components.css', 'css/screens.css'];
  const js = await files('js', '.js');
  const v = Object.fromEntries(await Promise.all([...css, ...js].map(async (f) => [f, await hash(f)])));
  const imports = Object.fromEntries(js.map((f) => [`./${f}`, `./${f}?v=${v[f]}`]));
  return [
    START,
    ...css.map((f) => `  <link rel="stylesheet" href="${f}?v=${v[f]}">`),
    `  <script type="importmap">${JSON.stringify({ imports }, null, 2).replace(/\n/g, '\n  ')}</script>`,
    // 모듈을 줄줄이 기다리지 않고 한꺼번에 받는다(느린 망에서 왕복을 줄인다)
    ...js.map((f) => `  <link rel="modulepreload" href="${f}?v=${v[f]}">`),
    `  <script type="module" src="js/main.js?v=${v['js/main.js']}"></script>`,
    `  ${END}`,
  ].join('\n');
}

async function main() {
  const file = path.join(ROOT, 'index.html');
  const html = await readFile(file, 'utf8');
  const a = html.indexOf(START);
  const b = html.indexOf(END);
  if (a < 0 || b < 0) throw new Error('index.html에 stamp 표시가 없다');
  const next = html.slice(0, a) + await stampBlock() + html.slice(b + END.length);
  if (process.argv.includes('--check')) {
    const ok = next === html;
    console.log(ok ? '주소 해시 최신' : '✗ index.html 주소 해시가 낡았다. node tools/stamp.mjs 를 실행한다');
    process.exitCode = ok ? 0 : 1;
    return;
  }
  await writeFile(file, next);
  console.log('index.html 주소 해시를 새로 적었다');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
