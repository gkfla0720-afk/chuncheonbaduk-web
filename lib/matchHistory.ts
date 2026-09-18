import { supabase } from './supabase';
import { KifuMove } from '../types';

export interface MatchHistoryEntry {
  id: number;
  startedAt: string;
  matchType: string;
  handicap: string;
  side: 'black' | 'white';
  result: '승' | '패' | '무효';
  opponentNames: string[];
  kifu: KifuMove[];
  boardSize: number;
  // 계가(집 세기)로 종료된 대국만 값이 채워진다. 수동으로 흑승/백승만 눌러 끝난 대국은 null.
  blackScore: number | null;
  whiteScore: number | null;
}

/**
 * 한 회원의 종료/취소된 과거 대국 기록을 최신순으로 가져온다. 실시간 기보 중계로
 * matches.kifu에 저장된 기보가 대국 종료 후에도 그대로 남아 있으므로, 별도 아카이빙
 * 없이 이 기록에서 바로 다시 볼 수 있다.
 */
export async function fetchProfileMatchHistory(profileId: string, limit = 15): Promise<MatchHistoryEntry[]> {
  const [{ data: asBlack }, { data: asWhite }] = await Promise.all([
    supabase.from('matches').select('*').in('phase', ['종료', '취소']).contains('black_team', [profileId]).order('started_at', { ascending: false }).limit(limit),
    supabase.from('matches').select('*').in('phase', ['종료', '취소']).contains('white_team', [profileId]).order('started_at', { ascending: false }).limit(limit),
  ]);

  const rows = [...(asBlack || []), ...(asWhite || [])]
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, limit);

  const opponentIds = Array.from(new Set(rows.flatMap(m => [...m.black_team, ...m.white_team]).filter(id => id !== profileId)));
  const { data: opponentProfiles } = opponentIds.length > 0
    ? await supabase.from('profiles').select('id, name').in('id', opponentIds)
    : { data: [] as { id: string; name: string }[] };

  return rows.map((m) => {
    const side: 'black' | 'white' = m.black_team.includes(profileId) ? 'black' : 'white';
    const opponentIdsForMatch = side === 'black' ? m.white_team : m.black_team;
    const opponentNames = opponentIdsForMatch.map(id => opponentProfiles?.find(p => p.id === id)?.name || '알 수 없음');

    let result: MatchHistoryEntry['result'] = '무효';
    if (m.winner === '흑승') result = side === 'black' ? '승' : '패';
    else if (m.winner === '백승') result = side === 'white' ? '승' : '패';

    return {
      id: m.id,
      startedAt: m.started_at,
      matchType: m.match_type,
      handicap: m.handicap,
      side,
      result,
      opponentNames,
      kifu: (m.kifu as unknown as KifuMove[]) || [],
      boardSize: m.board_size,
      blackScore: m.black_score,
      whiteScore: m.white_score,
    };
  });
}
