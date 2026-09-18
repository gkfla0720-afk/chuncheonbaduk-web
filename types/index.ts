import { Tables } from './supabase';

// Derived directly from the generated Supabase schema (types/supabase.ts) so
// these stay in sync with the actual `profiles` / `matches` table columns
// instead of drifting out of date as a hand-maintained duplicate.
export type Profile = Tables<'profiles'>;
export type Match = Tables<'matches'>;
