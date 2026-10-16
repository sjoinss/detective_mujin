// 한국어 조사: 앞 글자의 받침에 맞춘다.  josa('강지훈', '이', '가') → '강지훈이'

export function josa(word, withFinal, withoutFinal) {
  const last = String(word).trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 ? code % 28 !== 0 : false;
  return `${word}${hasFinal ? withFinal : withoutFinal}`;
}
