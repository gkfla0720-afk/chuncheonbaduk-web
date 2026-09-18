-- 계가(집 계산)를 위해 덤(komi)을 구조화된 숫자 컬럼으로 분리하고,
-- 종국 시 확정된 흑/백 집 수와 관리자가 표시한 사석(죽은 돌) 목록을 저장한다.
alter table public.matches
  add column if not exists komi numeric not null default 6.5,
  add column if not exists black_score numeric,
  add column if not exists white_score numeric,
  add column if not exists dead_stones jsonb not null default '[]'::jsonb;

-- 기존 대국들은 handicap 텍스트("... 덤 6.5집)" 등)에서 덤 값을 추출해 채워둔다.
update public.matches
set komi = sub.parsed_komi
from (
  select id, (regexp_match(handicap, '덤\s*(-?\d+(\.\d+)?)집'))[1]::numeric as parsed_komi
  from public.matches
) sub
where public.matches.id = sub.id and sub.parsed_komi is not null;
