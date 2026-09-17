'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ActiveMember {
  id: number;
  status: string;
  checked_in_at: string;
  profiles: {
    name: string;
    rank: string;
    tier: string;
  };
}

export default function StatusPage() {
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 💡 해결 1: 함수를 useEffect 안으로 이동하고, 화면이 켜져 있을 때만(isMounted) 데이터를 넣도록 보호합니다.
    let isMounted = true; 

    const fetchActiveMembers = async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          id,
          status,
          checked_in_at,
          profiles (
            name,
            rank,
            tier
          )
        `)
        .neq('status', '귀가')
        .order('checked_in_at', { ascending: false });

      if (error) {
        console.error('데이터를 불러오지 못했습니다:', error);
      } else if (isMounted) {
        // @ts-expect-error (초보자용 빠른 진행을 위해 복잡한 타입 체크 생략)
        setActiveMembers(data);
        setIsLoading(false);
      }
    };

    // 1. 페이지 접속 시 최초 데이터 불러오기
    fetchActiveMembers();

    // 2. 실시간 동기화 (Realtime) 설정
    const channel = supabase
      .channel('attendance_status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          fetchActiveMembers(); // 누군가 출석하면 함수 다시 실행
        }
      )
      .subscribe();

    // 컴포넌트가 화면에서 사라질 때 실행되는 정리(Cleanup) 코드
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []); // 의존성 배열이 빈칸([])이 되어 코드가 훨씬 깔끔해졌습니다.

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 select-none">
      <header className="py-6 text-center">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
          춘천기원 실시간 현황
        </h1>
        <p className="text-slate-500 text-sm mt-1">지금 방문하시면 바로 대국 가능합니다!</p>
      </header>

      <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-6 text-center">
        <h2 className="text-slate-500 font-medium text-sm mb-2">현재 기원에 계신 분</h2>
        {isLoading ? (
          <div className="text-4xl font-extrabold text-slate-300 animate-pulse">...</div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <span className="text-6xl font-extrabold text-amber-500">
              {activeMembers.length}
            </span>
            <span className="text-2xl font-bold text-slate-600 mt-4">명</span>
          </div>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="font-bold text-slate-700">출석 회원 목록</h3>
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        </div>

        {isLoading ? (
          <p className="text-center text-slate-400 mt-10">목록을 불러오는 중...</p>
        ) : activeMembers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 border-dashed">
            <p className="text-slate-400">현재 기원에 계신 분이 없습니다.<br/>가장 먼저 방문해 보세요!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {activeMembers.map((member) => (
              <li
                key={member.id}
                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-lg text-slate-800">
                    {member.profiles?.name}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {new Date(member.checked_in_at).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })} 도착
                  </span>
                </div>
                
                <div className="flex flex-col items-end gap-1">
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-bold rounded-lg">
                    {member.profiles?.rank}
                  </span>
                  {member.status === '대국중' && (
                    /* 💡 해결 2: py-[2px] 대신 py-0.5 사용 */
                    <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-md">
                      대국중
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}