'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// --- 타입 정의 ---
interface Profile { id: string; name: string; phone_last4: string; rank: string; tier: string; }
interface ActiveMember { id: number; status: string; checked_in_at: string; user_id: string; profiles: Profile; }
interface Match { id: number; match_type: string; handicap: string; started_at: string; black_team: string[]; white_team: string[]; }

export default function KioskPage() {
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null);
  const [activeAttendance, setActiveAttendance] = useState<{ id: number; status: string } | null>(null);
  const [message, setMessage] = useState('전화번호 뒷자리 4자리를 눌러주세요.');
  
  // Kiosk Modes: 출석, 대국마법사, 가입, 대국상세(종료)
  const [kioskMode, setKioskMode] = useState<'attendance' | 'match_wizard' | 'register' | 'match_detail'>('attendance');

  // 대국 마법사 상태
  const [matchStep, setMatchStep] = useState(1);
  const [matchType, setMatchType] = useState('친선전');
  const [blackTeam, setBlackTeam] = useState<ActiveMember[]>([]);
  const [whiteTeam, setWhiteTeam] = useState<ActiveMember[]>([]);
  const [handicapType, setHandicapType] = useState<'호선' | '정선' | '접바둑'>('호선');
  const [handicapStones, setHandicapStones] = useState(2);
  const [komi, setKomi] = useState(0.5);

  // 대국 상세(종료) 상태
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchElapsed, setMatchElapsed] = useState('');
  const [confirmAction, setConfirmAction] = useState<'black_win' | 'white_win' | 'cancel' | null>(null);

  // 회원가입 상태
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRank, setRegRank] = useState('18급');
  
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. 실시간 현황 불러오기
  useEffect(() => {
    let isMounted = true;
    const fetchActiveMembers = async () => {
      const { data } = await supabase.from('attendance').select(`id, status, checked_in_at, user_id, profiles(name, rank, tier)`).neq('status', '귀가').order('checked_in_at', { ascending: false });
      if (data && isMounted) {
        // @ts-expect-error: Supabase 조인 데이터의 복잡한 타입 추론 무시
        setActiveMembers(data); 
        setIsLoadingList(false);
      }
    };
    fetchActiveMembers();
    return () => { isMounted = false; };
  }, [refreshTrigger]);

  useEffect(() => {
    const channel = supabase.channel('attendance_status').on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => setRefreshTrigger(p => p + 1)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // 대국 경과 시간 타이머
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (kioskMode === 'match_detail' && selectedMatch) {
      const start = new Date(selectedMatch.started_at).getTime();
      timer = setInterval(() => {
        const now = new Date().getTime();
        const diffInSeconds = Math.floor((now - start) / 1000);
        const h = Math.floor(diffInSeconds / 3600);
        const m = Math.floor((diffInSeconds % 3600) / 60);
        const s = diffInSeconds % 60;
        setMatchElapsed(`${h > 0 ? `${h}시간 ` : ''}${m}분 ${s}초`);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [kioskMode, selectedMatch]);

  // 💡 복구된 핵심 조작 함수들
  const handleReset = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setPhoneNumber(''); setCandidates([]); setConfirmUser(null); setActiveAttendance(null);
    setKioskMode('attendance'); setMessage('전화번호 뒷자리 4자리를 눌러주세요.');
    setConfirmAction(null); setSelectedMatch(null);
  };

  const handleNumberClick = (num: string) => { if (phoneNumber.length < 4) setPhoneNumber(prev => prev + num); };
  const handleDelete = () => setPhoneNumber(prev => prev.slice(0, -1));

  const openMatchWizard = () => {
    setKioskMode('match_wizard'); setMatchStep(1); setBlackTeam([]); setWhiteTeam([]);
    setHandicapType('호선'); setHandicapStones(2); setKomi(0.5);
  };

  const closeMatchWizard = () => {
    setKioskMode('attendance'); handleReset();
  };

  const handleSearchUser = async () => {
    if (phoneNumber.length !== 4) { setMessage('뒷자리를 모두 입력하세요.'); return; }
    setMessage('확인 중...');
    const { data } = await supabase.from('profiles').select('*').eq('phone_last4', phoneNumber);
    if (!data || data.length === 0) { setMessage('등록되지 않은 번호입니다.'); return; }
    if (data.length > 1) { setCandidates(data); setMessage('이름을 선택하세요.'); } 
    else { 
      setConfirmUser(data[0]); setCandidates([]);
      const { data: att } = await supabase.from('attendance').select('id, status').eq('user_id', data[0].id).neq('status', '귀가').order('checked_in_at', { ascending: false }).limit(1);
      setActiveAttendance(att && att.length > 0 ? att[0] : null); setMessage('');
    }
  };

  const handleConfirmAttendance = async () => {
    if (!confirmUser) return;
    await supabase.from('attendance').insert([{ user_id: confirmUser.id, status: '출석중' }]);
    setRefreshTrigger(p => p + 1); 
    resetTimerRef.current = setTimeout(() => handleReset(), 4000);
  };

  const handleGoHome = async () => {
    if (!activeAttendance) return;
    await supabase.from('attendance').update({ status: '귀가' }).eq('id', activeAttendance.id);
    setRefreshTrigger(p => p + 1);
    resetTimerRef.current = setTimeout(() => handleReset(), 4000);
  };

  const submitRegister = async () => {
    if (!regName || regPhone.length !== 4) { alert('이름과 번호 4자리를 모두 입력하세요.'); return; }
    await supabase.from('profiles').insert([{ name: regName, phone_last4: regPhone, rank: regRank, tier: '준회원' }]);
    alert('가입이 완료되었습니다!'); handleReset();
  };

  const openMatchDetail = async (userId: string) => {
    const { data } = await supabase.from('matches').select('*').neq('phase', '종료').neq('phase', '취소');
    if (data) {
      const match = data.find(m => m.black_team.includes(userId) || m.white_team.includes(userId));
      if (match) {
        setSelectedMatch(match);
        setKioskMode('match_detail');
        setConfirmAction(null);
      }
    }
  };

  const endMatch = async (result: string) => {
    if (!selectedMatch) return;
    await supabase.from('matches').update({ phase: result === '취소' ? '취소' : '종료', winner: result }).eq('id', selectedMatch.id);
    
    const allIds = [...selectedMatch.black_team, ...selectedMatch.white_team];
    await supabase.from('attendance').update({ status: '출석중' }).in('user_id', allIds).neq('status', '귀가');
    
    alert(result === '취소' ? '대국이 취소되었습니다.' : '대국이 정상 종료되었습니다. 기록이 저장됩니다.');
    setRefreshTrigger(p => p + 1); handleReset();
  };

  const isHandicapValid = handicapType !== '접바둑' || handicapStones >= 2 || (handicapStones === 0 && komi >= 15);

  const submitMatch = async () => {
    const finalHandicap = handicapType === '접바둑' ? `접바둑 ${handicapStones}점 (${handicapStones===0?'역덤':'덤'} ${komi}집)` : `${handicapType}(덤 ${handicapType==='호선'?'6.5':'0.5'}집)`;
    await supabase.from('matches').insert([{ match_type: matchType, black_team: blackTeam.map(m => m.user_id), white_team: whiteTeam.map(m => m.user_id), handicap: finalHandicap }]);
    await supabase.from('attendance').update({ status: '대국중' }).in('id', [...blackTeam, ...whiteTeam].map(m => m.id));
    setRefreshTrigger(p => p + 1); handleReset();
  };

  return (
    <main className="flex flex-row w-full h-screen bg-[#e3c18b] font-sans select-none overflow-hidden text-slate-900">
      
      {/* ================= LEFT (실시간 현황판) ================= */}
      <section className="w-[40%] h-full bg-[#fdfbf7] border-r-8 border-[#2c1e16] flex flex-col shadow-2xl relative z-10">
        <header className="p-8 bg-white border-b-4 border-stone-200 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-[#2c1e16] tracking-tight">현재 현황</h1>
            <p className="text-stone-500 font-extrabold mt-2 text-xl">대국중인 회원을 눌러 대국을 종료하세요</p>
          </div>
          <div className="text-right">
            <span className="text-6xl font-black text-[#9a5b28]">{activeMembers.length}</span><span className="text-2xl font-bold text-stone-600"> 명</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoadingList ? (
            <p className="text-center mt-10 text-stone-400 font-bold text-2xl">목록을 불러오는 중...</p>
          ) : activeMembers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-stone-400 font-bold text-2xl">현재 기원에 계신 분이 없습니다.</p>
            </div>
          ) : (
            activeMembers.map((member) => (
              <div 
                key={member.id} 
                onClick={() => {
                  if (kioskMode === 'match_wizard' && matchStep === 2) {
                    if (blackTeam.find(m => m.id === member.id) || whiteTeam.find(m => m.id === member.id)) return;
                    const req = matchType.includes('2:2') ? 2 : matchType.includes('3:3') ? 3 : matchType.includes('4:4') ? 4 : 1;
                    if (blackTeam.length < req) setBlackTeam([...blackTeam, member]);
                    else if (whiteTeam.length < req) setWhiteTeam([...whiteTeam, member]);
                  } else if (member.status === '대국중') {
                    openMatchDetail(member.user_id);
                  }
                }}
                className={`p-6 rounded-2xl shadow-md border-2 flex justify-between items-center transition-all ${
                  member.status === '대국중' ? 'bg-red-50 border-red-200 cursor-pointer hover:bg-red-100 hover:scale-[1.02]' : 'bg-white border-stone-200'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-black text-3xl text-[#2c1e16]">{member.profiles?.name}</span>
                  <span className="text-lg text-stone-500 font-bold mt-2">{new Date(member.checked_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 도착</span>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span className="px-4 py-2 bg-stone-100 text-[#2c1e16] border-2 border-stone-300 text-xl font-extrabold rounded-xl">{member.profiles?.rank}</span>
                  {member.status === '대국중' && <span className="px-4 py-1 bg-red-600 text-white text-lg font-black rounded-lg shadow-md animate-pulse">대국중 (터치)</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ================= RIGHT (키오스크/마법사/가입/상세) ================= */}
      <section className="w-[60%] h-full bg-[#2c1e16] text-[#fdfbf7] p-10 flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fdfbf7 2px, transparent 2px), linear-gradient(90deg, #fdfbf7 2px, transparent 2px)', backgroundSize: '60px 60px' }}></div>

        {kioskMode === 'attendance' && (
          <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
            <div className="w-full flex justify-between mb-12">
               <button onClick={() => setKioskMode('register')} className="bg-stone-700 hover:bg-stone-600 text-white font-extrabold py-4 px-8 rounded-2xl shadow-lg text-2xl transition-all">📝 신규 가입</button>
               <button onClick={openMatchWizard} className="bg-[#9a5b28] hover:bg-[#854d20] text-white font-extrabold py-4 px-8 rounded-2xl shadow-lg text-2xl transition-all">⚔️ 대국 신청</button>
            </div>
            
            <h2 className="text-6xl font-black mt-2 text-[#fdfbf7] tracking-tight mb-4">입장 / 귀가</h2>
            <p className="text-2xl font-bold h-10 text-[#e3c18b] mb-8">{message}</p>

            {confirmUser ? (
              <div className="bg-[#3a291f] p-10 rounded-[40px] border-4 border-[#9a5b28] shadow-2xl text-center w-full">
                <h2 className="text-6xl font-black text-[#fdfbf7] mb-4">{confirmUser.name}</h2>
                <p className="text-[#e3c18b] text-3xl font-extrabold mb-10">{confirmUser.rank} / {confirmUser.tier}</p>
                {activeAttendance ? (
                  <button onClick={handleGoHome} className="w-full py-8 bg-[#1a110b] border-4 border-[#e3c18b] text-[#e3c18b] font-black rounded-3xl text-5xl shadow-xl">귀가하기 (퇴장)</button>
                ) : (
                  <button onClick={handleConfirmAttendance} className="w-full py-8 bg-[#fdfbf7] text-[#2c1e16] font-black rounded-3xl text-5xl shadow-xl">출석하기 (입장)</button>
                )}
                <button onClick={handleReset} className="w-full mt-8 py-6 text-stone-400 font-bold text-2xl">취소</button>
              </div>
            ) : candidates.length > 0 ? (
              <div className="bg-[#3a291f] p-8 rounded-3xl shadow-2xl space-y-4 w-full">
                <p className="text-center text-[#e3c18b] font-bold text-2xl mb-4">본인의 이름을 선택해주세요</p>
                {candidates.map((cand) => (
                  <button key={cand.id} onClick={() => { setConfirmUser(cand); setCandidates([]); }} className="w-full py-6 bg-[#fdfbf7] text-[#2c1e16] rounded-2xl text-3xl font-extrabold shadow-lg flex justify-between px-8 items-center">
                    <span>{cand.name}</span><span className="text-xl bg-[#e3c18b] px-3 py-1 rounded-lg text-[#2c1e16]">{cand.rank}</span>
                  </button>
                ))}
                <button onClick={handleReset} className="w-full py-6 text-stone-400 font-bold text-2xl mt-4">다시 입력하기</button>
              </div>
            ) : (
              <div className="bg-[#3a291f] p-10 rounded-[50px] shadow-2xl w-full">
                <div className="bg-[#1a110b] border-2 border-stone-800 rounded-[32px] h-32 flex items-center justify-center mb-10 shadow-inner">
                  <span className="text-[5rem] font-mono tracking-[0.4em] text-[#e3c18b] font-black">{phoneNumber.padEnd(4, '—')}</span>
                </div>
                <div className="grid grid-cols-3 gap-6 mb-10">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                    <button key={num} onClick={() => handleNumberClick(num)} className="w-28 h-28 mx-auto rounded-full bg-[#fdfbf7] text-[#2c1e16] text-5xl font-black shadow-[0_8px_0_#d1c8b8] active:translate-y-2 active:shadow-none flex items-center justify-center">{num}</button>
                  ))}
                  <button onClick={handleDelete} className="w-28 h-28 mx-auto rounded-full bg-[#1a110b] border-4 border-stone-700 text-[#e3c18b] text-3xl font-black shadow-[0_8px_0_#000] active:translate-y-2 flex items-center justify-center">지움</button>
                  <button onClick={() => handleNumberClick('0')} className="w-28 h-28 mx-auto rounded-full bg-[#fdfbf7] text-[#2c1e16] text-5xl font-black shadow-[0_8px_0_#d1c8b8] active:translate-y-2 flex items-center justify-center">0</button>
                  <button onClick={handleReset} className="w-28 h-28 mx-auto rounded-full bg-[#1a110b] border-4 border-stone-700 text-stone-400 text-3xl font-black shadow-[0_8px_0_#000] active:translate-y-2 flex items-center justify-center">취소</button>
                </div>
                <button onClick={handleSearchUser} className="w-full h-28 bg-[#9a5b28] text-white text-5xl font-black rounded-3xl shadow-[0_8px_0_#5c3516] active:translate-y-2">확인</button>
              </div>
            )}
          </div>
        )}

        {/* 대국 상세 (종료 및 취소) 모드 */}
        {kioskMode === 'match_detail' && selectedMatch && (
          <div className="relative z-10 w-full max-w-3xl bg-[#3a291f] p-12 rounded-[50px] shadow-2xl border-4 border-stone-700 text-center">
            <h2 className="text-5xl font-black text-white mb-6">진행 중인 대국 관리</h2>
            <div className="bg-[#1a110b] p-8 rounded-4xl mb-8 flex flex-col gap-4 border-2 border-stone-800">
               <p className="text-3xl font-extrabold text-[#e3c18b]">{selectedMatch.match_type} / {selectedMatch.handicap}</p>
               <p className="text-2xl font-bold text-stone-400">경과 시간: <span className="text-white text-4xl">{matchElapsed}</span></p>
            </div>

            {!confirmAction ? (
              <div className="grid grid-cols-2 gap-6 mb-8">
                <button onClick={() => setConfirmAction('black_win')} className="py-8 bg-stone-900 border-4 border-stone-600 text-white text-4xl font-black rounded-4xl hover:bg-stone-800">⚫ 흑 팀 승리</button>
                <button onClick={() => setConfirmAction('white_win')} className="py-8 bg-[#fdfbf7] border-4 border-stone-300 text-[#2c1e16] text-4xl font-black rounded-4xl hover:bg-white">⚪ 백 팀 승리</button>
                <button onClick={() => setConfirmAction('cancel')} className="col-span-2 py-6 bg-red-900/50 text-red-400 text-2xl font-extrabold rounded-2xl hover:bg-red-800 hover:text-white border-2 border-red-800">대국 무효 (취소하기)</button>
              </div>
            ) : (
              <div className="bg-red-950/40 p-8 rounded-4xl mb-8 border-2 border-red-500/50">
                 <h3 className="text-4xl font-black text-white mb-8">
                   {confirmAction === 'black_win' && '⚫ 흑 팀의 승리로 기록할까요?'}
                   {confirmAction === 'white_win' && '⚪ 백 팀의 승리로 기록할까요?'}
                   {confirmAction === 'cancel' && '정말 대국을 취소(무효) 할까요?'}
                 </h3>
                 <div className="flex gap-6">
                    <button onClick={() => setConfirmAction(null)} className="flex-1 py-6 bg-stone-700 text-white text-3xl font-black rounded-2xl">아니오</button>
                    <button onClick={() => endMatch(confirmAction === 'cancel' ? '취소' : confirmAction === 'black_win' ? '흑승' : '백승')} className="flex-1 py-6 bg-green-600 text-white text-3xl font-black rounded-2xl">예, 확정합니다</button>
                 </div>
              </div>
            )}
            <button onClick={handleReset} className="w-full py-6 text-stone-400 font-extrabold text-2xl hover:text-white mt-4 bg-stone-900/50 rounded-2xl">닫기</button>
          </div>
        )}

        {/* 회원 가입 폼 */}
        {kioskMode === 'register' && (
           <div className="relative z-10 w-full max-w-2xl bg-[#3a291f] p-12 rounded-[50px] shadow-2xl border-4 border-stone-700 text-center">
              <h2 className="text-5xl font-black text-white mb-10">📝 신규 회원 등록</h2>
              <div className="space-y-8 text-left">
                 <div>
                    <label className="text-stone-400 text-2xl font-bold mb-3 block">이름 (실명)</label>
                    <input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full p-6 text-3xl font-bold bg-[#1a110b] text-white rounded-2xl border-2 border-stone-600 focus:border-[#e3c18b] outline-none" placeholder="홍길동" />
                 </div>
                 <div>
                    <label className="text-stone-400 text-2xl font-bold mb-3 block">전화번호 뒷자리 4개 (출석용)</label>
                    <input type="number" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full p-6 text-3xl font-bold bg-[#1a110b] text-white rounded-2xl border-2 border-stone-600 focus:border-[#e3c18b] outline-none" placeholder="1234" />
                 </div>
                 <div>
                    <label className="text-stone-400 text-2xl font-bold mb-3 block">현재 급수</label>
                    <select value={regRank} onChange={e => setRegRank(e.target.value)} className="w-full p-6 text-3xl font-bold bg-[#1a110b] text-white rounded-2xl border-2 border-stone-600 outline-none">
                       {['9단','8단','7단','6단','5단','4단','3단','2단','1단','1급','2급','3급','5급','7급','9급','13급','18급'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                 </div>
              </div>
              <div className="flex gap-6 mt-12">
                 <button onClick={handleReset} className="flex-1 py-6 bg-stone-700 text-white text-3xl font-black rounded-2xl">취소</button>
                 <button onClick={submitRegister} className="flex-1 py-6 bg-green-600 text-white text-3xl font-black rounded-2xl">등록하기</button>
              </div>
           </div>
        )}

        {/* 대국 신청 마법사 */}
        {kioskMode === 'match_wizard' && (
          <div className="relative z-10 w-full max-w-3xl bg-[#3a291f] p-12 rounded-[50px] shadow-2xl border-4 border-stone-700">
            <button onClick={closeMatchWizard} className="absolute top-8 right-8 text-stone-400 font-extrabold text-2xl">✕ 닫기</button>
            <div className="flex gap-3 mb-12 justify-center">
              {[1, 2, 3, 4].map(step => (<div key={step} className={`h-3 w-20 rounded-full ${matchStep >= step ? 'bg-[#9a5b28]' : 'bg-stone-700'}`} />))}
            </div>

            {matchStep === 1 && (
              <div className="text-center">
                <h2 className="text-4xl font-black text-white mb-10">1. 대국 방식을 선택하세요</h2>
                <div className="grid grid-cols-2 gap-6">
                  {['랭킹전', '친선전', '페어전(2:2)', '페어전(3:3)', '페어전(4:4)'].map(type => (
                    <button key={type} onClick={() => { setMatchType(type); setMatchStep(2); }} className="py-10 bg-[#1a110b] border-4 border-stone-700 rounded-4xl text-3xl font-black text-stone-300 hover:bg-[#9a5b28] hover:text-white transition-all">
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {matchStep === 2 && (
              <div className="text-center">
                <h2 className="text-4xl font-black text-white mb-4">2. 대국자를 선택하세요</h2>
                <p className="text-[#e3c18b] mb-10 text-xl font-bold">좌측 명단을 터치하여 순서대로 팀을 채우세요.</p>
                <div className="flex gap-8">
                  <div className="flex-1 bg-[#1a110b] p-6 rounded-[32px] border-4 border-stone-600">
                    <h3 className="text-3xl font-black text-stone-300 mb-6">⚫ 흑 팀</h3>
                    <div className="space-y-4 min-h-40">
                      {blackTeam.map(m => <div key={m.id} className="bg-stone-800 py-4 px-6 rounded-2xl font-black text-2xl text-white flex justify-between"><span>{m.profiles.name}</span><span className="text-[#e3c18b]">{m.profiles.rank}</span></div>)}
                    </div>
                  </div>
                  <div className="flex-1 bg-[#fdfbf7] p-6 rounded-[32px] border-4 border-stone-300">
                    <h3 className="text-3xl font-black text-[#2c1e16] mb-6">⚪ 백 팀</h3>
                    <div className="space-y-4 min-h-40">
                      {whiteTeam.map(m => <div key={m.id} className="bg-white py-4 px-6 rounded-2xl font-black text-2xl text-[#2c1e16] flex justify-between border-2"><span>{m.profiles.name}</span><span className="text-[#9a5b28]">{m.profiles.rank}</span></div>)}
                    </div>
                  </div>
                </div>
                <button onClick={() => setMatchStep(3)} disabled={blackTeam.length === 0 || whiteTeam.length === 0} className="mt-10 w-full py-8 bg-[#9a5b28] disabled:bg-stone-700 text-white font-black text-3xl rounded-4xl">
                  다음 단계로 ➔
                </button>
              </div>
            )}

            {matchStep === 3 && (
              <div className="text-center">
                <h2 className="text-3xl font-extrabold text-white mb-8">3. 돌 가리기 방식을 선택하세요</h2>
                <div className="space-y-4">
                  <button onClick={() => { setMatchStep(4); }} className="w-full py-8 bg-[#1a110b] border-4 border-stone-700 rounded-4xl text-3xl font-black text-stone-300 hover:bg-[#9a5b28] hover:text-white">수동 (선택된 흑/백 그대로 진행)</button>
                </div>
                <button onClick={() => setMatchStep(2)} className="mt-8 text-stone-400 font-bold text-2xl">⬅ 이전 단계</button>
              </div>
            )}

            {matchStep === 4 && (
              <div className="text-center">
                <h2 className="text-4xl font-black text-white mb-8">4. 치수를 설정하세요</h2>
                <div className="grid grid-cols-3 gap-6 mb-8">
                  {['호선', '정선', '접바둑'].map(type => (
                    // @ts-expect-error: 상태 업데이트를 위한 문자열 타입 강제 매칭 허용
                    <button key={type} onClick={() => setHandicapType(type)} className={`py-6 border-4 rounded-4xl font-black text-3xl ${handicapType === type ? 'bg-[#fdfbf7] text-[#2c1e16] border-white scale-105' : 'bg-[#1a110b] text-stone-400 border-stone-700'}`}>{type}</button>
                  ))}
                </div>
                {handicapType === '접바둑' && (
                  <div className="bg-[#1a110b] p-8 rounded-[32px] border-4 border-stone-700 mb-8 flex flex-col gap-8">
                     <div className="flex justify-between items-center">
                        <span className="text-3xl font-black text-stone-300">깔아둘 돌</span>
                        <div className="flex items-center gap-6 bg-stone-800 rounded-full p-2">
                           <button onClick={() => setHandicapStones(p => p > 2 ? p - 1 : p === 2 ? 0 : 0)} className="w-16 h-16 bg-stone-700 rounded-full text-4xl font-black">-</button>
                           <span className="text-4xl font-black w-24 text-center text-[#e3c18b]">{handicapStones}점</span>
                           <button onClick={() => setHandicapStones(p => p === 0 ? 2 : p < 9 ? p + 1 : 9)} className="w-16 h-16 bg-stone-700 rounded-full text-4xl font-black">+</button>
                        </div>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-3xl font-black text-stone-300">{handicapStones === 0 ? '역덤' : '덤'}</span>
                        <div className="flex items-center gap-6 bg-stone-800 rounded-full p-2">
                           <button onClick={() => setKomi(p => p > 0.5 ? p - 1 : 0.5)} className="w-16 h-16 bg-stone-700 rounded-full text-4xl font-black">-</button>
                           <span className="text-4xl font-black w-32 text-center text-[#e3c18b]">{komi}집</span>
                           <button onClick={() => setKomi(p => p < 99.5 ? p + 1 : 99.5)} className="w-16 h-16 bg-stone-700 rounded-full text-4xl font-black">+</button>
                        </div>
                     </div>
                     {handicapStones === 0 && komi < 15 && (
                        <p className="text-red-400 font-bold text-xl bg-red-900/30 py-4 rounded-xl border-2 border-red-500/50">⚠️ 0점 접바둑은 최소 15.5집 이상의 역덤이 필요합니다.</p>
                     )}
                  </div>
                )}
                <button onClick={submitMatch} disabled={!isHandicapValid} className="w-full py-8 bg-green-600 disabled:bg-stone-700 text-white text-4xl font-black rounded-4xl disabled:text-stone-500">✅ 대국 시작하기</button>
                <button onClick={() => setMatchStep(3)} className="mt-8 text-stone-400 font-bold text-2xl">⬅ 이전 단계</button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}