# 크로스 기기 동기화 — Supabase 연동 가이드

목표: 폰·패드·PC에서 로그인하면 같은 단어장·문제·진행률이 보이게 한다.
프레임워크·별도 서버 없이, **바닐라 프론트 + Supabase(Postgres+Auth)** 로 구현한다.

---

## 역할 분담

**내(사용자)가 직접 하는 것 — 계정/셋업뿐**
1. supabase.com 에서 프로젝트 생성(무료 티어).
2. SQL Editor에 `db/schema.sql` 붙여넣고 실행 → 테이블 4개 + 보안규칙 생성됨.
3. Authentication → Providers: **Email(매직링크)** 은 기본 켜짐. (원하면 Google도 추가.)
4. Authentication → URL Configuration에 사이트 주소 추가: `http://localhost:5173`(로컬)와 배포 도메인.
5. Project Settings → API 에서 **Project URL** 과 **anon public key** 복사.
   - anon 키는 프론트에 노출돼도 안전(위 RLS가 남의 데이터 접근을 막음). service_role 키는 절대 프론트에 넣지 말 것.

**클로드 코드가 짜는 것 — 코드 전부**
- 로그인 화면(매직링크/구글), 로그아웃, 세션 유지.
- Supabase 클라이언트 초기화(아래 스니펫).
- 동기화 계층: 로그인 시 내 데이터 pull → 화면 렌더. 변경 시 서버 upsert + localStorage 캐시 갱신.
- 최초 로그인 시 기존 로컬 시드/데이터를 내 계정으로 1회 이전(마이그레이션).

---

## 연결 스니펫 (빌드 없이 ESM)

`index.html` 안에서 CDN ESM으로 바로 import — 번들러 불필요:

```html
<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
  // config.js 등에서 주입 (키는 커밋해도 anon이라 무방하나, 분리 권장)
  const SUPA_URL = 'https://xxxx.supabase.co';
  const SUPA_ANON = 'ey....';            // anon public key
  export const sb = createClient(SUPA_URL, SUPA_ANON);
</script>
```

로컬 개발/배포에 빌드가 필요 없다. 정적 호스팅(Vercel/Netlify/Pages) 그대로 유지.

---

## 데이터 모델 (현재 앱 스키마 → 테이블 그대로 매핑)

| 앱(JS) | 테이블 | 비고 |
|---|---|---|
| `Cat{name,emoji}` | `categories` | user_id로 소유 |
| `Deck{name,type,best}` | `decks` | category_id FK |
| `Item{q,a,choices,answer}` | `items` | deck_id FK |
| `fav[] / wrong[]` | `items.fav / items.wrong` | 인덱스 배열 → 행별 boolean |
| `best` | `decks.best` | 그대로 |

`db/schema.sql`이 위 구조 + RLS(내 행만) + updated_at 트리거까지 만든다.

---

## 동기화 전략 (권장: 온라인 우선 + 로컬 캐시)

1. **로그인 성공** → `categories/decks/items`를 user 기준으로 전부 select → 메모리 `DB`로 조립 → 렌더. 동시에 localStorage에 캐시.
2. **오프라인/로딩 중** → localStorage 캐시로 즉시 표시(마지막 상태).
3. **변경(추가·삭제·이름변경·정답기록·즐겨찾기)** → 해당 행만 Supabase에 insert/update/delete → 성공 시 로컬 반영.
4. 충돌은 개인 앱 특성상 **last-write-wins**(updated_at)로 충분. 실시간 협업 아님.
5. (선택) 오프라인 쓰기 큐: 끊겼을 때 변경을 쌓아뒀다 재연결 시 flush. 1차 구현에선 생략 가능.

퀴즈 풀이 중 매 정답마다 서버 왕복은 과하니, **세션 끝(결과 화면)에서 best/wrong/fav를 일괄 저장**하는 방식을 권장.

---

## 배포

정적 파일 그대로:
- Vercel: 깃 연결 → 프레임워크 프리셋 **Other/None** → 자동 배포. 도메인의 주소를 Supabase Auth Redirect URL에 추가.
- Netlify / Cloudflare Pages / GitHub Pages 도 동일(정적).

끝. 서버 인스턴스·컨테이너 없음.

---

## 다음 확장 (필요해지면)

- **PWA**: manifest + service worker → 홈 화면 설치 + 오프라인.
- **파일 업로드 원본 보관**: Supabase Storage에 올린 엑셀/PDF 원본 저장(재생성용). 지금은 파싱 후 텍스트만 저장하므로 필수는 아님.
- **PDF 자동추출**: pdf.js 워커로 텍스트화 → 기존 `textToQuiz()` 재사용.
