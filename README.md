# 무진 사건부

플레이: https://sjoinss.github.io/detective_mujin/

웹 공포 추리 게임. 정적 HTML/CSS/JavaScript(ES 모듈), 외부 라이브러리 없음. 기획은 `무진사건부_기획서.md`, 사건 데이터 형식은 `data/SCHEMA.md`.

## 실행

JSON을 `fetch`로 읽으므로 파일을 직접 열면 안 되고, 웹 서버로 연다.

```
npm run serve        # python -m http.server 8123 --bind 127.0.0.1
```

http://127.0.0.1:8123/

## 시험

```
npm test
```

- `tools/validate-cases.mjs`: 사건 데이터의 공정한 추리 검사(도달 가능성, 순환, 소거 단서, 메모 3장, 그림 파일 …)
- `tools/test-validator.mjs`: 검증기 자체 시험
- `tools/test-engine.mjs`: 엔진 시험. 모든 장을 엔진만으로 끝까지 풀고, 엔딩 세 갈래를 확인한다
- `tools/lint.mjs`: innerHTML 금지, 색은 tokens.css에만, `fill`/`add` 사용, 그림 속 색 금지
- `tools/check-contrast.mjs`: 색 조합 대비(AA), 기본·높은 대비
- `tools/stamp.mjs --check`: index.html의 주소 해시가 최신인지

브라우저 점검: 페이지 콘솔에서 `(await import('/tools/audit.js')).audit(document)` → 이름 없는 조작 요소, 44px 미만 터치 대상, 제목 계층, 중복 id, 본문 대비, 가로 스크롤.

## 배포(정적 호스팅)

JS·CSS를 고쳤으면 올리기 전에:

```
npm run stamp
```

`index.html`의 CSS·JS 주소에 내용 해시(`?v=`)가 붙고, import map이 모든 모듈을 해시 주소로 바꾼다. 브라우저가 예전 모듈과 새 모듈을 섞어 불러오지 않는다. 잊으면 `npm test`가 실패한다. 사건 데이터(JSON)와 장면 그림(SVG)은 매번 서버에 새 버전을 묻는다.

`index.html`, `css/`, `js/`, `data/`, `art/`를 그대로 올린다. `tools/`, `package.json`, `*.md`는 올리지 않아도 된다.

지금은 GitHub Pages가 `main` 브랜치 루트를 그대로 서비스한다(`.nojekyll`로 가공 없이). `main`에 push하면 몇 분 뒤 반영된다. push마다 GitHub Actions가 `npm test`를 돌린다.

## 저장

브라우저 localStorage(`mujin.save`, `mujin.settings`). 설정 화면의 저장 코드로 다른 기기에 옮길 수 있다.
