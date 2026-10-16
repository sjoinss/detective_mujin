# 사건 데이터 형식 (schemaVersion 1)

사건 파일은 `data/cases/*.json`, 장 목록과 메인 스토리 조각은 `data/story.json`.
작성 후 `node tools/validate-cases.mjs`로 확인한다. 예시는 `data/cases/case1.json`.

## id와 조건

- 한 사건 안의 id는 종류와 상관없이 전부 겹치지 않는다. 접두어 관례: `sc.` 장면, `obj.` 오브젝트, `p.` 퍼즐, `clue.` 단서, `s.` 용의자, `r.` 라운드, `st.` 진술, `b.` 대조 줄, `m.` 수법, `mo.` 동기.
- `requires`는 id 배열이고 전부 만족해야 열린다. id 종류가 뜻을 정한다.

| 조건에 쓴 id | 뜻 |
| --- | --- |
| 단서 | 그 단서를 가졌다 |
| 장면 | 그 장면에 들어갈 수 있다 |
| 오브젝트 | 살펴봤다 |
| 퍼즐 | 풀었다 |
| 용의자 | 심문할 수 있다 |
| 진술 | 그 진술의 모순을 증명했다 |
| 라운드 | 그 라운드의 모순을 전부 증명했다 |
| 대조 줄 | 대조표에서 두 줄을 짚었다 |

- 조건은 얻기만 하고 잃지 않는다. "한 번만", "시간이 지나면 닫힘" 같은 필드는 두지 않는다(검증기가 모르는 키를 오류로 처리). 그래서 놓치는 단서가 구조적으로 생기지 않는다.

## 사건 파일 최상위

| 키 | 내용 |
| --- | --- |
| `id`, `chapter`, `title`, `difficulty` | 장 id는 story.json의 `chapters[].id`와 같아야 함 |
| `briefing` | `summary[]`, `rumor[]`, `victim{name, age, role}` |
| `start` | 처음 들어가는 장면 id |
| `reportRequires` | 보고서를 쓸 수 있는 조건. 없으면 `solution.requires` 전부 |
| `objectives[]` | `{when[], text}`. 조건을 만족하는 마지막 항목이 현재 목표 한 줄 |
| `scenes[]` | 장면 (아래) |
| `puzzles[]` | 퍼즐 (아래) |
| `clues[]` | 단서 (아래) |
| `suspects[]` | 용의자와 심문 (아래) |
| `board[]` | 대조표 줄 `{id, left, right, sentence, gives?}`. left/right는 단서 또는 진술 id |
| `accusation` | `method[]`, `motive[]`: `{id, text}` 선택지. 범인 선택지는 용의자 목록 |
| `solution` | `culprit`, `method`, `motive`, `requires[]`, `evidence{culprit[], method[], motive[]}` |
| `hints` | `{퍼즐 id: [메모 세 장]}` 서진우 메모체. `report` 키는 보고서 메모 세 장(풀이 장 없음) |
| `result` | `text[]` 결말 지문 |

## 장면·오브젝트

```json
{ "id": "sc.broadcast", "name": "방송실", "alt": "대체 텍스트", "text": ["첫 지문"], "requires": [],
  "objects": [{ "id": "obj.mixer", "label": "방송 믹서", "hotspot": {"x":34,"y":52,"w":26,"h":16},
                "text": ["살펴볼 때 지문"], "requires": [], "gives": ["clue.x"], "puzzle": "p.mixer" }] }
```

- `label`은 화면과 스크린리더가 같이 읽는 세계 안의 이름. 장면당 오브젝트 4개 이하.
- `hotspot`은 장면 그림 기준 퍼센트(0~100). 같은 내용이 "살펴볼 곳" 목록에도 나온다.
- 빈 문자열 `""`은 지문에서 한 줄 띄움(결정타 앞).

## 퍼즐

`{id, type, title, requires?, teaches[], gives[], config, answerNote}`

- `teaches`: 풀이 방법을 알려 주는 현장 단서. 이 퍼즐을 풀지 않고도 얻을 수 있어야 한다.
- `answerNote`: 메모 세 장을 다 넘긴 뒤 열리는 풀이 장.
- `type`별 `config`:
  - `wiring`: `plugs[{id,label}]`, `jacks[{id,label}]`, `answer{plug: jack}`
  - `lock`: `digits`, `answer`(숫자 문자열)
  - `pieces`: `pieces[{id,label}]`, `answer[]`(정답 순서. 섞는 건 엔진이 함)
  - `restore`: `label`, `text`(지워진 줄 전체), `target`(0~100, 맞는 빛의 각도), `tolerance`, `answer`(text 안의 옮겨 적을 값), `answerLabel`
  - `sort`: `categories[{id,label}]`, `items[{id,label,detail}]`, `answer{item: category}`, 선택 `caption`·`itemHeader`·`detailHeader`·`categoryHeader`·`checkLabel`·`wrongText`
  - `move`: `items[{id,label,text}]`(틀린 것은 그 뒤에 있던 것을 `text`로), `answer`
  - `morse`: `signal[]`(글자마다 `·`/`—` 묶음, 쉼은 `/`), `answer`(묶음 수와 글자 수가 같아야 함), `answerLabel`. 화면엔 기호, 스크린리더엔 "짧/길"
  - `optics`: `mirrors[{id,label}]`, `answer{mirror: 각도}`, `min`, `max`, `step`. 틀리면 처음 어긋난 거울을 알려 준다
  - `timeline`: `items[{id,label}]`(셋 이상), `answer[]`(정답 순서. 처음엔 뒤집혀 놓인다), 선택 `groupLabel`·`checkLabel`·`wrongText`
