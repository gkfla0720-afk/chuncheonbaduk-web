export interface Profile {
  id: string;
  name: string;
  phone_last4: string;
  rank: string;
  tier: string;
  current_status: string;
  last_check_in: string;
}

export interface Match {
  id: number;
  match_type: string;
  handicap: string;
  started_at: string;
  black_team: string[];
  white_team: string[];
}