// 설정 불러오기·저장·적용

import { storage } from './store.js';
import { SETTINGS_KEY, SETTINGS_VERSION, sanitizeSettings } from './state.js';

export function loadSettings() {
  const result = storage.read(SETTINGS_KEY);
  if (!result.ok || !result.value) return { settings: sanitizeSettings(null), saved: false };
  // 버전이 달라도 아는 키·값만 살려 쓰고 나머지는 기본값으로 채운다
  return { settings: sanitizeSettings(result.value.settings), saved: true };
}

export function saveSettings(settings) {
  return storage.write(SETTINGS_KEY, { v: SETTINGS_VERSION, settings });
}

export function applySettings(settings) {
  const root = document.documentElement.dataset;
  root.textSize = settings.textSize;
  root.motion = settings.motion;
  root.fx = settings.fx;
  root.contrast = settings.contrast;
  root.sound = settings.sound;
}

// 불안도는 화면에 숫자로 나오지 않는다. 노이즈와 줄 간격으로만 스민다.
export function applyUnease(value) {
  const v = Math.max(0, Math.min(1, value));
  document.documentElement.style.setProperty('--unease', String(v));
}