- `solvedText`: 풀었을 때 지문(글 흐름에도 남는다).

## 단서

`{id, name, text, people[], image?, alt?, fragment?, atmosphere?}`

- `fragment`: 메인 스토리 조각 id(story.json `fragments`에 있어야 함).
- `atmosphere: true`: 분위기용. 추리에 안 쓰여도 경고하지 않는다.

## 용의자·심문

```json
{ "id": "s.kang", "name": "강지훈", "age": 48, "role": "...", "intro": "...",
  "suspectedBy": ["clue.x"], "clearedBy": [],
  "rounds": [{ "id": "r.kang.1", "requires": [], "gives": [],
    "statements": [{ "id": "st.kang.leave", "text": "...", "contradictedBy": ["clue.gatelog"],
                     "reply": "모순을 짚었을 때 대답", "gives": [], "onProven": [] }] }] }
```

- 진술의 `gives`: 듣기만 해도 얻는 단서(증언). `onProven`: 모순을 증명하면 얻는 단서.
- 라운드의 진술 4개 이하. 라운드의 모순을 전부 짚으면 라운드 `gives`.
- 용의자마다 `suspectedBy` 하나 이상. 범인이 아니면 `clearedBy` 하나 이상, 범인은 비움.
- `onWrong`: 증거를 잘못 내밀었을 때 굳는 말투(지문 여러 줄). 없으면 기본 문장.
- 짚을 모순이 없는 라운드는 듣는 것으로 끝난다.

## 장의 종류(kind)

| kind | 닫히는 방법 | 다른 점 |
| --- | --- | --- |
| `case`(기본) | 수사 보고서 통과 | `solution`, `accusation` 필요. 용의자마다 의심·소거 단서 |
| `prologue` | `completeWhen`을 채우면 저절로 | 보고서·용의자 없음 |
| `final` | `completeWhen`(대면 마지막 단계) 뒤 `offer`에 답한다 | `endings{truth, partial, cover}`, `offer{text, accept, refuse}` 필요 |

- `carry`(단서): 메인 스토리 조각 id. 그 조각을 앞선 장에서 모았으면 이 장을 펼칠 때 단서로 들고 들어온다. 검증기는 다 모았다고 보고 도달 가능성을 따진다.
- `skippable`(라운드): 내밀 증거가 없을 때 "넘어간다"로 닫을 수 있다. 넘긴 단계는 증명으로 치지 않는다.
- `reconstruct`(퍼즐 유형): `rows[{id, time, event, accept[]}]`. 칸마다 받는 단서 중 하나를 놓는다. 받는 단서를 하나도 안 가졌으면 그 칸은 빈칸.
- `han[{when, text}]`: "한도윤에게 묻는다"를 누르면 조건을 만족하는 마지막 줄이 글 흐름에 남는다.
- `input: "playerName"`(오브젝트): 살펴본 줄 아래에 인계 칸 이름 입력이 붙는다.

엔딩: 받아들이면 은폐. 거절하면 조각 5개를 다 모았고 대면을 하나도 넘기지 않았을 때 진실, 아니면 불완전.

## 장면 그림

`scene.art`는 `art/<사건>/<장면>.svg`. viewBox `0 0 160 100`(16:10)이라 핫스팟 x%×1.6, y%가 그림 좌표다. 색은 넣지 않고 클래스(`bg f1 f2 f3 ln ln2 lt seal seal-ln glow`)로만 칠한다. 검증기가 파일이 있는지, lint가 색·스크립트가 없는지 본다.

## story.json

`chapters[].ready`: 데이터가 준비된 장. 준비되지 않은 장은 사건부 철에 "아직 도착하지 않은 사건부"로 나오고 선행 조건에서 건너뛴다.

## 검증기가 확인하는 것

도달 불가 단서·장면·퍼즐·진술·대조 줄, 퍼즐 선행 조건 순환, 풀이 단서가 퍼즐 뒤에만 나오는 경우, 모순·소거·의심·정답 단서의 입수 가능성, id 중복과 잘못된 참조, 모르는 키, 선택지 4개 초과, 메모 3장·풀이 장 누락, 이름·대체 텍스트 누락, 퍼즐 config 정합성, story.json의 조각 연결. 서술 규칙(2.6) 위반과 서진우 메모의 존댓말은 경고.
