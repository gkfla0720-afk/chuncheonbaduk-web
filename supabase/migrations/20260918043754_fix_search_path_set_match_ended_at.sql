-- 트리거 함수의 search_path를 고정해 함수 탐색 경로 하이재킹 위험을 제거한다.
alter function public.set_match_ended_at() set search_path = public;
