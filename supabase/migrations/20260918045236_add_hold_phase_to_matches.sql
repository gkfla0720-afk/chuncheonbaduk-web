-- 자동 퇴장으로 인해 종료 처리를 못한 대국을 위한 '보류' 단계 추가.
-- 승패에는 영향을 주지 않고(winner는 계속 NULL), 추후 관리자가 직접 검토/수정할 수 있도록
-- ended_at만 기록해 "언제 보류되었는지"를 남긴다.

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_phase_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_phase_check
  CHECK (phase = ANY (ARRAY['진행중'::text, '종료'::text, '취소'::text, '보류'::text]));

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_end_state;
ALTER TABLE public.matches ADD CONSTRAINT matches_end_state
  CHECK (
    ((phase = '진행중'::text) AND (ended_at IS NULL) AND (winner IS NULL))
    OR ((phase = '취소'::text) AND (ended_at IS NOT NULL) AND (winner = '취소'::text))
    OR ((phase = '종료'::text) AND (ended_at IS NOT NULL) AND (winner = ANY (ARRAY['흑승'::text, '백승'::text, '무승부'::text])))
    OR ((phase = '보류'::text) AND (ended_at IS NOT NULL) AND (winner IS NULL))
  );

CREATE OR REPLACE FUNCTION public.set_match_ended_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin
  if new.phase in ('종료', '취소') and new.ended_at is null then
    new.ended_at := now();
  elsif new.phase = '보류' then
    if new.ended_at is null then
      new.ended_at := now();
    end if;
    new.winner := null;
  elsif new.phase = '진행중' then
    new.ended_at := null;
    new.winner := null;
  end if;
  return new;
end;
$function$;
