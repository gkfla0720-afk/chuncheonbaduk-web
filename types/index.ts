export interface Profile {
  id: string;
  name: string;
  phone_last4: string;
  rank: string;
  tier: string;
  current_status: string;
  last_check_in: string | null;
  created_at: string;
}

export interface Match {
  id: number;
  match_type: string;
  handicap: string;
  started_at: string;
  black_team: string[];
  white_team: string[];
  phase: '진행중' | '종료' | '취소';
  winner: '흑승' | '백승' | '무승부' | '취소' | null;
  ended_at: string | null;
}