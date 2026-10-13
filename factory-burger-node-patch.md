# 기획서 수정분: Node.js 서버 + 보안

> 기존 `factory-burger-design.md`에 적용하는 **수정/추가분만** 담았다.
> 아래 내용이 기존 문서와 충돌하면 **이 문서가 우선**한다.
> 대상: 기존 12장 "구현 구조"(교체), 17장(신규 추가), 16장 마지막 항목(추가)

---

## 목적

- 주소창에 `index.html`이 그대로 드러나거나, 파일을 직접 열어서(`file://`) 실행되는 방식을 쓰지 않는다.
- 게임은 **Node.js 서버가 `/` 로 서빙**한다. (예: `http://localhost:3000/`)
- 서버는 공개 폴더에 있는 파일만, 허용한 방식으로만 내보낸다.

### 알아둘 한계 (정직하게)
- 브라우저에서 실행되는 JS/스프라이트/데이터는 **브라우저가 내려받아야 하므로 완전히 숨길 수 없다.** 개발자 도구로 볼 수 있다.
- 이 서버 구조가 해주는 일은 "필요 없는 파일 노출 방지, 주소 정리, 서버 소스/설정 보호, 기본 보안 헤더"다. 소스 은닉(난독화)은 목표로 하지 않는다.
- ES Modules는 어차피 `file://`에서는 막히므로 서버 방식이 개발에도 필요하다.

---

## 12장 교체: 구현 구조

```
/factory-burger
├─ server.js               # Node 서버 (public 밖에 둔다. 외부에 노출되지 않음)
├─ package.json            # "type": "module", scripts.start = "node server.js", dependencies 없음
├─ README.md
└─ public/                 # 이 폴더 안의 파일만 외부에 서빙된다
    ├─ index.html          # "/" 요청에 응답 (주소에는 index.html이 보이지 않음)
    ├─ css/ui.css
    ├─ assets/fonts/
    ├─ data/               # palette / items / recipes / machines / orders / progression .json
    └─ js/
        ├─ main.js
        ├─ sim/            # grid, belt, machine, hopper, orders, power, economy
        ├─ render/         # sprites, world, effects, camera
        ├─ sprites/        # items, machines, tiles, ui, customers
        ├─ ui/
        ├─ input.js
        ├─ audio.js
        └─ save.js
```

- 기존 12장의 나머지 원칙(시뮬레이션/렌더 분리, 데이터 기반, 성능 목표, 저장 검증 등)은 그대로 유지한다.
- 경로가 `public/` 아래로 이동한 것 외에 게임 코드 구조는 바뀌지 않는다.

---

## 17장 신규: Node.js 서버와 보안

### 17.1 서버 기본 원칙
- **Node 내장 `http`/`fs`/`path`만 사용한다.** Express 등 외부 패키지 추가 금지. (의존성이 없으니 `npm install`도 필요 없다.)
- 포트는 환경변수 `PORT`, 기본 3000. 기본 바인딩은 **`127.0.0.1`** (로컬 전용). 외부 공개가 필요할 때만 `HOST` 환경변수로 바꾼다.
- 허용 메서드는 `GET`, `HEAD`뿐. 그 외는 `405`.
- `/` 요청은 `public/index.html` 내용을 응답한다. `/index.html` 요청은 `/`로 **301 리다이렉트**한다.
- 디렉터리 목록(listing)은 절대 제공하지 않는다. 폴더 경로를 요청하면 `404`.

### 17.2 정적 파일 서빙 규칙
- 서빙 루트는 `public/` 하나. 그 밖의 파일(`server.js`, `package.json`, `.git`, `.env` 등)은 요청 경로가 어떻게 오든 접근 불가.
- **경로 탈출(Path Traversal) 방지**
  - URL을 디코딩한 뒤 `path.normalize`/`path.resolve`로 정규화한다.
  - 결과 경로가 `public/` 루트 아래가 아니면 `404`. (`../`, 인코딩된 `%2e%2e`, 백슬래시, null byte(`%00`) 모두 차단)
  - 숨김 파일(점으로 시작하는 파일/폴더) 요청은 `404`.
- **확장자 허용 목록**만 서빙: `.html .css .js .json .woff2 .woff .png .ico .txt`
  - MIME 타입을 확장자별로 명시한다. 모르는 확장자는 `404`.
  - `.map`, `.env`, `.md` 등은 서빙하지 않는다.
