# amgiBBang (암기빵) 🍞

엑셀·CSV로 단어와 문제를 올려 **4지선다 퀴즈**로 외우는 학습 웹앱.
카테고리(토익 · 항공 …)로 나눠 세트를 만들고, 진행률·오답·즐겨찾기를 기록한다.
단어 → 뜻 4지선다 카드형 풀이 화면이 기본이다.

**로그인 한 번이면 폰·패드·PC 어디서든 같은 데이터가 보인다** — 이메일 매직링크 로그인 + Supabase 동기화.

## 지금 상태

- **단일 파일** `index.html` — 프레임워크·빌드·번들러 없이 브라우저에서 바로 열림. 의존성 0.
- **크로스 기기 동기화**: 이메일 **매직링크** 로그인(비밀번호 없음) → Supabase(Postgres)에 저장 → 어느 기기서든 동일 데이터.
  - `supabase-js`를 **CDN ESM 동적 import**로 로드 (정적 배포 그대로 유지, 빌드 불필요).
  - 로그인 시 서버에서 pull, 변경 시 디바운스 mirror-push(upsert + 고아 삭제). Row Level Security로 내 데이터만 접근.
- **오프라인 캐시**: `localStorage`는 마지막 상태를 즉시 보여주는 읽기 캐시로 유지(비로그인이면 단독 저장소).
- **입력 방식 3가지**
  - 붙여넣기 (엑셀에서 두 열 복사 → 그대로 붙여넣기)
  - `.xlsx` 업로드 — **외부 라이브러리 없이** 브라우저 `DecompressionStream`으로 직접 파싱 (SheetJS 등 불필요)
  - `.csv` / `.txt` / `.tsv` 업로드
  - `.pdf` 업로드 — **pdf.js를 필요할 때만 동적 로드**(정적 배포 유지)해 텍스트 추출 → 번호형 문제 인식. (한글 `.hwp`는 한글에서 PDF로 저장 후 업로드)
- **문제 자동 인식**: `1. 문제 / A. / B. …` 번호형 텍스트를 파싱. 정답은 보기 앞 `*` 또는 `정답: C` 줄로 표시. 정형 표(문제·A·B·C·D·정답)도 지원.
- **정답 편집기**: 정답 표시가 없는 PDF는 가져온 뒤 각 문제의 정답 보기를 클릭해 지정(못 찾은 문제는 붉게 표시).
- **풀이 중단 확인**: 퀴즈 도중 나갈 때 확인창(오답·즐겨찾기는 저장, 최고 기록은 완주 시 갱신).
- **미리 채워진 시드 데이터**
  - 토익: 샘플 단어장 (스크린샷 단어 포함)
  - 항공: PW4090 리뷰문제 27 · 오일 시스템 6 · 스타팅 3 — **업로드한 교안 정답본에서 검증한 문제**
- 라이트/다크 테마, 키보드(1–5 선택, 9 모르겠어요, F 즐겨찾기), 반응형.

## 실행

그냥 `index.html`을 브라우저로 열면 된다. (파일 더블클릭 또는)

```bash
# 로컬 서버로 보고 싶으면
npx serve .        # 또는  python3 -m http.server
```

## 배포

정적 파일 하나라 어디든 올리면 끝:

- **Vercel**: `vercel --prod` (또는 깃 연결 후 자동 배포)
- **Netlify**: 폴더 드래그&드롭, 또는 `netlify deploy --prod`
- **GitHub Pages**: 리포에 push → Settings → Pages → 브랜치 지정
- **Cloudflare Pages**: 리포 연결

빌드 스텝이 없으므로 프레임워크 프리셋은 "None / Static"으로 두면 된다.

### 동기화 켜기 (선택)

로그인·크로스 기기 동기화를 쓰려면 Supabase 프로젝트가 필요하다:

1. `db/schema.sql`을 Supabase SQL Editor에 실행 (테이블 + RLS 생성).
2. `index.html`의 `SUPA_URL` / `SUPA_KEY`를 본인 프로젝트 값(Project URL · publishable key)으로 교체. publishable 키는 공개돼도 안전(RLS가 보호).
3. Supabase → Authentication → **URL Configuration**의 Site URL·Redirect URLs에 배포 주소를 등록.

자세한 설계·절차는 `docs/SUPABASE.md`.

## 다음 단계

`CLAUDE.md`와 `docs/SPEC.md`에 로드맵과 구조 설명이 있다.
클로드 코드에서 이 폴더를 열고 `CLAUDE.md`부터 읽으면 이어서 작업할 수 있다.

## 폴더

```
index.html          앱 본체 (source of truth)
README.md           이 문서
CLAUDE.md           클로드 코드용 프로젝트 컨텍스트
docs/SPEC.md        기획서 · 데이터 모델 · 로드맵
docs/tests/         파싱 로직 검증 스크립트 (node)
samples/            업로드 예제 (xlsx · csv)
```
