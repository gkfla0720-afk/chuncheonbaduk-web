'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Profile { id: string; name: string; rank: string; }
interface Match { id: number; phase: string; started_at: string; match_type: string; handicap: string; black_team: string[]; white_team: string[]; blackProfiles?: Profile[]; whiteProfiles?: Profile[]; }

export default function StatusPage() {
  const [activeCount, setActiveCount] = useState(0);
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCooldown, setIsCooldown] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [newMatchAlert, setNewMatchAlert] = useState(false);

  const fetchData = useCallback(async (showNotification = false) => {
    const { count } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).neq('status', '귀가');
    
    // 💡 핵심 수정: '종료'뿐만 아니라 '취소'된 대국도 화면에서 제외하도록 수정했습니다.
    const { data: matchesData } = await supabase.from('matches')
      .select('*')
      .neq('phase', '종료')
      .neq('phase', '취소')
      .order('started_at', { ascending: false });
    
    let enrichedMatches: Match[] = [];
    if (matchesData && matchesData.length > 0) {
      const allPlayerIds = matchesData.flatMap(m => [...m.black_team, ...m.white_team]);
      const { data: profiles } = await supabase.from('profiles').select('id, name, rank').in('id', allPlayerIds);
      
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 select-none pb-12 relative">
      {newMatchAlert && (
        <div className="fixed top-6 left-0 right-0 z-50 flex justify-center animate-bounce">
          <div className="bg-amber-500 text-white px-8 py-4 rounded-full font-bold text-xl shadow-2xl flex items-center gap-3">
            <span>🔥 새로운 대국이 시작되었습니다!</span>
          </div>
        </div>
      )}

      <header className="py-8 flex flex-col items-center relative">
        <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">춘천기원 라이브 📡</h1>
        <p className="text-slate-500 text-lg mt-2 font-bold">
          업데이트: {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <button onClick={handleRefresh} disabled={isCooldown} className={`mt-4 px-6 py-3 rounded-2xl font-bold text-lg shadow-md transition-all ${isCooldown ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-white border-2 border-slate-300 text-slate-800 hover:bg-slate-100 active:scale-95'}`}>
          {isCooldown ? '대기중...' : '🔄 새로고침 (10초)'}
        </button>
      </header>

      <section className="bg-white rounded-4xl shadow-md border-2 border-slate-200 p-8 mb-8 text-center">
        <h2 className="text-slate-500 font-extrabold text-2xl mb-4">현재 기원에 계신 분</h2>
        {isLoading ? (
          <div className="text-6xl font-extrabold text-slate-300 animate-pulse">...</div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <span className="text-8xl font-black text-[#9a5b28]">{activeCount}</span>
            <span className="text-4xl font-extrabold text-slate-600 mt-6">명</span>
          </div>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-6 px-4">
          <h3 className="font-extrabold text-2xl text-slate-800 flex items-center gap-3">
            🔥 진행 중인 대국 현황
            <span className="flex h-5 w-5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500"></span>
            </span>
          </h3>
        </div>

        {isLoading ? (
          <p className="text-center text-slate-400 text-xl font-bold mt-10">대국 정보를 불러오는 중...</p>
        ) : activeMatches.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-4xl border-2 border-slate-200 border-dashed">
            <p className="text-slate-500 text-xl font-bold leading-relaxed">현재 진행 중인 대국이 없습니다.<br/>방문하셔서 첫 대국을 시작해보세요!</p>
          </div>
        ) : (
          <ul className="space-y-6">
            {activeMatches.map((match) => (
              <li key={match.id} className="bg-white p-6 rounded-4xl shadow-lg border-2 border-slate-200 relative overflow-hidden">
                <div className="absolute top-5 right-5">
                  <span className="px-4 py-2 rounded-full text-sm font-black bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">{match.match_type}</span>
                </div>
                
                <p className="text-base text-slate-500 font-extrabold mb-5">
                  {new Date(match.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 시작
                  <span className="ml-3 text-red-500">{match.handicap}</span>
                </p>

                <div className="flex justify-between items-stretch mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <div className="flex flex-col items-center flex-1 justify-center gap-2">
                    {match.blackProfiles?.map(p => (
                      <div key={p.id} className="text-center bg-slate-800 text-white w-full py-2 rounded-xl shadow-md">
                        <span className="text-2xl font-black">{p.name}</span> <span className="text-lg text-slate-300">{p.rank}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center px-6">
                    <span className="text-3xl font-black text-slate-400 italic">VS</span>
                  </div>
                  <div className="flex flex-col items-center flex-1 justify-center gap-2">
                    {match.whiteProfiles?.map(p => (
                      <div key={p.id} className="text-center bg-white border-2 border-slate-300 text-slate-800 w-full py-2 rounded-xl shadow-md">
                        <span className="text-2xl font-black">{p.name}</span> <span className="text-lg text-slate-500">{p.rank}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}