- 에러 응답은 **간단한 고정 문구**만. 내부 경로, 스택 트레이스, 서버 버전을 노출하지 않는다.
- 응답 헤더에서 서버 정보(`X-Powered-By` 등)를 넣지 않는다.

### 17.3 보안 헤더 (모든 응답에 적용)
| 헤더 | 값 |
|---|---|
| `Content-Security-Policy` | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `X-Frame-Options` | `DENY` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

- CSP 때문에 **인라인 `<script>`, 인라인 `style=""` 속성, `eval`, `new Function` 사용 금지.** 모든 JS는 파일로 분리하고, 스타일은 CSS 파일 또는 CSS 변수/클래스로 처리한다. (Canvas 그리기와 `element.style.setProperty`는 사용 가능. 단, `style` 속성 문자열을 HTML로 주입하는 방식은 피한다.)
- HTTPS 환경에 배포할 경우에만 `Strict-Transport-Security`를 추가한다. (로컬 개발에서는 넣지 않는다.)

### 17.4 캐시
- `index.html`: `Cache-Control: no-cache`
- 그 외 정적 파일: 개발 중에는 `no-cache`. 배포 시 `max-age` + 파일명 해시 버전 관리를 검토한다. (JS 모듈 import 경로는 고정이므로 `?v=` 쿼리 방식 중 하나로 시작.)
- `ETag`/`Last-Modified`로 조건부 요청(304) 지원하면 좋다. 필수는 아님.

### 17.5 서버가 하지 않는 것 (현재 범위)
- 계정, 로그인, 세션, DB, 클라우드 저장, 랭킹은 **지금은 없다.** 저장은 계속 localStorage + JSON 내보내기/가져오기.
- 나중에 서버 기능을 추가하게 되면(저장/랭킹/청사진 공유) 그때 아래를 별도 기획으로 다룬다.
  - 입력 스키마 검증과 크기 제한
  - 랭킹 점수 조작 방지(서버 재검증)
  - 요청 빈도 제한(rate limit)
  - 비밀번호 해시와 세션/토큰 관리

### 17.6 클라이언트 쪽 보안 (기존 내용 유지)
- 사용자 입력 문자열은 `textContent`로만 DOM에 넣는다. `innerHTML`, `insertAdjacentHTML`, `document.write` 금지.
- localStorage와 가져오기(JSON 파일) 데이터는 **신뢰하지 않고** 스키마/범위/버전을 검증한 뒤 불러온다. 가져온 JSON은 숫자 범위, 배열 길이, 알 수 없는 기계 종류, 문자열 길이를 확인하고, 잘못되면 거부 + 사용자에게 이유 안내.
- 불러온 데이터의 키 이름으로 객체를 만들 때 `__proto__`, `constructor`, `prototype` 키를 거부한다 (prototype pollution 방지).
- 외부 CDN, 외부 폰트, 외부 스크립트 로딩 금지 (CSP에서도 막힘).

### 17.7 확인 항목
- [ ] `http://localhost:3000/` 에서 게임이 열리고, 주소창에 `index.html`이 보이지 않는가?
- [ ] `/index.html` 요청 시 `/`로 이동하는가?
- [ ] `/server.js`, `/package.json`, `/../server.js`, `/%2e%2e/server.js`, `/.env` 요청이 모두 `404`인가?
- [ ] `/js/`, `/data/` 같은 폴더 요청이 목록을 보여주지 않고 `404`인가?
- [ ] `POST` 요청이 `405`로 거부되는가?
- [ ] 브라우저 콘솔에 CSP 위반 오류가 없는가?
- [ ] 응답 헤더에 17.3의 보안 헤더가 모두 들어 있는가?
- [ ] 저장 데이터를 일부러 망가뜨려도 게임이 죽지 않고 안내 메시지를 보여주는가?

---

## 13장 M0 보강

기존 M0 앞에 아래 단계를 추가한다.

### M-1. 서버 뼈대
- `server.js`, `package.json`, `public/index.html`(빈 캔버스 + 제목)
- 17.1~17.4를 구현한다.
- 확인: 17.7 체크리스트를 통과한다. 그 후 M0으로 진행.

---

## 16장 추가 항목

- 서버 코드는 `public/` 밖에 둔다. `public/` 안에는 클라이언트 파일만 둔다.
- `server.js`에는 외부 패키지를 쓰지 않는다. 필요해 보이면 먼저 질문한다.
- 수정할 때는 변경된 파일의 **변경 부분만** 보고한다.
