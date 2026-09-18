'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchProfileStats } from '@/lib/profileStats';
import { fetchProfileMatchHistory, MatchHistoryEntry } from '@/lib/matchHistory';
import { formatKoreanTime } from '@/lib/formatTime';
import { Profile, Match as BaseMatch, KifuMove } from '../../types';
import GoBoard from '../../components/GoBoard';
import ProfileDetailModal from '../../components/modals/ProfileDetailModal';

interface Match extends BaseMatch {
  blackProfiles?: Profile[];
  whiteProfiles?: Profile[];
}

export default function StatusPage() {
  const [activeCount, setActiveCount] = useState(0);
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCooldown, setIsCooldown] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [newMatchAlert, setNewMatchAlert] = useState(false);

  // 💡 프로필 팝업 추가됨
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profileStats, setProfileStats] = useState({ wins: 0, losses: 0, attendanceRate: 0, joinedAt: '', tier: '' });
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 대국 카드를 클릭하면 상세 정보(중계 중이면 실시간 기보 포함)를 큰 팝업으로 표시
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const fetchData = useCallback(async (showNotification = false) => {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('current_status', '오프라인');
    const { data: matchesData } = await supabase.from('matches').select('*').eq('phase', '진행중').order('started_at', { ascending: false });
    
    let enrichedMatches: Match[] = [];
    if (matchesData && matchesData.length > 0) {
      const allPlayerIds = matchesData.flatMap(m => [...m.black_team, ...m.white_team]);
      const { data: profiles } = await supabase.from('profiles').select('id, name, rank, tier').in('id', allPlayerIds);
      
      enrichedMatches = matchesData.map(m => ({
        ...m,
        blackProfiles: m.black_team.map((id: string) => profiles?.find(p => p.id === id)).filter(Boolean) as Profile[],
        whiteProfiles: m.white_team.map((id: string) => profiles?.find(p => p.id === id)).filter(Boolean) as Profile[],
      }));
    }

    // 실시간 중계 중인 대국(있다면 1개)을 관전자 관심도가 가장 높은 최상단에 노출한다.
    enrichedMatches.sort((a, b) => (b.is_streaming ? 1 : 0) - (a.is_streaming ? 1 : 0));

    setActiveCount(count || 0);
    setActiveMatches(prevMatches => {
      if (showNotification && prevMatches.length > 0 && enrichedMatches.length > prevMatches.length) {
        setNewMatchAlert(true); setTimeout(() => setNewMatchAlert(false), 5000);
      }
      return enrichedMatches;
    });
    // 팝업이 열려 있는 대국의 기보도 실시간으로 갱신되도록 함께 최신화한다.
    setSelectedMatch(prev => (prev ? enrichedMatches.find(m => m.id === prev.id) || prev : prev));
    setLastUpdated(new Date()); setIsLoading(false);
  }, []);

  useEffect(() => {
    const loadInit = async () => { await fetchData(false); }; loadInit();

    // 30초 주기 폴링은 실시간 채널이 끊기거나 이벤트를 놓친 경우를 대비한 안전망입니다.
    const timer = setInterval(() => { const loadPoll = async () => { await fetchData(true); }; loadPoll(); }, 30000);

    // matches/profiles 테이블 변경을 즉시 반영하는 실시간 구독
    const channel = supabase
      .channel('status-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => { fetchData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { fetchData(false); })
      .subscribe();

    return () => { clearInterval(timer); supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleRefresh = () => {
    if (isCooldown) return;
    setIsCooldown(true); fetchData(true); setTimeout(() => setIsCooldown(false), 10000);
  };

  // 💡 스마트폰에서 프로필을 터치하면 상세 전적이 열리는 로직
  const openProfileDetail = async (profile: Profile) => {
    setSelectedProfile(profile);
    setIsLoadingStats(true);
    setIsLoadingHistory(true);
    try {
      const [stats, history] = await Promise.all([fetchProfileStats(profile.id), fetchProfileMatchHistory(profile.id)]);
      setProfileStats(stats);
      setMatchHistory(history);
    } catch (err) {
      console.error(err);
    }
    setIsLoadingStats(false);
    setIsLoadingHistory(false);
  };

  return (
    <main className="min-h-screen text-stone-800 font-sans select-none relative board-surface">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {newMatchAlert && (
          <div className="fixed top-4 left-0 right-0 z-50 flex justify-center animate-bounce pointer-events-none">
            <div className="bg-[#8a5a2b] text-white px-5 py-3 rounded-full font-bold text-xl shadow-xl border border-[#704522]">
              새로운 대국이 시작되었습니다.
            </div>
          </div>
        )}

        <header className="mb-6 rounded-[28px] border border-[#d6c4a4] bg-[#f9f4ea]/90 px-5 py-5 shadow-[0_12px_30px_rgba(10,8,7,0.25)] sm:px-7 backdrop-blur-[1px]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[20px] font-semibold uppercase tracking-[0.25em] text-[#8b6d4a]">춘천기원 LIVE</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-[#2a241d] sm:text-5xl drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]">기원 현황</h1>
            </div>
            <div className="flex items-center gap-3 text-[20px] text-stone-500 sm:text-xl">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
              <span className="text-[20px] sm:text-xl">마지막 업데이트: {formatKoreanTime(lastUpdated, { showSeconds: true })}</span>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-[20px] leading-7 text-stone-600 sm:text-xl">
              춘천에서 바둑을 사랑하는 바둑인들이 모인 공간입니다. 춘천기원의 바둑 열기를 느껴보세요.
            </p>
            <button
              onClick={handleRefresh}
              disabled={isCooldown}
              className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-[20px] font-semibold shadow-sm transition-all ${isCooldown ? 'cursor-not-allowed bg-stone-200 text-stone-400' : 'bg-[#2a241d] text-[#f8f3eb] hover:bg-[#1f1b18]'}`}
            >
              {isCooldown ? '잠시만 기다려 주세요...' : '새로고침'}
            </button>
          </div>
        </header>

        <section className="mt-6 rounded-[32px] border border-[#d8c7a8] bg-[#f5efe6]/95 p-5 shadow-[0_14px_30px_rgba(10,8,7,0.22)] sm:p-6 backdrop-blur-[1px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[20px] font-bold tracking-[0.18em] text-[#7e5d3d]">춘천기원 LIVE</p>
              <h2 className="mt-2 text-[2rem] font-black text-[#2a241d] sm:text-[2.4rem]">오늘의 참여 인원</h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#cdb48b] bg-[#f7f3ec] px-3 py-1 text-xl font-semibold text-[#6d553f]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              실시간 현황
            </div>
          </div>

          {isLoading ? (
            <div className="mt-6 text-4xl font-black text-[#c7b09a] animate-pulse">...</div>
          ) : (
            <div className="mt-5 flex items-end justify-center gap-2">
              <span className="text-[4.5rem] font-black leading-none text-[#2a241d] sm:text-[5.5rem]">{activeCount}</span>
              <span className="pb-3 text-[1.35rem] font-bold text-stone-600 sm:text-[1.6rem]">명</span>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[28px] border border-[#d7c7a8] bg-[#f7f1e7]/95 p-4 shadow-[0_12px_26px_rgba(10,8,7,0.16)] sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[1.8rem] font-black text-[#2a241d] sm:text-[2.5rem]">진행 중인 대국 현황</h3>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d0b38c] bg-[#f6efe6] px-3 py-1 text-[20px] font-semibold text-[#6d553f] sm:text-xl">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9f6838] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#9f6838]" />
              </span>
              Live
            </span>
          </div>

          {isLoading ? (
            <p className="mt-8 text-center text-xl font-medium text-stone-500">대국 정보를 불러오는 중입니다.</p>
          ) : activeMatches.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[#cfb895] bg-[#faf7f2] px-5 py-10 text-center shadow-inner">
              <p className="text-xl font-semibold text-stone-600">현재 진행 중인 대국이 없습니다.</p>
              <p className="mt-2 text-xl text-stone-500">마지막 대국이 끝난 뒤 다음 대국을 기다리고 있습니다.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {activeMatches.map((match) => (
                <li
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className={`cursor-pointer rounded-[28px] border bg-[#faf5ee] p-4 shadow-[0_12px_24px_rgba(90,69,45,0.06)] transition hover:brightness-105 sm:p-5 ${match.is_streaming ? 'border-2 border-red-400' : 'border-[#d7c7a8]'}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-[#cab38b] bg-[#fffaf2] px-3 py-1.5 text-[20px] font-black tracking-[0.15em] text-[#7f6348] sm:text-[20px]">{match.match_type}</span>
                      {match.is_streaming && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-[20px] font-black text-white animate-pulse">🔴 LIVE 중계</span>
                      )}
                      <p className="text-[20px] font-bold text-stone-500 sm:text-[20px]">
                        {formatKoreanTime(new Date(match.started_at))} 시작
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#efe2c7] px-3 py-1.5 text-[20px] font-black text-[#725739] sm:text-[20px]">{match.handicap}</span>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-[#d5c3a4] bg-[linear-gradient(90deg,#1d1b19_0%,#1d1b19_49.5%,#f9f6f2_49.5%,#f9f6f2_100%)] p-3 shadow-inner sm:p-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                      <div className="min-w-0 flex flex-col gap-2">
                        {match.blackProfiles?.map(p => (
                          <button
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); openProfileDetail(p); }}
                            className="w-full rounded-2xl border border-[#322c28] bg-[#1d1b19] px-3 py-2.5 text-left text-white shadow-sm transition hover:brightness-110"
                          >
                            <span className="block text-[1.8rem] font-black leading-tight whitespace-nowrap overflow-hidden text-ellipsis sm:text-[2rem]">{p.name}</span>
                            <span className="block text-[2.2rem] font-black text-stone-300 whitespace-nowrap sm:text-[2.5rem]">{p.rank}</span>
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-center px-1 sm:px-2">
                        <span className="text-[2.1rem] font-black tracking-[0.2em] text-[#7a6348] sm:text-[2.4rem]">VS</span>
                      </div>

                      <div className="min-w-0 flex flex-col gap-2">
                        {match.whiteProfiles?.map(p => (
                          <button
                            key={p.id}
                            onClick={(e) => { e.stopPropagation(); openProfileDetail(p); }}
                            className="w-full rounded-2xl border border-[#d7d0c7] bg-[#f9f5f1] px-3 py-2.5 text-left text-stone-800 shadow-sm transition hover:bg-[#f1ece6]"
                          >
                            <span className="block text-[1.8rem] font-black leading-tight whitespace-nowrap overflow-hidden text-ellipsis sm:text-[2rem]">{p.name}</span>
                            <span className="block text-[2.2rem] font-black text-stone-500 whitespace-nowrap sm:text-[2.5rem]">{p.rank}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selectedProfile && (
          <ProfileDetailModal
            profile={selectedProfile}
            stats={profileStats}
            isLoadingStats={isLoadingStats}
            matchHistory={matchHistory}
            isLoadingHistory={isLoadingHistory}
            onClose={() => setSelectedProfile(null)}
          />
        )}

        {selectedMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,24,20,0.6)] p-4 backdrop-blur-sm" onClick={() => setSelectedMatch(null)}>
            {selectedMatch.is_streaming ? (
              // 태블릿의 '실시간 기보 중계 화면'과 동일한 디자인(짙은 배경/금색 테두리)을 사용하되,
              // 외부 관전자는 바둑판이나 대국을 조작할 수 없도록 클릭 가능한 버튼을 전혀 두지 않는다.
              // 닫기는 다른 팝업들과 동일하게 바깥(배경)을 탭하면 처리된다.
              <div
                className="relative w-full h-[94vh] max-w-[1500px] bg-[#1f1a16] text-white rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.4)] border-4 border-[#b88c42] overflow-hidden flex flex-col lg:flex-row"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-[#120f0d] p-4 lg:p-8 gap-4">
                  <p className="flex items-center gap-2 text-xl font-black text-stone-300">
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xl font-black text-white animate-pulse">🔴 LIVE</span>
                    {((selectedMatch.kifu as unknown as KifuMove[]) || []).length}수 진행 중 · 실시간으로 업데이트됩니다.
                  </p>
                  <div className="h-full max-h-full w-full rounded-2xl overflow-hidden">
                    <GoBoard size={selectedMatch.board_size} moves={(selectedMatch.kifu as unknown as KifuMove[]) || []} />
                  </div>
                </div>
                <div className="w-full lg:w-[400px] shrink-0 border-t-2 lg:border-t-0 lg:border-l-2 border-stone-800 p-6 flex flex-col gap-4 overflow-y-auto">
                  <p className="text-xl font-black text-[#dcb36c] flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-lg font-black text-white animate-pulse">LIVE</span>
                    실시간 기보 중계
                  </p>
                  <div className="rounded-2xl border border-stone-700 bg-[#120f0d] p-4">
                    <p className="text-xl font-extrabold text-[#dcb36c]">{selectedMatch.match_type} / {selectedMatch.handicap}</p>
                    <p className="text-lg font-bold text-stone-400 mt-1">{formatKoreanTime(new Date(selectedMatch.started_at))} 시작</p>
                  </div>
                  <div className="rounded-2xl border border-stone-700 bg-[linear-gradient(90deg,#0f0d0c_0%,#0f0d0c_49.5%,#f9f6f2_49.5%,#f9f6f2_100%)] p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <div className="min-w-0 text-left">
                        {selectedMatch.blackProfiles?.map(p => (
                          <div key={p.id}>
                            <p className="text-xl font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                            <p className="text-lg font-bold text-stone-400">{p.rank}</p>
                          </div>
                        ))}
                      </div>
                      <span className="text-lg font-black tracking-[0.2em] text-[#dcb36c]">VS</span>
                      <div className="min-w-0 text-right">
                        {selectedMatch.whiteProfiles?.map(p => (
                          <div key={p.id}>
                            <p className="text-xl font-black text-stone-900 whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                            <p className="text-lg font-bold text-stone-600">{p.rank}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="w-full max-w-2xl rounded-[30px] border border-[#d4c3a2] bg-[#f8f4ee] shadow-[0_18px_45px_rgba(34,27,20,0.32)] p-5 sm:p-7"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-xl font-bold tracking-[0.18em] text-[#7e5d3d]">대국 정보</p>
                    <h2 className="mt-2 text-2xl font-black text-[#2a241d]">{selectedMatch.match_type} · {selectedMatch.handicap}</h2>
                    <p className="mt-1 text-xl text-stone-500">{formatKoreanTime(new Date(selectedMatch.started_at))} 시작</p>
                  </div>
                  <button onClick={() => setSelectedMatch(null)} className="shrink-0 rounded-full bg-stone-200 px-3 py-1 text-xl font-bold text-stone-700">닫기</button>
                </div>

                <div className="mt-5 rounded-[24px] border border-[#d9cab0] bg-[#1d1b19] p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                    <div className="min-w-0 flex flex-col gap-1 text-left">
                      {selectedMatch.blackProfiles?.map(p => (
                        <div key={p.id}>
                          <p className="text-2xl font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                          <p className="text-xl font-bold text-stone-400">{p.rank}</p>
                        </div>
                      ))}
                    </div>
                    <span className="text-2xl font-black tracking-[0.2em] text-[#dcb36c]">VS</span>
                    <div className="min-w-0 flex flex-col gap-1 text-right">
                      {selectedMatch.whiteProfiles?.map(p => (
                        <div key={p.id}>
                          <p className="text-2xl font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                          <p className="text-xl font-bold text-stone-300">{p.rank}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="mt-5 text-center text-xl text-stone-500">이 대국은 현재 실시간 기보 중계 대상이 아닙니다.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}