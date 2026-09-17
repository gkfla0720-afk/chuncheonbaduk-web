'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// --- 타입 정의 ---
interface Profile { id: string; name: string; phone_last4: string; rank: string; tier: string; }
interface ActiveMember { id: number; status: string; checked_in_at: string; user_id: string; profiles: { name: string; rank: string; tier: string; }; }

export default function KioskPage() {
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null);
  const [activeAttendance, setActiveAttendance] = useState<{ id: number; status: string } | null>(null);
  const [lastAttendanceId, setLastAttendanceId] = useState<number | null>(null);
  const [message, setMessage] = useState('전화번호 뒷자리 4자리를 눌러주세요.');
  const [isSuccess, setIsSuccess] = useState(false);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // === 💡 대국 신청 마법사 상태 ===
  const [kioskMode, setKioskMode] = useState<'attendance' | 'match_wizard'>('attendance');
  const [matchStep, setMatchStep] = useState(1);
  const [matchType, setMatchType] = useState('친선전');
  const [blackTeam, setBlackTeam] = useState<ActiveMember[]>([]);
  const [whiteTeam, setWhiteTeam] = useState<ActiveMember[]>([]);
  const [ruleType, setRuleType] = useState('자동');
  
  // 💡 고급 치수 설정 상태
  const [handicapType, setHandicapType] = useState<'호선' | '정선' | '접바둑'>('호선');
  const [handicapStones, setHandicapStones] = useState(2);
  const [komi, setKomi] = useState(0.5);

  const isHandicapValid = 
    handicapType !== '접바둑' || 
    handicapStones >= 2 || 
    (handicapStones === 0 && komi >= 15);

  useEffect(() => {
    let isMounted = true;
    const fetchActiveMembers = async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select(`id, status, checked_in_at, user_id, profiles(name, rank, tier)`)
        .neq('status', '귀가')
        .order('checked_in_at', { ascending: false });

      if (!error && data && isMounted) {
        // @ts-expect-error: 복잡한 타입 추론 무시
        setActiveMembers(data);
        setIsLoadingList(false);
      }
    };
    fetchActiveMembers();
    return () => { isMounted = false; };
  }, [refreshTrigger]);

  useEffect(() => {
    const channel = supabase.channel('attendance_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        setRefreshTrigger((prev) => prev + 1);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleReset = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setPhoneNumber(''); setCandidates([]); setConfirmUser(null); setActiveAttendance(null); setLastAttendanceId(null);
    setMessage('전화번호 뒷자리 4자리를 눌러주세요.'); setIsSuccess(false);
  };

  const handleNumberClick = (num: string) => { if (phoneNumber.length < 4) setPhoneNumber((prev) => prev + num); };
  const handleDelete = () => setPhoneNumber((prev) => prev.slice(0, -1));

  const handleSelectUser = async (user: Profile) => {
    setConfirmUser(user); setCandidates([]); setMessage('출석 상태 확인 중...');
    const { data } = await supabase.from('attendance').select('id, status').eq('user_id', user.id).neq('status', '귀가').order('checked_in_at', { ascending: false }).limit(1);
    if (data && data.length > 0) setActiveAttendance(data[0]);
    else setActiveAttendance(null);
    setMessage('');
  };

  const handleSearchUser = async () => {
    if (phoneNumber.length !== 4) { setMessage('뒷자리 4자리를 모두 입력해주세요.'); return; }
    setMessage('회원 정보 확인 중...');
    const { data, error } = await supabase.from('profiles').select('*').eq('phone_last4', phoneNumber);
    if (error || !data || data.length === 0) { setMessage('등록되지 않은 번호입니다.'); return; }
    if (data.length > 1) { setCandidates(data); setMessage('본인 이름을 선택해주세요.'); } 
    else { handleSelectUser(data[0]); }
  };

  const handleConfirmAttendance = async () => {
    if (!confirmUser) return;
    const { data, error } = await supabase.from('attendance').insert([{ user_id: confirmUser.id, status: '출석중' }]).select('id').single();
    if (!error && data) {
      setLastAttendanceId(data.id); setIsSuccess(true); setMessage(`환영합니다! ${confirmUser.name}님`); setConfirmUser(null);
      setRefreshTrigger((prev) => prev + 1);
      resetTimerRef.current = setTimeout(() => handleReset(), 4000);
    }
  };

  const handleGoHome = async () => {
    if (!activeAttendance || !confirmUser) return;
    const { error } = await supabase.from('attendance').update({ status: '귀가' }).eq('id', activeAttendance.id);
    if (!error) {
      setIsSuccess(true); setMessage(`안녕히 가십시오. ${confirmUser.name}님!`); setConfirmUser(null); setActiveAttendance(null);
      setRefreshTrigger((prev) => prev + 1);
      resetTimerRef.current = setTimeout(() => handleReset(), 4000);
    }
  };

  const handleCancelAttendance = async () => {
    if (!lastAttendanceId) return;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    await supabase.from('attendance').delete().eq('id', lastAttendanceId);
    setRefreshTrigger((prev) => prev + 1); handleReset();
  };

  const openMatchWizard = () => {
    setKioskMode('match_wizard'); setMatchStep(1); setBlackTeam([]); setWhiteTeam([]);
    setHandicapType('호선'); setHandicapStones(2); setKomi(0.5); 
  };

  const closeMatchWizard = () => {
    setKioskMode('attendance'); handleReset();
  };

  const handleMemberClickForMatch = (member: ActiveMember) => {
    if (kioskMode !== 'match_wizard' || matchStep !== 2) return;
    if (blackTeam.find(m => m.id === member.id) || whiteTeam.find(m => m.id === member.id)) return;

    const requiredPlayers = matchType.includes('2:2') ? 2 : matchType.includes('3:3') ? 3 : matchType.includes('4:4') ? 4 : 1;
    if (blackTeam.length < requiredPlayers) setBlackTeam([...blackTeam, member]);
    else if (whiteTeam.length < requiredPlayers) setWhiteTeam([...whiteTeam, member]);
  };

  const handleStonesChange = (delta: number) => {
    setHandicapStones(prev => {
      const next = prev + delta;
      if (next === 1 && delta === -1) return 0;
      if (next === 1 && delta === 1) return 2;
      if (next < 0) return 0;
      if (next > 9) return 9;
      return next;
    });
  };

  const handleKomiChange = (delta: number) => {
    setKomi(prev => {
      const next = prev + delta;
      if (next < 0.5) return 0.5;
      if (next > 99.5) return 99.5;
      return next;
    });
  };

  const submitMatch = async () => {
    let finalHandicap = '';
    if (handicapType === '호선') finalHandicap = '호선(덤 6.5집)';
    else if (handicapType === '정선') finalHandicap = '정선(덤 0.5집)';
    else finalHandicap = `접바둑 ${handicapStones}점 (${handicapStones === 0 ? '역덤' : '덤'} ${komi}집)`;

    const { error } = await supabase.from('matches').insert([{
      match_type: matchType,
      black_team: blackTeam.map(m => m.user_id),
      white_team: whiteTeam.map(m => m.user_id),
      rule_type: ruleType,
      handicap: finalHandicap,
      phase: '초반'
    }]);

    const allPlayerIds = [...blackTeam, ...whiteTeam].map(m => m.id);
    await supabase.from('attendance').update({ status: '대국중' }).in('id', allPlayerIds);

    if (!error) {
      setRefreshTrigger(prev => prev + 1);
      alert('대국 신청이 완료되었습니다!');
      closeMatchWizard();
    } else {
      alert('대국 신청 중 오류가 발생했습니다.');
    }
  };

  return (
    <main className="flex flex-row w-full h-screen bg-[#e3c18b] font-sans select-none overflow-hidden text-slate-900">
      
      {/* ================= LEFT (실시간 현황판) ================= */}
      <section className="w-[45%] h-full bg-[#fdfbf7] border-r-8 border-[#2c1e16] flex flex-col shadow-2xl relative z-10">
        <header className="p-6 bg-white border-b-2 border-stone-200 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-[#2c1e16] tracking-tight">현재 현황</h1>
            {kioskMode === 'match_wizard' && matchStep === 2 ? (
              <p className="text-red-600 font-extrabold mt-1 animate-pulse">👇 대국할 사람을 터치하여 선택하세요 👇</p>
            ) : (
              <p className="text-stone-500 font-bold mt-1">내가 목록에 있다면 &apos;귀가&apos;를 눌러주세요</p>
            )}
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
            activeMembers.map((member) => {
              const isSelected = blackTeam.find(m => m.id === member.id) || whiteTeam.find(m => m.id === member.id);
              const isInteractive = kioskMode === 'match_wizard' && matchStep === 2;

              return (
                <div 
                  key={member.id} 
                  onClick={() => handleMemberClickForMatch(member)}
                  className={`p-4 rounded-xl shadow-sm border flex justify-between items-center transition-all ${
                    isSelected ? 'bg-amber-100 border-amber-500 opacity-50' : 'bg-white border-stone-200'
                  } ${isInteractive && !isSelected ? 'cursor-pointer hover:bg-amber-50 hover:-translate-y-1 hover:shadow-md' : ''}`}
                >
                  <div className="flex flex-col">
                    <span className="font-extrabold text-xl text-[#2c1e16]">{member.profiles?.name}</span>
                    <span className="text-sm text-stone-500 font-bold mt-1">
                      {new Date(member.checked_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 도착
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="px-3 py-1 bg-stone-100 text-[#2c1e16] border border-stone-300 text-sm font-bold rounded-lg">
                      {member.profiles?.rank}
                    </span>
                    {member.status === '대국중' && (
                      <span className="px-2 py-0.5 bg-stone-800 text-white text-[11px] font-bold rounded-md">대국중</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ================= RIGHT (키오스크 / 대국 마법사) ================= */}
      <section className="w-[55%] h-full bg-[#2c1e16] text-[#fdfbf7] p-8 flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fdfbf7 1px, transparent 1px), linear-gradient(90deg, #fdfbf7 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

        {kioskMode === 'attendance' ? (
          <>
            <button onClick={openMatchWizard} className="absolute top-6 right-6 bg-[#9a5b28] hover:bg-[#854d20] text-white font-extrabold py-3 px-6 rounded-2xl shadow-lg transition-transform active:scale-95 z-20">
              ⚔️ 대국 신청하기
            </button>
            <div className="text-center mb-8 relative z-10">
              <span className="bg-[#9a5b28] text-white text-sm font-bold px-4 py-1.5 rounded-full tracking-widest shadow-md">CHUNCHEON BADUK CLUB</span>
              <h2 className="text-5xl font-extrabold mt-6 text-[#fdfbf7] tracking-tight">출석 및 귀가 확인</h2>
              <p className={`mt-5 text-xl font-bold h-8 ${isSuccess ? 'text-green-400 text-3xl' : 'text-[#e3c18b]'}`}>{message}</p>
            </div>
            <div className="relative z-10 w-full max-w-md">
              {isSuccess ? (
                <div className="bg-[#3a291f] p-8 rounded-3xl border border-green-500/30 text-center shadow-2xl">
                  <div className="text-6xl mb-4">✅</div>
                  <p className="text-stone-400 font-bold mb-6">잠시 후 초기화면으로 돌아갑니다.</p>
                  {lastAttendanceId && (
                    <button onClick={handleCancelAttendance} className="w-full py-5 mb-3 bg-red-800 hover:bg-red-700 text-white font-extrabold rounded-2xl text-xl shadow-lg transition">앗, 잘못 눌렀어요! (취소)</button>
                  )}
                </div>
              ) : confirmUser ? (
                <div className="bg-[#3a291f] p-8 rounded-3xl border border-[#9a5b28] shadow-2xl text-center">
                  <div className="bg-[#1a110b] p-6 rounded-2xl mb-6 shadow-inner">
                    <h2 className="text-4xl font-extrabold text-[#fdfbf7]">{confirmUser.name}</h2>
                    <p className="text-[#e3c18b] text-xl font-bold mt-3">{confirmUser.rank} / {confirmUser.tier}</p>
                  </div>
                  {activeAttendance ? (
                    <button onClick={handleGoHome} className="w-full py-5 bg-[#1a110b] border-2 border-[#e3c18b] text-[#e3c18b] font-extrabold rounded-2xl text-3xl shadow-xl transition">귀가하기 (퇴장)</button>
                  ) : (
                    <button onClick={handleConfirmAttendance} className="w-full py-5 bg-[#fdfbf7] text-[#2c1e16] font-extrabold rounded-2xl text-3xl shadow-xl transition">출석하기 (입장)</button>
                  )}
                  <button onClick={handleReset} className="w-full mt-4 py-4 text-stone-400 font-bold text-lg">취소하고 처음으로</button>
                </div>
              ) : candidates.length > 0 ? (
                <div className="bg-[#3a291f] p-8 rounded-3xl shadow-2xl space-y-4">
                  <p className="text-center text-[#e3c18b] font-bold text-xl mb-4">본인의 이름을 선택해주세요</p>
                  {candidates.map((cand) => (
                    <button key={cand.id} onClick={() => handleSelectUser(cand)} className="w-full py-5 bg-[#fdfbf7] text-[#2c1e16] rounded-2xl text-2xl font-extrabold shadow-lg flex justify-between px-8 items-center">
                      <span>{cand.name}</span><span className="text-lg bg-[#e3c18b] px-3 py-1 rounded-lg text-[#2c1e16]">{cand.rank}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-[#3a291f] p-8 rounded-[40px] shadow-2xl">
                  <div className="bg-[#1a110b] border border-stone-800 rounded-3xl h-24 flex items-center justify-center mb-8 shadow-inner">
                    <span className="text-6xl font-mono tracking-[0.3em] text-[#e3c18b] font-bold">{phoneNumber.padEnd(4, '—')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-5 mb-8">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                      <button key={num} onClick={() => handleNumberClick(num)} className="w-20 h-20 mx-auto rounded-full bg-[#fdfbf7] text-[#2c1e16] text-4xl font-extrabold shadow-[0_6px_0_#d1c8b8] active:translate-y-1.5 active:shadow-none transition-all flex items-center justify-center">{num}</button>
                    ))}
                    <button onClick={handleDelete} className="w-20 h-20 mx-auto rounded-full bg-[#1a110b] border-2 border-stone-700 text-[#e3c18b] text-xl font-bold shadow-[0_6px_0_#000] active:translate-y-1.5 active:shadow-none flex items-center justify-center">지움</button>
                    <button onClick={() => handleNumberClick('0')} className="w-20 h-20 mx-auto rounded-full bg-[#fdfbf7] text-[#2c1e16] text-4xl font-extrabold shadow-[0_6px_0_#d1c8b8] active:translate-y-1.5 active:shadow-none flex items-center justify-center">0</button>
                    <button onClick={handleReset} className="w-20 h-20 mx-auto rounded-full bg-[#1a110b] border-2 border-stone-700 text-stone-400 text-xl font-bold shadow-[0_6px_0_#000] active:translate-y-1.5 active:shadow-none flex items-center justify-center">취소</button>
                  </div>
                  <button onClick={handleSearchUser} className="w-full h-20 bg-[#9a5b28] text-white text-3xl font-extrabold rounded-2xl shadow-[0_6px_0_#5c3516] active:translate-y-1.5 active:shadow-none transition-all">확인 (입력완료)</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="relative z-10 w-full max-w-2xl bg-[#3a291f] p-10 rounded-[40px] shadow-2xl border border-stone-700">
            <button onClick={closeMatchWizard} className="absolute top-6 right-6 text-stone-400 hover:text-white font-bold text-xl">✕ 닫기</button>
            <div className="flex gap-2 mb-8 justify-center">
              {[1, 2, 3, 4].map(step => (<div key={step} className={`h-2 w-16 rounded-full ${matchStep >= step ? 'bg-[#9a5b28]' : 'bg-stone-700'}`} />))}
            </div>

            {matchStep === 1 && (
              <div className="text-center animate-fade-in">
                <h2 className="text-3xl font-extrabold text-white mb-8">1. 대국 방식을 선택하세요</h2>
                <div className="grid grid-cols-2 gap-4">
                  {['랭킹전', '친선전', '페어전(2:2)', '페어전(3:3)', '페어전(4:4)'].map(type => (
                    <button key={type} onClick={() => { setMatchType(type); setMatchStep(2); }} className="py-6 bg-[#1a110b] hover:bg-[#9a5b28] border-2 border-stone-700 hover:border-[#9a5b28] rounded-2xl text-2xl font-bold text-stone-300 hover:text-white transition-all shadow-md">
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {matchStep === 2 && (
              <div className="text-center animate-fade-in">
                <h2 className="text-3xl font-extrabold text-white mb-2">2. 대국자를 선택하세요</h2>
                <p className="text-[#e3c18b] mb-8 font-bold">좌측 현황판에서 터치하여 팀을 구성해주세요.</p>
                <div className="flex gap-6">
                  <div className="flex-1 bg-[#1a110b] p-4 rounded-3xl border-2 border-stone-600">
                    <h3 className="text-xl font-bold text-stone-300 mb-4 border-b border-stone-700 pb-2">⚫ 흑 팀</h3>
                    <div className="space-y-3 min-h-30">
                      {blackTeam.map(m => <div key={m.id} className="bg-stone-800 py-3 px-4 rounded-xl font-bold text-lg text-white shadow-sm flex justify-between"><span>{m.profiles.name}</span><span className="text-[#e3c18b]">{m.profiles.rank}</span></div>)}
                    </div>
                  </div>
                  <div className="flex-1 bg-[#fdfbf7] p-4 rounded-3xl border-2 border-stone-300">
                    <h3 className="text-xl font-bold text-[#2c1e16] mb-4 border-b border-stone-300 pb-2">⚪ 백 팀</h3>
                    <div className="space-y-3 min-h-30">
                      {whiteTeam.map(m => <div key={m.id} className="bg-white py-3 px-4 rounded-xl font-bold text-lg text-[#2c1e16] shadow-sm border border-stone-200 flex justify-between"><span>{m.profiles.name}</span><span className="text-[#9a5b28]">{m.profiles.rank}</span></div>)}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setMatchStep(3)} 
                  disabled={blackTeam.length === 0 || whiteTeam.length === 0}
                  className="mt-8 w-full py-5 bg-[#9a5b28] disabled:bg-stone-700 text-white font-extrabold text-2xl rounded-2xl transition"
                >
                  다음 단계로 ➔
                </button>
              </div>
            )}

            {matchStep === 3 && (
              <div className="text-center animate-fade-in">
                <h2 className="text-3xl font-extrabold text-white mb-8">3. 돌 가리기 방식을 선택하세요</h2>
                <div className="space-y-4">
                  {['자동 (시스템 무작위 배정)', '수동 (현재 선택된 흑/백 그대로)'].map(rule => (
                    <button key={rule} onClick={() => { setRuleType(rule); setMatchStep(4); }} className="w-full py-6 bg-[#1a110b] hover:bg-[#9a5b28] border-2 border-stone-700 rounded-2xl text-2xl font-bold text-stone-300 hover:text-white transition-all shadow-md">
                      {rule}
                    </button>
                  ))}
                </div>
                <button onClick={() => setMatchStep(2)} className="mt-6 text-stone-400 font-bold hover:text-white">⬅ 이전 단계</button>
              </div>
            )}

            {matchStep === 4 && (
              <div className="text-center animate-fade-in">
                <h2 className="text-3xl font-extrabold text-white mb-6">4. 치수를 설정하세요</h2>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {['호선', '정선', '접바둑'].map(type => (
                    <button 
                      key={type} 
                      // @ts-expect-error: 상태 업데이트 타입 추론 무시
                      onClick={() => setHandicapType(type)} 
                      className={`py-4 border-2 rounded-2xl font-bold text-xl transition-all ${handicapType === type ? 'bg-[#fdfbf7] text-[#2c1e16] border-white shadow-lg scale-105' : 'bg-[#1a110b] text-stone-400 border-stone-700 hover:border-stone-500'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {handicapType === '접바둑' && (
                  <div className="bg-[#1a110b] p-6 rounded-3xl border border-stone-700 mb-6 flex flex-col gap-6">
                     <div className="flex justify-between items-center px-4">
                        <span className="text-xl font-bold text-stone-300">깔아둘 돌 (접바둑)</span>
                        <div className="flex items-center gap-4 bg-stone-800 rounded-full p-1">
                           <button onClick={() => handleStonesChange(-1)} className="w-12 h-12 bg-stone-700 rounded-full text-2xl font-bold hover:bg-stone-600">-</button>
                           <span className="text-2xl font-extrabold w-12 text-center text-[#e3c18b]">{handicapStones}점</span>
                           <button onClick={() => handleStonesChange(1)} className="w-12 h-12 bg-stone-700 rounded-full text-2xl font-bold hover:bg-stone-600">+</button>
                        </div>
                     </div>

                     <div className="flex justify-between items-center px-4">
                        <span className="text-xl font-bold text-stone-300">{handicapStones === 0 ? '역덤' : '덤'}</span>
                        <div className="flex items-center gap-4 bg-stone-800 rounded-full p-1">
                           <button onClick={() => handleKomiChange(-1)} className="w-12 h-12 bg-stone-700 rounded-full text-2xl font-bold hover:bg-stone-600">-</button>
                           <span className="text-2xl font-extrabold w-20 text-center text-[#e3c18b]">{komi}집</span>
                           <button onClick={() => handleKomiChange(1)} className="w-12 h-12 bg-stone-700 rounded-full text-2xl font-bold hover:bg-stone-600">+</button>
                        </div>
                     </div>
                     
                     {handicapStones === 0 && komi < 15 && (
                        <p className="text-red-400 font-bold text-sm bg-red-900/30 py-2 rounded-xl border border-red-500/50">
                          ⚠️ 0점 접바둑일 경우 최소 15.5집 이상의 역덤이 필요합니다.
                        </p>
                     )}
                  </div>
                )}

                <button 
                  onClick={submitMatch} 
                  disabled={!isHandicapValid}
                  className="w-full py-5 bg-green-600 disabled:bg-stone-700 hover:bg-green-500 text-white text-3xl font-extrabold rounded-2xl shadow-xl transition active:scale-95 disabled:active:scale-100 disabled:text-stone-500"
                >
                  ✅ 대국 시작하기
                </button>
                <button onClick={() => setMatchStep(3)} className="mt-6 text-stone-400 font-bold hover:text-white">⬅ 이전 단계</button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}