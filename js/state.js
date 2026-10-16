// 상태의 모양과 저장 키. 저장 형식이 바뀌면 버전을 올린다.

export const SETTINGS_KEY = 'mujin.settings';
export const SETTINGS_VERSION = 1;
export const SAVE_KEY = 'mujin.save';
export const SAVE_VERSION = 1;

export const SETTING_OPTIONS = {
  textSize: [['m', '보통'], ['l', '크게'], ['xl', '아주 크게']],
  motion: [['system', '기기 설정 따름'], ['reduce', '줄이기']],
  fx: [['off', '끔'], ['low', '약하게'], ['full', '기본']],
  sound: [['off', '끔'], ['on', '켬']],
  contrast: [['normal', '기본'], ['high', '높게']],
};

export const DEFAULT_SETTINGS = {
  textSize: 'm',
  motion: 'system',
  fx: 'full',
  sound: 'off',
  contrast: 'normal',
};

// 저장된 값 중 아는 키·아는 값만 받는다. 나머지는 기본값.
export function sanitizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, options] of Object.entries(SETTING_OPTIONS)) {
    if (options.some(([value]) => value === raw[key])) out[key] = raw[key];
  }
  return out;
}

export function initialState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    settingsSaved: false,
    storageOk: true,
    hasSave: false,
    saveStatus: 'none',
    saveError: false,
    game: null,
    route: 'title',
    returnTo: 'title',
    objective: '',
  };
}
