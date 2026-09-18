-- 기보 RPC 함수들의 search_path를 고정해 함수 탐색 경로 하이재킹 위험을 제거한다.
alter function public.place_kifu_move(bigint, smallint, smallint) set search_path = public;
alter function public.undo_kifu_move(bigint) set search_path = public;
