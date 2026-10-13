# 햄버거 공장

레트로 산업풍 탑뷰 햄버거 공장 자동화 게임. 기획: `factory-burger-design.md` + `factory-burger-node-patch.md`(우선).

## 플레이

https://sjoinss.github.io/hamburger-factory/ (main 에 푸시하면 테스트 통과 후 자동 배포)

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
| WASD | 바닥 탭 (기계를 탭하면 그 앞으로 가서 바라봄) | 이동 |
| E (길게) | 작업 버튼 (길게) | 꺼내기·올리기·썰기·굽기·조립·납품 |
| Q | 내려놓기 버튼 | 든 물건 내려놓기 |
| 방향키 / 우클릭 끌기, C 복귀 | 화면 끌기 | 카메라 |
| 휠 / + - | 두 손가락 | 확대 3x~5x |
| Space | 상단 II 버튼 | 일시정지 |
| B → 기계 선택 → 클릭 | 건설 → 칸 탭 → 설치 | 기계 짓기 (R 회전, 방향키+Enter 가능, 컨베이어는 끌어서 여러 칸 — 모바일은 '끌어서 깔기') |
| 클릭 / F | 바라보는 기계를 한 번 더 탭 | 기계 상태 보기 (최근 60초 가동률, 입고구 재료 고르기) |
| O | 상단 '병목' | 병목 보기: 빨강 빗금 = 막힘, 파랑 점 = 한산 |
| 상단 '주문' | 상단 '주문' | 주문서: 품목/보유량/부족/남은 시간, '게이트에 맡기기' |
| X | 건설 창의 철거 모드 | 철거 (부품 100% 환급) |
| 건설 → 청사진 '영역 저장' → 끌기 | 끌기, 또는 모서리 탭 → 시작점 → 여기까지 저장 | 청사진 저장 (목록에서 붙여넣기) |
| 상단 '설정' | 상단 '설정' | 저장(30초 자동)·내보내기·불러오기·새로 시작, 소리 |
| Esc | 닫기 / 취소 | 창 닫기, 건설 끝 |

화면은 게임이 전부 쓰고, 주문·레시피·건설·도움말·정보·설정은 상단 메뉴에서 하나씩 펼친다.
처음 시작하면 튜토리얼이 한 단계씩 목표를 알려 주고, 화살표가 다음 작업대를 가리킨다 (도움말에서 다시 하기).

개발용: 주소 끝에 `#debug` 를 붙이면 콘솔에서 `__game` 으로 상태를 볼 수 있고, `#touch` 를 붙이면 PC 에서 터치 화면을 미리 볼 수 있다 `#unlock` 은 모든 단계를 바로 연다 (`#debug,touch,unlock` 처럼 함께).

## 폰트

`public/assets/fonts/Galmuri11.woff2` (OFL). 없으면 시스템 monospace 로 표시되고 안내가 뜬다.

## 구조

```
server.js            Node 내장 http 서버 (보안 헤더, 경로 탈출 차단, 확장자 허용 목록)
public/
  index.html
  css/ui.css         색은 CSS 변수 토큰으로만
  data/              밸런스/설정 JSON (palette, game, items, recipes, machines, orders, zones, tutorial, progression)
  js/
    main.js          부팅, 고정 20틱 루프 + rAF 렌더 보간
    data.js          JSON 로딩/검증
    input.js         키보드/마우스
    sim/             시뮬레이션 (DOM/Canvas 모름): grid, lookup, rng, path, player, station, interact, build, parts, conveyor, inserter, storage, gate, orders, market, power, zones, progression, economy, stats, tutorial, reader(주문 인식기), bundler(합류 포장기), blueprint, save, world
    render/          sprites(bake/캐시), camera, world, customers, effects
    sprites/         도트 데이터 (문자열 배열): tiles, characters, customers, farm, farm-potato, items, machines, storage, workshop, auto, ui
    audio/           Web Audio 합성 효과음 (파일 없음)
    ui/              상단 바/손/안내(hud), 접이식 패널, 레시피북, 튜토리얼 카드, 건설 모드(구역 매입·청사진 포함), 기계 정보, 통계, 주문서, 탭 이동, 설정(저장·소리)
tests/               node:test
```

## 진행 상황

- [x] M-1 서버 뼈대
- [x] M0 뼈대 (격자, 카메라 이동/줌, 팔레트·스프라이트 bake, 플레이어 이동)
- [x] M1 수동 플레이 (+ 모바일 터치, 튜토리얼, 레시피북)
- [x] M2 첫 기계와 건설 (첫 햄버거 판매 → 그릴 해금 + 부품 보상)
- [x] M3 컨베이어와 투입기 (햄버거 3개 판매 → 컨베이어·투입기·분배기·합류기 해금)
- [x] M4 완성 라인 + 병목 시각화 (햄버거 6개 판매 → 입고구·절단기·세척기·반죽기·오븐·버거 조립기 해금, 통계 패널)
- [x] M5 깔때기 호퍼 + 주문 시스템 (햄버거 15개 판매 → 호퍼·사일로·출고 게이트, 주문서·손님·시세)
- [x] 재료 준비: 밀밭·채소밭 수확 → 맷돌/제분기 → 반죽대/반죽기 → 화덕/오븐 (입고구는 생고기만)
- [x] M6 부품 공방 + 확장 (햄버거 25개: 제련로·프레스·와이어·기어 선반·부품 조립기·발전기, 전력, 구역 매입 / 40개: 감자튀김·콜라·세트)
- [x] M7 완전 자동화 (햄버거 60개: 주문 인식기·합류 포장기, 센서·제어 회로 / 청사진, 저장·불러오기, 효과음, 평판이 오르면 손님이 더 자주 온다)
