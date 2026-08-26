# CLAUDE.md — 프로젝트 컨텍스트

이 파일은 클로드 코드가 이 프로젝트를 이어받아 작업할 때 먼저 읽는 문서다.

## ▶ 현재 목표 (소유자 확정)

**폰·패드·PC 크로스 기기 동기화.** 로그인하면 어느 기기에서든 같은 데이터가 보여야 한다.
확정 스택: **바닐라 프론트(단일 파일 유지) + Supabase(Postgres+Auth), 빌드·별도 서버 없음.**
Supabase 클라이언트는 CDN ESM(`https://esm.sh/@supabase/supabase-js@2`)으로 import → 정적 배포 유지.
- 스키마/보안: `db/schema.sql` (그대로 SQL Editor에 실행)
- 연동·동기화·인증 설계와 사용자 셋업 절차: `docs/SUPABASE.md`
작업 시작점: 로그인 UI → Supabase 클라이언트 → pull/push 동기화 계층 → 최초 로그인 시 기존 로컬 데이터 마이그레이션.
localStorage는 버리지 말고 **오프라인 읽기 캐시**로 유지한다.

## 무엇인가

amgiBBang(암기빵): 사용자가 엑셀/CSV로 단어·문제를 올려 4지선다 퀴즈로 외우는 학습 웹앱.
목표 사용자 = 프로젝트 소유자 본인(토익 단어 + 항공 정비 교안 PW4090 학습).
UX 레퍼런스 = 단어 → 뜻 4지선다 카드형 화면(상단 진행바, 별 즐겨찾기, "모르겠어요").

## 현재 아키텍처

- **전부 `index.html` 한 파일.** 순수 HTML/CSS/JS, 의존성 0, 빌드 0.
- 상태는 메모리 객체 `DB`에 두고 `localStorage`(`amgi.db.v3`)로 직렬화.
- 라우팅은 `route={view,catId,deckId}` + `render()` 재그리기(프레임워크 없음).
- 뷰: `homeHTML()`(카테고리 카드) → `catHTML()`(세트 목록) → 퀴즈 플레이어(`launchQuiz`/`renderQuestion`/`answer`/`finish`).

### 데이터 모델
```
DB = { cats: [ Cat ] }
Cat  = { id, name, emoji, decks: [ Deck ] }
Deck = { id, name, type:"vocab"|"quiz", created, items:[Item], fav:[idx], wrong:[idx], best:Number|null }
Item(vocab) = { q:단어, a:뜻 }
Item(quiz)  = { q:문제, choices:[String], answer:정답인덱스 }
```
- vocab 퀴즈는 풀 때 다른 항목의 뜻을 오답 보기로 뽑아 4지선다를 즉석 생성.
- quiz 퀴즈는 보기 순서를 매 풀이마다 셔플하고 정답 인덱스를 추적.
- `wrong`은 세션을 넘어 누적(오답만 다시풀기 지원), 정답 맞히면 제거.

### 핵심 로직 위치 (index.html 내부 함수)
- 파싱: `parseVocabPaste` · `parseCSV` · `rowsToVocab` · `rowsToQuiz` · `resolveAnswer` · `textToQuiz`
- **xlsx 리더**: `readXlsx`(+`inflateRaw`,`colNum`,`unxml`). ZIP 중앙디렉터리를 직접 읽고 `DecompressionStream("deflate-raw")`로 압축 해제 → sharedStrings/sheet1 XML 파싱. **외부 라이브러리 없음.**
- 퀴즈 엔진: `launchQuiz`→`renderQuestion`→`answer`→`next`→`finish`.

### 검증됨 (docs/tests)
붙여넣기(탭/콤마, 뜻 속 콤마 보존, 머리글 스킵), 정형 CSV(정답=문자/숫자/본문), 번호형 텍스트(`*`·`정답:`), 실제 .xlsx(한글·콤마) 파싱까지 node 테스트로 통과. 리팩터 시 `docs/tests/*.mjs` 다시 돌릴 것.

## 주의할 제약

- **다운로드 링크 주의**: 현재는 파일 "읽기"만 한다(업로드). 만약 Artifact/샌드박스 환경에 올리면 `<a download>`가 막힐 수 있으니, 양식 파일 제공은 "예시 채우기" 텍스트나 복사 버튼으로.
- vocab 붙여넣기는 **줄마다 첫 구분자만** 쪼갠다(탭 우선). 한국어 뜻의 콤마를 살리기 위함 — 이 규칙 유지할 것.
- 정형 CSV 정답 칸은 마지막 비어있지 않은 열로 간주(`rowsToQuiz`).

## 로드맵 (우선순위 순, 자세한 건 docs/SPEC.md)

1. **⭐ 크로스 기기 동기화 (이번 목표)** — Supabase 연동. `db/schema.sql` + `docs/SUPABASE.md` 따라 로그인·pull/push·마이그레이션 구현. 먼저 정적 배포로 동작 확인 후 얹어도 됨.
2. **정적 배포** — 1과 병행/선행 가능. Vercel/Netlify/Pages(프리셋 None).
3. **PWA화** — manifest + service worker로 오프라인·홈 화면 설치. 동기화와 궁합 좋음.
4. **PDF 자동 추출** — ✅ 완료. `readPdf`가 pdf.js를 CDN ESM으로 **동적 로드**(esm.sh, 워커 포함)해 텍스트 추출 → `textToQuiz`. 정답 없는 PDF는 `answerEditorModal`(정답 편집기)로 지정. `.hwp`(한글 5.0 바이너리)는 미지원 → 한글에서 PDF로 저장 안내.
5. **원본 파일 보관(선택)** — 업로드한 엑셀/PDF를 Supabase Storage에 저장(재생성용).

## 코드 스타일

- 지금은 무의존·단일 파일이 의도적 선택(가볍게 · 배포 쉽게). 기능 추가 전에 "이걸로 프레임워크가 정말 필요한가" 먼저 판단.
- 컴포넌트 분리/번들러 도입은 3번 이후(클라우드 동기화)에서 검토.
