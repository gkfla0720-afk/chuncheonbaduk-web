import { supabase } from './supabase';

export interface ProfileStats {
  wins: number;
  losses: number;
  attendanceRate: number;
  joinedAt: string;
  tier: string;
}

/**
 * Fetches win/loss record, 30-day attendance rate, and join date for a
 * member. Shared by the kiosk (app/page.tsx) and the public status board
 * (app/status/page.tsx), which previously duplicated this logic.
 */
export async function fetchProfileStats(profileId: string): Promise<ProfileStats> {
  const { data: profData } = await supabase
    .from('profiles')
    .select('created_at, tier')
    .eq('id', profileId)
    .single();

  const joinedAt = profData?.created_at
    ? new Date(profData.created_at).toLocaleDateString('ko-KR')
    : '정보 없음';
  const tier = profData?.tier || '준회원';

  const { data: blackMatches } = await supabase
    .from('matches')
    .select('winner')
    .eq('phase', '종료')
    .contains('black_team', [profileId]);
  const { data: whiteMatches } = await supabase
    .from('matches')
    .select('winner')
    .eq('phase', '종료')
    .contains('white_team', [profileId]);

  let wins = 0;
  let losses = 0;
  blackMatches?.forEach((m) => {
    if (m.winner === '흑승') wins++;
    else if (m.winner === '백승') losses++;
  });
  whiteMatches?.forEach((m) => {
    if (m.winner === '백승') wins++;
    else if (m.winner === '흑승') losses++;
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: attData } = await supabase
    .from('attendance')
    .select('checked_in_at')
    .eq('user_id', profileId)
    .gte('checked_in_at', thirtyDaysAgo.toISOString());

  const uniqueDays = new Set(
    attData?.map((a) => new Date(a.checked_in_at).toLocaleDateString())
  ).size;
  const attendanceRate = Math.round((uniqueDays / 30) * 100);

  return { wins, losses, attendanceRate, joinedAt, tier };
}
