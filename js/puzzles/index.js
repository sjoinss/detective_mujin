// 퍼즐 유형 → 모듈. 새 유형은 여기에 더한다.
// 모듈은 check(config, value), render(config) → { node, value() }를 내고,
// wrongText·checkLabel은 문자열이거나 (config, value) => 문자열이다.

import * as wiring from './wiring.js';
import * as lock from './lock.js';
import * as pieces from './pieces.js';
import * as restore from './restore.js';
import * as sort from './sort.js';
import * as move from './move.js';
import * as morse from './morse.js';
import * as optics from './optics.js';
import * as timeline from './timeline.js';
import * as reconstruct from './reconstruct.js';

export const PUZZLES = { wiring, lock, pieces, restore, sort, move, morse, optics, timeline, reconstruct };

// ctx: { have: Set, clues: [] }  지금 가진 단서. 대부분의 유형은 쓰지 않는다.
export function wrongTextOf(kind, config, value, ctx) {
  return typeof kind.wrongText === 'function' ? kind.wrongText(config, value, ctx) : kind.wrongText;
}

export function checkLabelOf(kind, config) {
  return typeof kind.checkLabel === 'function' ? kind.checkLabel(config) : kind.checkLabel;
}
