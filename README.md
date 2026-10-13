# 햄버거 공장

레트로 산업풍 탑뷰 햄버거 공장 자동화 게임. 기획: `factory-burger-design.md` + `factory-burger-node-patch.md`(우선).

## 실행

Node.js 18 이상. 외부 패키지가 없으므로 `npm install` 은 필요 없다.

```
npm start      # http://localhost:3000/
npm test       # 서버 보안 점검 + 시뮬레이션 + 스프라이트/팔레트 검사
```

- 포트: `PORT` 환경변수 (기본 3000). 바인딩: `HOST` 환경변수 (기본 127.0.0.1, 로컬 전용).
- `public/` 안의 파일만 서빙된다. `server.js`, `package.json`, `tests/` 등은 외부에서 접근할 수 없다.

## 조작

| PC | 모바일 | 동작 |
|---|---|---|
| WASD | 왼쪽 조이스틱 | 이동 |
| E (길게) | 작업 버튼 (길게) | 꺼내기·올리기·썰기·굽기·조립·납품 |
| Q | 내려놓기 버튼 | 든 물건 내려놓기 |
| 방향키 / 우클릭 끌기, C 복귀 | 화면 끌기 | 카메라 |
| 휠 / + - | 두 손가락 | 확대 3x~5x |
| Space | 상단 II 버튼 | 일시정지 |
| B → 기계 선택 → 클릭 | 건설 → 칸 탭 → 설치 | 기계 짓기 (R 회전, 방향키+Enter 가능, 컨베이어는 끌어서 여러 칸) |
| X | 건설 창의 철거 모드 | 철거 (부품 100% 환급) |
| Esc | 닫기 / 취소 | 창 닫기, 건설 끝 |

화면은 게임이 전부 쓰고, 주문·레시피·건설·도움말·정보는 상단 메뉴에서 하나씩 펼친다.
처음 시작하면 튜토리얼이 한 단계씩 목표를 알려 주고, 화살표가 다음 작업대를 가리킨다 (도움말에서 다시 하기).

개발용: 주소 끝에 `#debug` 를 붙이면 콘솔에서 `__game` 으로 상태를 볼 수 있다.

## 폰트

`public/assets/fonts/Galmuri11.woff2` (OFL). 없으면 시스템 monospace 로 표시되고 안내가 뜬다.

## 구조

```
server.js            Node 내장 http 서버 (보안 헤더, 경로 탈출 차단, 확장자 허용 목록)
public/
  index.html
  css/ui.css         색은 CSS 변수 토큰으로만
  data/              밸런스/설정 JSON (palette, game, items, recipes, machines, tutorial, progression)
  js/
    main.js          부팅, 고정 20틱 루프 + rAF 렌더 보간
    data.js          JSON 로딩/검증
    input.js         키보드/마우스
    sim/             시뮬레이션 (DOM/Canvas 모름): grid, lookup, player, station, interact, build, conveyor, inserter, progression, economy, tutorial, world
    render/          sprites(bake/캐시), camera, world, effects
    sprites/         도트 데이터 (문자열 배열): tiles, characters, items, machines, ui
    ui/              상단 바/손/안내(hud), 접이식 패널, 레시피북, 튜토리얼 카드, 건설 모드
tests/               node:test
```

## 진행 상황

- [x] M-1 서버 뼈대
- [x] M0 뼈대 (격자, 카메라 이동/줌, 팔레트·스프라이트 bake, 플레이어 이동)
- [x] M1 수동 플레이 (+ 모바일 터치, 튜토리얼, 레시피북)
- [x] M2 첫 기계와 건설 (첫 햄버거 판매 → 그릴 해금 + 부품 보상)
- [x] M3 컨베이어와 투입기 (햄버거 3개 판매 → 컨베이어·투입기·분배기·합류기 해금)
- [ ] M4 완성 라인 + 병목 시각화
