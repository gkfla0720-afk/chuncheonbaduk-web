'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  name: string;
  phone_last4: string;
  rank: string;
  tier: string;
}

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

export default function KioskPage() {
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  
  // 💡 즉시 새로고침을 위한 트리거 장치
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null);
  const [activeAttendance, setActiveAttendance] = useState<{ id: number; status: string } | null>(null);
  const [lastAttendanceId, setLastAttendanceId] = useState<number | null>(null);
  const [message, setMessage] = useState('전화번호 뒷자리 4자리를 눌러주세요.');
  const [isSuccess, setIsSuccess] = useState(false);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. 왼쪽 목록 데이터 불러오기 (refreshTrigger가 바뀔 때마다 즉시 실행됨)
  useEffect(() => {
    let isMounted = true;

    const fetchActiveMembers = async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select(`id, status, checked_in_at, profiles(name, rank, tier)`)
        .neq('status', '귀가')
        .order('checked_in_at', { ascending: false });

      if (!error && data && isMounted) {
        // @ts-expect-error: Supabase 조인 데이터의 복잡한 타입 추론 무시
        setActiveMembers(data);
        setIsLoadingList(false);
      }
    };

    fetchActiveMembers();

    return () => { isMounted = false; };
  }, [refreshTrigger]); 

  // 실시간 동기화 (다른 기기에서 변경된 것도 감지)
  useEffect(() => {
    const channel = supabase
      .channel('attendance_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        setRefreshTrigger((prev) => prev + 1); // 변화 감지 시 트리거 발동
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleReset = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setPhoneNumber('');
    setCandidates([]);
    setConfirmUser(null);
    setActiveAttendance(null);
    setLastAttendanceId(null);
    setMessage('전화번호 뒷자리 4자리를 눌러주세요.');
    setIsSuccess(false);
  };

  const handleNumberClick = (num: string) => {
    if (phoneNumber.length < 4) setPhoneNumber((prev) => prev + num);
  };

  const handleDelete = () => setPhoneNumber((prev) => prev.slice(0, -1));

  const handleSelectUser = async (user: Profile) => {
    setConfirmUser(user);
    setCandidates([]);
    setMessage('출석 상태 확인 중...');

    const { data } = await supabase
      .from('attendance')
      .select('id, status')
      .eq('user_id', user.id)
      .neq('status', '귀가')
      .order('checked_in_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) setActiveAttendance(data[0]);
    else setActiveAttendance(null);
    
    setMessage('');
  };

  const handleSearchUser = async () => {
    if (phoneNumber.length !== 4) {
      setMessage('뒷자리 4자리를 모두 입력해주세요.');
      return;
    }
    setMessage('회원 정보 확인 중...');
    const { data, error } = await supabase.from('profiles').select('*').eq('phone_last4', phoneNumber);

    if (error || !data || data.length === 0) {
      setMessage('등록되지 않은 번호입니다.');
      return;
    }
    if (data.length > 1) {
      setCandidates(data);
      setMessage('본인 이름을 선택해주세요.');
    } else {
      handleSelectUser(data[0]);
    }
  };

  const handleConfirmAttendance = async () => {
    if (!confirmUser) return;
    const { data, error } = await supabase
      .from('attendance')
      .insert([{ user_id: confirmUser.id, status: '출석중' }])
      .select('id')
      .single();

    if (!error && data) {
      setLastAttendanceId(data.id);
      setIsSuccess(true);
      setMessage(`환영합니다! ${confirmUser.name}님`);
      setConfirmUser(null);
      setRefreshTrigger((prev) => prev + 1); // 💡 즉시 왼쪽 화면 새로고침
      resetTimerRef.current = setTimeout(() => handleReset(), 4000);
    }
  };

  const handleGoHome = async () => {
    if (!activeAttendance || !confirmUser) return;
    const { error } = await supabase.from('attendance').update({ status: '귀가' }).eq('id', activeAttendance.id);

    if (!error) {
      setIsSuccess(true);
      setMessage(`안녕히 가십시오. ${confirmUser.name}님!`);
      setConfirmUser(null);
      setActiveAttendance(null);
      setRefreshTrigger((prev) => prev + 1); // 💡 즉시 왼쪽 화면 새로고침
      resetTimerRef.current = setTimeout(() => handleReset(), 4000);
    }
  };

  const handleCancelAttendance = async () => {
    if (!lastAttendanceId) return;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    await supabase.from('attendance').delete().eq('id', lastAttendanceId);
    setRefreshTrigger((prev) => prev + 1); // 💡 즉시 왼쪽 화면 새로고침
    handleReset();
  };

  return (
    <main className="flex flex-row w-full h-screen bg-[#e3c18b] font-sans select-none overflow-hidden text-slate-900">
      <section className="w-[45%] h-full bg-[#fdfbf7] border-r-8 border-[#2c1e16] flex flex-col shadow-2xl relative z-10">
        <header className="p-6 bg-white border-b-2 border-stone-200 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-[#2c1e16] tracking-tight">현재 현황</h1>
            <p className="text-stone-500 font-bold mt-1">내가 목록에 있다면 &apos;귀가&apos;를 눌러주세요</p>
          </div>
          <div className="text-right">
            <span className="text-4xl font-extrabold text-[#9a5b28]">{activeMembers.length}</span>
            <span className="text-xl font-bold text-stone-600"> 명</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#fdfbf7]">
          {isLoadingList ? (
            <p className="text-center mt-10 text-stone-400 font-bold">목록을 불러오는 중...</p>
          ) : activeMembers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-stone-400 font-bold text-lg">현재 기원에 계신 분이 없습니다.</p>
            </div>
          ) : (
            activeMembers.map((member) => (
              <div key={member.id} className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="font-extrabold text-xl text-[#2c1e16]">{member.profiles?.name}</span>
                  <span className="text-sm text-stone-500 font-bold mt-1">
                    {new Date(member.checked_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 도착
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="px-3 py-1 bg-stone-100 text-[#2c1e16] border border-stone-300 text-sm font-bold rounded-lg shadow-sm">
                    {member.profiles?.rank}
                  </span>
                  {member.status === '대국중' && (
                    <span className="px-2 py-0.5 bg-stone-800 text-white text-[11px] font-bold rounded-md">
                      대국중
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="w-[55%] h-full bg-[#2c1e16] text-[#fdfbf7] p-8 flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fdfbf7 1px, transparent 1px), linear-gradient(90deg, #fdfbf7 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

        <div className="text-center mb-8 relative z-10">
          <span className="bg-[#9a5b28] text-white text-sm font-bold px-4 py-1.5 rounded-full tracking-widest shadow-md">
            CHUNCHEON BADUK CLUB
          </span>
          <h2 className="text-5xl font-extrabold mt-6 text-[#fdfbf7] tracking-tight">출석 및 귀가 확인</h2>
          <p className={`mt-5 text-xl font-bold h-8 ${isSuccess ? 'text-green-400 text-3xl' : 'text-[#e3c18b]'}`}>
            {message}
          </p>
        </div>

        <div className="relative z-10 w-full max-w-md">
          {isSuccess ? (
            <div className="bg-[#3a291f] p-8 rounded-3xl border border-green-500/30 text-center shadow-2xl">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-stone-400 font-bold mb-6">잠시 후 초기화면으로 돌아갑니다.</p>
              {lastAttendanceId && (
                <button onClick={handleCancelAttendance} className="w-full py-5 mb-3 bg-red-800 hover:bg-red-700 text-white font-extrabold rounded-2xl text-xl shadow-lg transition">
                  앗, 잘못 눌렀어요! (취소)
                </button>
              )}
              <button onClick={handleReset} className="w-full py-4 bg-[#1a110b] text-stone-300 font-bold rounded-2xl transition">
                다음 분 진행하기
              </button>
            </div>
          ) : confirmUser ? (
            <div className="bg-[#3a291f] p-8 rounded-3xl border border-[#9a5b28] shadow-2xl text-center">
              <div className="bg-[#1a110b] p-6 rounded-2xl mb-6 shadow-inner">
                <h2 className="text-4xl font-extrabold text-[#fdfbf7]">{confirmUser.name}</h2>
                <p className="text-[#e3c18b] text-xl font-bold mt-3">{confirmUser.rank} / {confirmUser.tier}</p>
              </div>
              
              {activeAttendance ? (
                <>
                  <p className="text-2xl font-bold text-[#e3c18b] mb-4">현재 목록에 계십니다.</p>
                  <button onClick={handleGoHome} className="w-full py-5 bg-[#1a110b] border-2 border-[#e3c18b] hover:bg-[#e3c18b] hover:text-[#1a110b] text-[#e3c18b] font-extrabold rounded-2xl text-3xl shadow-xl transition">
                    귀가하기 (퇴장)
                  </button>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-white mb-4">본인이 맞으십니까?</p>
                  <button onClick={handleConfirmAttendance} className="w-full py-5 bg-[#fdfbf7] text-[#2c1e16] hover:bg-white font-extrabold rounded-2xl text-3xl shadow-xl transition">
                    출석하기 (입장)
                  </button>
                </>
              )}
              <button onClick={handleReset} className="w-full mt-4 py-4 bg-transparent text-stone-400 font-bold text-lg hover:text-white transition">
                취소하고 처음으로
              </button>
            </div>
          ) : candidates.length > 0 ? (
            <div className="bg-[#3a291f] p-8 rounded-3xl shadow-2xl space-y-4">
              <p className="text-center text-[#e3c18b] font-bold text-xl mb-4">본인의 이름을 선택해주세요</p>
              {candidates.map((cand) => (
                <button key={cand.id} onClick={() => handleSelectUser(cand)} className="w-full py-5 bg-[#fdfbf7] text-[#2c1e16] rounded-2xl text-2xl font-extrabold shadow-lg flex justify-between px-8 items-center hover:bg-white transition">
                  <span>{cand.name}</span>
                  <span className="text-lg bg-[#e3c18b] px-3 py-1 rounded-lg text-[#2c1e16]">{cand.rank}</span>
                </button>
              ))}
              <button onClick={handleReset} className="w-full py-4 bg-[#1a110b] rounded-2xl font-bold text-stone-300 mt-4">
                다시 입력하기
              </button>
            </div>
          ) : (
            <div className="bg-[#3a291f] p-8 rounded-[40px] shadow-2xl">
              <div className="bg-[#1a110b] border border-stone-800 rounded-3xl h-24 flex items-center justify-center mb-8 shadow-inner">
                <span className="text-6xl font-mono tracking-[0.3em] text-[#e3c18b] font-bold">
                  {phoneNumber.padEnd(4, '—')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-5 mb-8">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button key={num} onClick={() => handleNumberClick(num)} className="w-20 h-20 mx-auto rounded-full bg-[#fdfbf7] text-[#2c1e16] text-4xl font-extrabold shadow-[0_6px_0_#d1c8b8] active:translate-y-1.5 active:shadow-none transition-all flex items-center justify-center">
                    {num}
                  </button>
                ))}
                <button onClick={handleDelete} className="w-20 h-20 mx-auto rounded-full bg-[#1a110b] border-2 border-stone-700 text-[#e3c18b] text-xl font-bold shadow-[0_6px_0_#000] active:translate-y-1.5 active:shadow-none transition-all flex items-center justify-center">
                  지움
                </button>
                <button onClick={() => handleNumberClick('0')} className="w-20 h-20 mx-auto rounded-full bg-[#fdfbf7] text-[#2c1e16] text-4xl font-extrabold shadow-[0_6px_0_#d1c8b8] active:translate-y-1.5 active:shadow-none transition-all flex items-center justify-center">
                  0
                </button>
                <button onClick={handleReset} className="w-20 h-20 mx-auto rounded-full bg-[#1a110b] border-2 border-stone-700 text-stone-400 text-xl font-bold shadow-[0_6px_0_#000] active:translate-y-1.5 active:shadow-none transition-all flex items-center justify-center">
                  취소
                </button>
              </div>

              <button onClick={handleSearchUser} className="w-full h-20 bg-[#9a5b28] hover:bg-[#854d20] text-white text-3xl font-extrabold rounded-2xl shadow-[0_6px_0_#5c3516] active:translate-y-1.5 active:shadow-none transition-all">
                확인 (입력완료)
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}