import { Tables } from './supabase';

// Derived directly from the generated Supabase schema (types/supabase.ts) so
// these stay in sync with the actual `profiles` / `matches` table columns
// instead of drifting out of date as a hand-maintained duplicate.
export type Profile = Tables<'profiles'>;
export type Match = Tables<'matches'>;

// 실시간 기보 중계용 착수 한 수. matches.kifu(jsonb) 배열에 저장된다.
// x/y가 모두 -1이면 "착수 넘김(pass)"을 의미한다(바둑판에는 아무 것도 그려지지 않음).
export interface KifuMove {
  color: 'black' | 'white';
  x: number; // 0-indexed 열, -1이면 pass
  y: number; // 0-indexed 행, -1이면 pass
}
