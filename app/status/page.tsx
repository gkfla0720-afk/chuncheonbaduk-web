'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Match {
  id: number;
  phase: string;
  started_at: string;
  player1: { name: string; rank: string };
  player2: { name: string; rank: string };
}

export default function StatusPage() {
  const [activeCount, setActiveCount] = useState(0);
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 💡 해결: fetchData 함수를 useEffect 안으로 이동하여 렌더링 경고를 없앰
    const fetchData = async () => {
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .neq('status', '귀가');

      const { data: matchesData, error } = await supabase
        .from('matches')
        .select(`
          id, phase, started_at,
          player1:player1_id(name, rank),
          player2:player2_id(name, rank)
        `)
        .neq('phase', '종료')
        .order('started_at', { ascending: false });

      if (isMounted) {
        setActiveCount(count || 0);
        if (!error && matchesData) {
          // @ts-expect-error: 외래키 조인(Join)에 의한 복잡한 타입 추론 무시
          setActiveMatches(matchesData);
        }
        setIsLoading(false);
      }
    };

    fetchData();

    const channel = supabase
      .channel('public_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []); // 의존성 배열을 비워 깔끔하게 최적화

  const getPhaseBadge = (phase: string) => {
    switch (phase) {
      case '초반': return 'bg-blue-100 text-blue-700';
      case '중반': return 'bg-amber-100 text-amber-700';
      case '종반': return 'bg-orange-100 text-orange-700';
      case '끝내기': return 'bg-red-100 text-red-700 animate-pulse';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 select-none pb-12">
      <header className="py-6 text-center">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">춘천기원 라이브 📡</h1>
        <p className="text-slate-500 text-sm mt-1">스마트폰으로 보는 실시간 기원 현황</p>
      </header>

      <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mb-6 text-center">
        <h2 className="text-slate-500 font-bold text-sm mb-2">현재 기원에 계신 분</h2>
        {isLoading ? (
          <div className="text-4xl font-extrabold text-slate-300 animate-pulse">...</div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <span className="text-6xl font-extrabold text-[#9a5b28]">{activeCount}</span>
            <span className="text-2xl font-bold text-slate-600 mt-4">명</span>
          </div>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            🔥 진행 중인 대국
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </h3>
        </div>

        {isLoading ? (
          <p className="text-center text-slate-400 mt-10">대국 정보를 불러오는 중...</p>
        ) : activeMatches.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 border-dashed">
            <p className="text-slate-400 font-medium">현재 진행 중인 대국이 없습니다.<br/>방문하셔서 첫 대국의 주인공이 되어보세요!</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {activeMatches.map((match) => (
              <li key={match.id} className="bg-white p-5 rounded-2xl shadow-md border border-slate-200 relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPhaseBadge(match.phase)}`}>
                    {match.phase} 진행중
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-bold mb-3">
                  {new Date(match.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 시작
                </p>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-xl font-extrabold text-slate-800">{match.player1?.name}</span>
                    <span className="text-sm font-bold text-slate-500 mt-1">{match.player1?.rank}</span>
                  </div>
                  <div className="text-2xl font-black text-slate-300 italic px-4">VS</div>
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-xl font-extrabold text-slate-800">{match.player2?.name}</span>
                    <span className="text-sm font-bold text-slate-500 mt-1">{match.player2?.rank}</span>
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