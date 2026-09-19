-- 관리자가 이벤트/대회 등의 사유로 회원에게 직접 연락할 수 있도록 전체 전화번호를 저장한다.
-- 입장/귀가 조회는 계속 phone_last4(뒷자리 4자리)로 하므로 해당 컴럼은 그대로 둔다.
alter table public.profiles
  add column if not exists phone text
  check (phone is null or phone ~ '^[0-9]{9,11}$');

-- phone과 phone_last4가 어긋나지 않도록, phone이 입력되면 뒷자리 4자리를 서버에서 항상 재계산한다.
create or replace function public.profiles_sync_phone_last4()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.phone is not null then
    new.phone_last4 := right(new.phone, 4);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_phone_last4_trigger on public.profiles;
create trigger profiles_sync_phone_last4_trigger
  before insert or update on public.profiles
  for each row execute function public.profiles_sync_phone_last4();
