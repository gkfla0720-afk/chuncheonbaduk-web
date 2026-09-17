'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
    const { data: matchesData } = await supabase.from('matches').select('*').neq('phase', '종료').neq('phase', '취소').order('started_at', { ascending: false });
    
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
    const timer = setInterval(() => { const loadPoll = async () => { await fetchData(true); }; loadPoll(); }, 30000);
    return () => clearInterval(timer);
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
      const { data: profData } = await supabase.from('profiles').select('created_at, tier').eq('id', profile.id).single();
      const joinedAt = profData?.created_at ? new Date(profData.created_at).toLocaleDateString('ko-KR') : '정보 없음';
      const tier = profData?.tier || '준회원';

      const { data: blackMatches } = await supabase.from('matches').select('winner').eq('phase', '종료').contains('black_team', [profile.id]);
      const { data: whiteMatches } = await supabase.from('matches').select('winner').eq('phase', '종료').contains('white_team', [profile.id]);
      
      let w = 0, l = 0;
      blackMatches?.forEach(m => { if (m.winner === '흑승') w++; else if (m.winner === '백승') l++; });
      whiteMatches?.forEach(m => { if (m.winner === '백승') w++; else if (m.winner === '흑승') l++; });

      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: attData } = await supabase.from('attendance').select('checked_in_at').eq('user_id', profile.id).gte('checked_in_at', thirtyDaysAgo.toISOString());
      
      const uniqueDays = new Set(attData?.map(a => new Date(a.checked_in_at).toLocaleDateString())).size;
      const attRate = Math.round((uniqueDays / 30) * 100);

      setProfileStats({ wins: w, losses: l, attendanceRate: attRate, joinedAt, tier });
    } catch (err) { console.error(err); }
    setIsLoadingStats(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 select-none pb-16 relative">
      {newMatchAlert && (
        <div className="fixed top-6 left-0 right-0 z-50 flex justify-center animate-bounce">
          <div className="bg-amber-500 text-white px-10 py-6 rounded-full font-bold text-3xl shadow-2xl flex items-center gap-3">
            <span>🔥 새로운 대국이 시작되었습니다!</span>
          </div>
        </div>
      )}

      {/* 💡 초대형 헤더 영역 */}
      <header className="py-10 flex flex-col items-center relative mb-8">
        <h1 className="text-6xl sm:text-7xl font-extrabold text-slate-800 tracking-tight">춘천기원 라이브 📡</h1>
        <p className="text-slate-500 text-2xl sm:text-3xl mt-4 font-bold">
          업데이트: {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <button onClick={handleRefresh} disabled={isCooldown} className={`mt-8 px-10 py-5 rounded-3xl font-bold text-3xl sm:text-4xl shadow-xl transition-all ${isCooldown ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-white border-4 border-slate-300 text-slate-800 hover:bg-slate-100 active:scale-95'}`}>
          {isCooldown ? '대기중...' : '🔄 새로고침 (10초)'}
        </button>
      </header>

      {/* 💡 초대형 인원 현황 영역 */}
      <section className="bg-white rounded-[3rem] shadow-xl border-4 border-slate-200 p-12 mb-12 text-center">
        <h2 className="text-slate-500 font-extrabold text-4xl sm:text-5xl mb-6">현재 기원에 계신 분</h2>
        {isLoading ? (
          <div className="text-7xl font-extrabold text-slate-300 animate-pulse">...</div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <span className="text-[10rem] sm:text-[12rem] font-black text-[#9a5b28] leading-none">{activeCount}</span>
            <span className="text-6xl sm:text-7xl font-extrabold text-slate-600 mt-12">명</span>
          </div>
        )}
      </section>

      {/* 💡 초대형 진행 중인 대국 영역 */}
      <section>
        <div className="flex justify-between items-center mb-8 px-4">
          <h3 className="font-extrabold text-4xl sm:text-5xl text-slate-800 flex items-center gap-4">
            🔥 진행 중인 대국 현황
            <span className="flex h-8 w-8 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-8 w-8 bg-red-500"></span>
            </span>
          </h3>
        </div>

        {isLoading ? (
          <p className="text-center text-slate-400 text-3xl font-bold mt-16">대국 정보를 불러오는 중...</p>
        ) : activeMatches.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[3rem] border-4 border-slate-200 border-dashed">
            <p className="text-slate-500 text-3xl font-bold leading-relaxed">현재 진행 중인 대국이 없습니다.<br/>방문하셔서 첫 대국을 시작해보세요!</p>
          </div>
        ) : (
          <ul className="space-y-8">
            {activeMatches.map((match) => (
              <li key={match.id} className="bg-white p-8 rounded-[3rem] shadow-2xl border-4 border-slate-200 relative overflow-hidden">
                <div className="absolute top-6 right-6">
                  <span className="px-6 py-3 rounded-full text-2xl font-black bg-blue-100 text-blue-800 border-2 border-blue-200 shadow-sm">{match.match_type}</span>
                </div>
                
                <p className="text-3xl text-slate-500 font-extrabold mb-8 mt-2">
                  {new Date(match.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 시작
                  <span className="ml-4 text-red-500 bg-red-50 px-3 py-1 rounded-xl">{match.handicap}</span>
                </p>

                <div className="flex justify-between items-stretch mt-4 bg-slate-50 rounded-[2.5rem] p-6 border-2 border-slate-200">
                  {/* 💡 흑팀 터치 시 오픈 */}
                  <div className="flex flex-col items-center flex-1 justify-center gap-4">
                    {match.blackProfiles?.map(p => (
                      <div key={p.id} onClick={() => openProfileDetail(p)} className="text-center bg-slate-800 text-white w-full py-4 rounded-2xl shadow-lg cursor-pointer hover:opacity-80 active:scale-95 transition-all">
                        <span className="text-4xl sm:text-5xl font-black">{p.name}</span> <span className="text-2xl sm:text-3xl text-slate-300 ml-2">{p.rank}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center px-8">
                    <span className="text-5xl font-black text-slate-400 italic">VS</span>
                  </div>
                  {/* 💡 백팀 터치 시 오픈 */}
                  <div className="flex flex-col items-center flex-1 justify-center gap-4">
                    {match.whiteProfiles?.map(p => (
                      <div key={p.id} onClick={() => openProfileDetail(p)} className="text-center bg-white border-4 border-slate-300 text-slate-800 w-full py-4 rounded-2xl shadow-lg cursor-pointer hover:bg-slate-100 active:scale-95 transition-all">
                        <span className="text-4xl sm:text-5xl font-black">{p.name}</span> <span className="text-2xl sm:text-3xl text-slate-500 ml-2">{p.rank}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 💡 초대형 모달 프로필 팝업 */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-10 shadow-2xl border-4 border-slate-300 relative text-center">
            <h2 className="text-4xl font-black text-slate-800 mb-2">회원 기력 및 프로필</h2>
            <p className="text-slate-500 font-bold mb-8 text-xl">가입일: {profileStats.joinedAt}</p>
            
            <div className="bg-slate-50 p-8 rounded-3xl mb-8 border-2 border-slate-200">
               <h3 className="text-6xl font-black text-slate-900 mb-4">{selectedProfile.name}</h3>
               <p className="text-4xl font-extrabold text-[#9a5b28] mb-8">{selectedProfile.rank} / {profileStats.tier}</p>
               
               {isLoadingStats ? (
                 <p className="text-slate-400 font-bold py-8 animate-pulse text-2xl">전적 데이터를 집계하는 중...</p>
               ) : (
                 <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm">
                       <p className="text-slate-500 text-xl font-bold mb-3">대국 통산 전적</p>
                       <p className="text-5xl font-black">
                         <span className="text-blue-500">{profileStats.wins}승</span> <span className="text-red-500">{profileStats.losses}패</span>
                       </p>
                       <p className="text-slate-400 text-xl font-bold mt-4">승률 {profileStats.wins + profileStats.losses > 0 ? Math.round((profileStats.wins / (profileStats.wins + profileStats.losses)) * 100) : 0}%</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm flex flex-col justify-center items-center">
                       <p className="text-slate-500 text-xl font-bold mb-3">최근 30일 출석률</p>
                       <p className="text-6xl font-black text-[#9a5b28]">{profileStats.attendanceRate}%</p>
                    </div>
                 </div>
               )}
            </div>
            <button onClick={() => setSelectedProfile(null)} className="w-full py-6 bg-slate-800 hover:bg-slate-700 text-white text-3xl font-black rounded-2xl shadow-xl transition-all">
              확인 (닫기)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}