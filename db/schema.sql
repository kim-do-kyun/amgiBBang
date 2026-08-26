-- 암기훈련소 · Supabase schema (cross-device sync)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
-- 모든 테이블은 RLS로 "내 행만" 접근 가능. anon 키를 프론트에 노출해도 안전한 이유.

-- ── categories ────────────────────────────────────────────
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  emoji      text default '📚',
  sort       int  default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── decks (학습 세트) ─────────────────────────────────────
create table if not exists public.decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('vocab','quiz')),
  best        int,                       -- 최고 정답률(전체 범위 풀이 시)
  sort        int  default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── items (단어 또는 문제) ────────────────────────────────
create table if not exists public.items (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  deck_id  uuid not null references public.decks(id) on delete cascade,
  sort     int  default 0,
  q        text not null,               -- 단어 or 문제
  a        text,                        -- (vocab) 뜻
  choices  jsonb,                       -- (quiz) 보기 배열 ["...","..."]
  answer   int,                         -- (quiz) 정답 인덱스
  fav      boolean default false,       -- 즐겨찾기
  wrong    boolean default false        -- 누적 오답 표시
);

create index if not exists idx_decks_category on public.decks(category_id);
create index if not exists idx_items_deck     on public.items(deck_id);

-- ── Row Level Security ───────────────────────────────────
alter table public.categories enable row level security;
alter table public.decks      enable row level security;
alter table public.items      enable row level security;

-- 각 테이블: 내 user_id 행만 select/insert/update/delete
do $$
declare t text;
begin
  foreach t in array array['categories','decks','items'] loop
    execute format($f$
      drop policy if exists "own_all" on public.%1$s;
      create policy "own_all" on public.%1$s
        for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_categories on public.categories;
create trigger trg_touch_categories before update on public.categories
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_decks on public.decks;
create trigger trg_touch_decks before update on public.decks
  for each row execute function public.touch_updated_at();
