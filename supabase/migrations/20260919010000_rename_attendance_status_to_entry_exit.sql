-- 코드 전반의 '출석/퇴장' 표현을 '입장/귀가'로 통일하는 데 맞춰, DB에 저장된 상태 값도 함께 정리한다.
-- profiles.current_status: '출석중' -> '입장중' (기원에 머무르고 있는 상태)
alter table public.profiles drop constraint if exists profiles_current_status_check;
update public.profiles set current_status = '입장중' where current_status = '출석중';
alter table public.profiles
  add constraint profiles_current_status_check
  check (current_status in ('오프라인', '입장중', '대국중'));

-- attendance.status: '출석중' -> '입장' (입장/귀가 각각 한 번의 이벤트를 기록하는 값이므로 '중' 접미사를 뗀다)
alter table public.attendance alter column status drop default;
alter table public.attendance drop constraint if exists attendance_status_check;
update public.attendance set status = '입장' where status = '출석중';
alter table public.attendance
  add constraint attendance_status_check
  check (status in ('입장', '귀가'));
alter table public.attendance alter column status set default '입장';
