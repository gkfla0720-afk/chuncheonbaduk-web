-- 클라이언트(lib/goRules.ts)에서 패/자충수 검증까지 포함해 착수를 처리하므로
-- 규칙 검증이 없는 이 RPC는 더 이상 호출되지 않는다. undo_kifu_move는 계속 사용한다.
DROP FUNCTION IF EXISTS public.place_kifu_move(bigint, smallint, smallint);
