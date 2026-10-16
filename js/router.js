// 해시 주소로 화면을 고른다. #/desk/book → 화면 'desk', params ['book']
// 화면 함수는 { focus, cleanup, title, chrome }을 돌려준다.
// 주소가 바뀌면 그 화면의 focus 요소(보통 제목)로 포커스를 옮겨 스크린리더가 새 화면을 읽게 한다.

import { fill } from './ui/dom.js';

export function createRouter({ routes, fallback, root, onChange }) {
  let cleanup = null;
  let first = true;

  const parse = () => {
    const path = location.hash.replace(/^#\/?/, '');
    const [name, ...params] = path.split('/').filter(Boolean);
    return routes[name] ? { name, params } : { name: fallback, params: [] };
  };

  function render() {
    const { name, params } = parse();
    cleanup?.();
    fill(root);
    const screen = routes[name]({ root, params }) ?? {};
    cleanup = screen.cleanup ?? null;
    document.title = screen.title ? `${screen.title} · 무진 사건부` : '무진 사건부';
    document.body.dataset.chrome = screen.chrome ?? 'none';
    onChange?.({ name, params, path: [name, ...params].join('/') });
    if (!first) (screen.focus ?? root).focus({ preventScroll: false });
    first = false;
  }

  return {
    start() {
      window.addEventListener('hashchange', render);
      render();
    },
    go(path) {
      if (location.hash === `#/${path}`) render();
      else location.hash = `/${path}`;
    },
    refresh: render,
  };
}
