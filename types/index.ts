import { Tables } from './supabase';

// Derived directly from the generated Supabase schema (types/supabase.ts) so
// these stay in sync with the actual `profiles` / `matches` table columns
// instead of drifting out of date as a hand-maintained duplicate.
export type Profile = Tables<'profiles'>;
export type Match = Tables<'matches'>;

// 실시간 기보 중계용 착수 한 수. matches.kifu(jsonb) 배열에 저장된다.
export interface KifuMove {
  color: 'black' | 'white';
  x: number; // 0-indexed 열
  y: number; // 0-indexed 행
}
