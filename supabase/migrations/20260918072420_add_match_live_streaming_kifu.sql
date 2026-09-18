-- 실시간 기보 중계 기능: 관전자용 라이브 기보 스트리밍은 동시에 1개 대국만 허용한다.
alter table public.matches
  add column if not exists is_streaming boolean not null default false,
  add column if not exists kifu jsonb not null default '[]'::jsonb,
  add column if not exists board_size smallint not null default 19;

comment on column public.matches.is_streaming is '관전자용 실시간 기보 중계 여부 (동시에 1개 대국만 true 가능)';
comment on column public.matches.kifu is '관리자가 실시간으로 입력한 착수 기록. [{"color":"black|white","x":number,"y":number}]';
comment on column public.matches.board_size is '중계용 바둑판 크기 (기본 19줄)';

-- 동시에 하나의 대국만 실시간 중계될 수 있도록 부분 유니크 인덱스로 강제한다.
create unique index if not exists one_streaming_match_idx on public.matches ((true)) where (is_streaming);
