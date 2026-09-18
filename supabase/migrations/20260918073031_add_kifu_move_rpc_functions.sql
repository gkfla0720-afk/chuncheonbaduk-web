-- 관리자가 빠르게 연속으로 착수를 입력해도(또는 여러 기기에서 동시에 조작해도)
-- 착수 순서/색상이 꼬이지 않도록 행 잠금 기반으로 원자적으로 처리하는 RPC.
create or replace function public.place_kifu_move(p_match_id bigint, p_x smallint, p_y smallint)
returns jsonb
language plpgsql
as $$
declare
  v_kifu jsonb;
  v_next_color text;
begin
  select kifu into v_kifu from public.matches where id = p_match_id for update;
  if v_kifu is null then
    raise exception '대국을 찾을 수 없습니다.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_kifu) elem
    where (elem->>'x')::int = p_x and (elem->>'y')::int = p_y
  ) then
    return v_kifu; -- 이미 돌이 놓인 자리는 무시
  end if;

  v_next_color := case when jsonb_array_length(v_kifu) % 2 = 0 then 'black' else 'white' end;
  v_kifu := v_kifu || jsonb_build_array(jsonb_build_object('color', v_next_color, 'x', p_x, 'y', p_y));

  update public.matches set kifu = v_kifu where id = p_match_id;
  return v_kifu;
end;
$$;

create or replace function public.undo_kifu_move(p_match_id bigint)
returns jsonb
language plpgsql
as $$
declare
  v_kifu jsonb;
begin
  select kifu into v_kifu from public.matches where id = p_match_id for update;
  if v_kifu is null then
    raise exception '대국을 찾을 수 없습니다.';
  end if;

  if jsonb_array_length(v_kifu) = 0 then
    return v_kifu;
  end if;

  v_kifu := v_kifu - (jsonb_array_length(v_kifu) - 1);
  update public.matches set kifu = v_kifu where id = p_match_id;
  return v_kifu;
end;
$$;

grant execute on function public.place_kifu_move(bigint, smallint, smallint) to anon, authenticated;
grant execute on function public.undo_kifu_move(bigint) to anon, authenticated;
