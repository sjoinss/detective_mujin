// 장면 뷰어: 그림 위 핫스팟 + 같은 내용의 "살펴볼 곳" 목록.
// 핫스팟만으로는 키보드·스크린리더가 불편하므로 목록을 늘 함께 낸다.

import { el, add } from './dom.js';

const SVG = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

// 장면 그림. 그림 파일이 없는 동안은 핫스팟 자리만 선으로 그린다(M3에서 SVG 일러스트로 바뀜).
function sceneArt(scene) {
  const art = svg('svg', { class: 'scene-art', viewBox: '0 0 160 100', 'aria-hidden': 'true', focusable: 'false' });
  add(art,
    svg('rect', { x: 0.5, y: 0.5, width: 159, height: 99, fill: 'none', stroke: 'currentColor', 'stroke-width': 0.3 }),
    svg('line', { x1: 0, y1: 62, x2: 160, y2: 62, stroke: 'currentColor', 'stroke-width': 0.3, 'stroke-dasharray': '1 2' }),
  );
  for (const obj of scene.objects ?? []) {
    const h = obj.hotspot;
    if (!h) continue;
    add(art, svg('rect', {
      x: h.x * 1.6, y: h.y, width: h.w * 1.6, height: h.h,
      fill: 'none', stroke: 'currentColor', 'stroke-width': 0.4,
    }));
  }
  return art;
}

// 장면 일러스트(SVG 파일). 색은 파일 안에 두지 않고 클래스만 달아 tokens.css의 색을 받는다.
// 그래서 <img>가 아니라 문서에 직접 넣는다. 우리 파일만 읽지만 스크립트와 이벤트 속성은 걸러 낸다.
const artCache = new Map();

function loadArt(url) {
  if (!artCache.has(url)) {
    artCache.set(url, fetch(url, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((text) => {
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        const svgRoot = doc.documentElement;
        if (svgRoot.nodeName !== 'svg') throw new Error('SVG가 아님');
        svgRoot.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
        for (const node of [svgRoot, ...svgRoot.querySelectorAll('*')]) {
          for (const attr of [...node.attributes]) if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
        }
        return svgRoot;
      })
      .catch((error) => { artCache.delete(url); throw error; }));
  }
  return artCache.get(url);
}

function artSlot(scene) {
  const placeholder = sceneArt(scene);
  if (!scene.art) return placeholder;
  loadArt(scene.art).then((svgRoot) => {
    const art = document.importNode(svgRoot, true);
    art.setAttribute('class', 'scene-art');
    art.setAttribute('aria-hidden', 'true');
    art.setAttribute('focusable', 'false');
    placeholder.replaceWith(art);
  }).catch(() => { /* 그림이 없으면 자리 표시 선이 남는다. 같은 내용은 목록과 대체 텍스트에 있다. */ });
  return placeholder;
}

export function sceneView(scene, { done, onInspect }) {
  const figure = el('figure', {},
    el('div', { class: 'scene-view' },
      artSlot(scene),
      ...(scene.objects ?? []).filter((o) => o.hotspot).map((obj) => el('button', {
        type: 'button',
        class: 'hotspot',
        style: `left:${obj.hotspot.x}%;top:${obj.hotspot.y}%;width:${obj.hotspot.w}%;height:${obj.hotspot.h}%`,
        'aria-label': done.has(obj.id) ? `${obj.label}, 살펴봄` : obj.label,
        dataset: { done: String(done.has(obj.id)), obj: obj.id },
        onclick: () => onInspect(obj),
      }))),
    el('figcaption', { class: 'scene-caption' }, scene.alt));
  return figure;
}

export function objectList(scene, { done, onInspect, headingId }) {
  return el('ul', { class: 'choices', role: 'list', 'aria-labelledby': headingId },
    ...(scene.objects ?? []).map((obj) => el('li', {},
      el('button', {
        type: 'button',
        class: 'choice',
        dataset: { done: String(done.has(obj.id)), obj: obj.id },
        onclick: () => onInspect(obj),
      },
      el('span', { class: 'choice-label' }, obj.label),
      done.has(obj.id) ? el('span', { class: 'choice-mark' }, '✓ 살펴봄') : null))));
}
