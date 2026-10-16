// 최소 효과음(기획서 13장). 소리 파일 없이 Web Audio로 짧게 합성한다. 기본은 끔.
// 소리는 분위기일 뿐 정보를 담지 않는다. 같은 일은 언제나 글로도 보인다(2.10).
// 브라우저는 사용자가 누른 뒤에만 소리를 내게 하므로, 모든 호출은 클릭에서 시작한다.

const VOLUME = 0.07;
let ctx = null;

function audio() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const on = () => document.documentElement.dataset.sound === 'on';

// 잡음 한 토막(종이, 펜, 발소리)
function noise(a, { at = 0, length = 0.08, from = 2000, to = 800, gain = 1 }) {
  const frames = Math.ceil(a.sampleRate * length);
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(from, a.currentTime + at);
  filter.frequency.exponentialRampToValueAtTime(to, a.currentTime + at + length);
  const g = a.createGain();
  g.gain.value = VOLUME * gain;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(a.currentTime + at);
}

// 짧은 음(딸깍, 낮은 울림)
function tone(a, { at = 0, freq = 440, length = 0.2, type = 'sine', gain = 1 }) {
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = a.createGain();
  const t = a.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(VOLUME * gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

const SOUNDS = {
  // 사건부에 한 줄 적는다: 펜이 종이를 긋는 소리
  note: (a) => noise(a, { length: 0.12, from: 3500, to: 1500, gain: 0.8 }),
  // 퍼즐이 풀린다: 맞물리는 딸깍 두 번
  solve: (a) => { tone(a, { freq: 660, length: 0.08, type: 'triangle' }); tone(a, { at: 0.09, freq: 990, length: 0.25, type: 'triangle', gain: 0.8 }); },
  // 증거가 어긋난다: 낮게 가라앉는 울림
  wrong: (a) => { tone(a, { freq: 110, length: 0.35, gain: 1.4 }); tone(a, { freq: 82, length: 0.45, gain: 1 }); },
  // 다른 곳으로 옮긴다: 발소리 두 번
  step: (a) => { noise(a, { length: 0.06, from: 400, to: 150, gain: 1.4 }); noise(a, { at: 0.22, length: 0.06, from: 380, to: 140, gain: 1.2 }); },
  // 메모를 한 장 넘긴다: 종이
  page: (a) => noise(a, { length: 0.18, from: 1200, to: 4000, gain: 0.7 }),
};

export function play(kind, { force = false } = {}) {
  if (!force && !on()) return;
  try {
    const a = audio();
    if (a) SOUNDS[kind]?.(a);
  } catch {
    // 소리를 못 내도 게임은 그대로 간다
  }
}
