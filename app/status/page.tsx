'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchProfileStats } from '@/lib/profileStats';
import { Profile, Match as BaseMatch } from '../../types';

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

    setActiveCount(count || 0);
    setActiveMatches(prevMatches => {
      if (showNotification && prevMatches.length > 0 && enrichedMatches.length > prevMatches.length) {
        setNewMatchAlert(true); setTimeout(() => setNewMatchAlert(false), 5000);
      }
      return enrichedMatches;
    });
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
    try {
      const stats = await fetchProfileStats(profile.id);
      setProfileStats(stats);
    } catch (err) {
      console.error(err);
    }
    setIsLoadingStats(false);
  };

  return (
    <main className="min-h-screen text-stone-800 font-sans select-none relative board-surface">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {newMatchAlert && (
          <div className="fixed top-4 left-0 right-0 z-50 flex justify-center animate-bounce pointer-events-none">
            <div className="bg-[#8a5a2b] text-white px-5 py-3 rounded-full font-bold text-sm shadow-xl border border-[#704522]">
              새로운 대국이 시작되었습니다.
            </div>
          </div>
        )}

        <header className="mb-6 rounded-[28px] border border-[#d6c4a4] bg-[#f9f4ea]/90 px-5 py-5 shadow-[0_12px_30px_rgba(10,8,7,0.25)] sm:px-7 backdrop-blur-[1px]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#8b6d4a]">춘천기원 LIVE</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-[#2a241d] sm:text-5xl drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]">기원 현황</h1>
            </div>
            <div className="flex items-center gap-3 text-[15px] text-stone-500 sm:text-base">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
              <span className="text-[15px] sm:text-base">마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-[15px] leading-7 text-stone-600 sm:text-base">
              춘천에서 바둑을 사랑하는 바둑인들이 모인 공간입니다. 춘천기원의 바둑 열기를 느껴보세요.
            </p>
            <button
              onClick={handleRefresh}
              disabled={isCooldown}
              className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-[15px] font-semibold shadow-sm transition-all ${isCooldown ? 'cursor-not-allowed bg-stone-200 text-stone-400' : 'bg-[#2a241d] text-[#f8f3eb] hover:bg-[#1f1b18]'}`}
            >
              {isCooldown ? '잠시만 기다려 주세요...' : '새로고침'}
            </button>
          </div>
        </header>

        <section className="mt-6 rounded-[32px] border border-[#d8c7a8] bg-[#f5efe6]/95 p-5 shadow-[0_14px_30px_rgba(10,8,7,0.22)] sm:p-6 backdrop-blur-[1px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#7e5d3d]">춘천기원 LIVE</p>
              <h2 className="mt-2 text-[2rem] font-black text-[#2a241d] sm:text-[2.4rem]">오늘의 참여 인원</h2>
            </div>
            <div className="rounded-full border border-[#cdb48b] bg-[#f7f3ec] px-3 py-1 text-xs font-semibold text-[#6d553f]">
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
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d0b38c] bg-[#f6efe6] px-3 py-1 text-[13px] font-semibold text-[#6d553f] sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-[#9f6838]" />
              Live
            </span>
          </div>

          {isLoading ? (
            <p className="mt-8 text-center text-base font-medium text-stone-500">대국 정보를 불러오는 중입니다.</p>
          ) : activeMatches.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[#cfb895] bg-[#faf7f2] px-5 py-10 text-center shadow-inner">
              <p className="text-lg font-semibold text-stone-600">현재 진행 중인 대국이 없습니다.</p>
              <p className="mt-2 text-sm text-stone-500">마지막 대국이 끝난 뒤 다음 대국을 기다리고 있습니다.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {activeMatches.map((match) => (
                <li key={match.id} className="rounded-[28px] border border-[#d7c7a8] bg-[#faf5ee] p-4 shadow-[0_12px_24px_rgba(90,69,45,0.06)] sm:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-[#cab38b] bg-[#fffaf2] px-3 py-1.5 text-[18px] font-black tracking-[0.15em] text-[#7f6348] sm:text-[20px]">{match.match_type}</span>
                      <p className="text-[18px] font-bold text-stone-500 sm:text-[20px]">
                        {new Date(match.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 시작
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#efe2c7] px-3 py-1.5 text-[18px] font-black text-[#725739] sm:text-[20px]">{match.handicap}</span>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-[#d5c3a4] bg-[linear-gradient(90deg,#1d1b19_0%,#1d1b19_49.5%,#f9f6f2_49.5%,#f9f6f2_100%)] p-3 shadow-inner sm:p-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                      <div className="min-w-0 flex flex-col gap-2">
                        {match.blackProfiles?.map(p => (
                          <button
                            key={p.id}
                            onClick={() => openProfileDetail(p)}
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
                            onClick={() => openProfileDetail(p)}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,24,20,0.55)] p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-[30px] border border-[#d4c3a2] bg-[#f8f4ee] p-5 shadow-[0_18px_45px_rgba(34,27,20,0.28)] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-[0.18em] text-[#7e5d3d]">프로필</p>
                  <h2 className="mt-2 text-2xl font-black text-[#2a241d]">{selectedProfile.name}</h2>
                </div>
                <button onClick={() => setSelectedProfile(null)} className="rounded-full bg-stone-200 px-3 py-1 text-xs font-bold text-stone-700">닫기</button>
              </div>

              <div className="mt-5 rounded-[24px] border border-[#d9cab0] bg-[#f3ebdf] p-4">
                <p className="text-sm text-stone-500">가입일: {profileStats.joinedAt}</p>
                <p className="mt-3 text-2xl font-black text-[#8a5a2b]">{selectedProfile.rank} / {profileStats.tier}</p>

                {isLoadingStats ? (
                  <p className="mt-5 text-sm font-medium text-stone-500">전적을 정리하고 있습니다.</p>
                ) : (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white p-3 shadow-sm border border-[#e6dcc8]">
                      <p className="text-xs font-bold tracking-[0.14em] text-stone-500">전적</p>
                      <p className="mt-2 text-xl font-black text-[#2a241d]">
                        <span className="text-[#2a5fba]">{profileStats.wins}승</span>
                        <span className="mx-1 text-stone-400">·</span>
                        <span className="text-[#b54d3a]">{profileStats.losses}패</span>
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white p-3 shadow-sm border border-[#e6dcc8]">
                      <p className="text-xs font-bold tracking-[0.14em] text-stone-500">출석률</p>
                      <p className="mt-2 text-2xl font-black text-[#8a5a2b]">{profileStats.attendanceRate}%</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}