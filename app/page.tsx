'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Profile { id: string; name: string; phone_last4: string; rank: string; tier: string; current_status: string; last_check_in: string; }
interface Match { id: number; match_type: string; handicap: string; started_at: string; black_team: string[]; white_team: string[]; }

export default function KioskPage() {
  const [activeMembers, setActiveMembers] = useState<Profile[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null);
  const [message, setMessage] = useState('전화번호 뒷자리 4자리를 눌러주세요.');
  
  const [kioskMode, setKioskMode] = useState<'attendance' | 'match_wizard' | 'register' | 'match_detail' | 'profile_detail'>('attendance');

  const [matchStep, setMatchStep] = useState(1);
  const [matchType, setMatchType] = useState('친선전');
  const [blackTeam, setBlackTeam] = useState<Profile[]>([]);
  const [whiteTeam, setWhiteTeam] = useState<Profile[]>([]);
  const [handicapType, setHandicapType] = useState<'호선' | '정선' | '접바둑'>('호선');
  const [handicapStones, setHandicapStones] = useState(2);
  const [komi, setKomi] = useState(0.5);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchElapsed, setMatchElapsed] = useState('');
  const [confirmAction, setConfirmAction] = useState<'black_win' | 'white_win' | 'cancel' | null>(null);

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profileStats, setProfileStats] = useState({ wins: 0, losses: 0, attendanceRate: 0, joinedAt: '' });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRank, setRegRank] = useState('18급');
  
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchActiveMembers = async () => {
      // 💡 핵심 기능: 새벽 4시 자동 귀가(체크아웃) 시스템
      const now = new Date();
      const limitTime = new Date();
      limitTime.setHours(4, 0, 0, 0); // 기준점: 오늘 새벽 4시
      if (now < limitTime) limitTime.setDate(limitTime.getDate() - 1); // 지금 시간이 새벽 4시 전이라면 어제 새벽 4시가 기준

      const { data: staleData } = await supabase.from('profiles').select('id').neq('current_status', '오프라인').lt('last_check_in', limitTime.toISOString());
      if (staleData && staleData.length > 0) {
        const staleIds = staleData.map(d => d.id);
        // 오래된 기록 오프라인 및 귀가 처리 (4시에 퇴장한 것으로 기록)
        await supabase.from('profiles').update({ current_status: '오프라인' }).in('id', staleIds);
        await supabase.from('attendance').update({ status: '귀가', checked_out_at: limitTime.toISOString() }).in('user_id', staleIds).neq('status', '귀가');
      }

      // 💡 현재 기원에 있는 회원 불러오기 (중복 없음)
      const { data } = await supabase.from('profiles')
        .select('*')
        .neq('current_status', '오프라인')
        .order('last_check_in', { ascending: false });

      if (data && isMounted) {
        setActiveMembers(data); 
        setIsLoadingList(false);
      }
    };
    fetchActiveMembers();
    return () => { isMounted = false; };
  }, [refreshTrigger]);

  useEffect(() => {
    const channel = supabase.channel('profiles_status').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => setRefreshTrigger(p => p + 1)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (kioskMode === 'match_detail' && selectedMatch) {
      const start = new Date(selectedMatch.started_at).getTime();
      timer = setInterval(() => {
        const diff = Math.floor((new Date().getTime() - start) / 1000);
        setMatchElapsed(`${Math.floor(diff/3600) > 0 ? `${Math.floor(diff/3600)}시간 ` : ''}${Math.floor((diff%3600)/60)}분 ${diff%60}초`);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [kioskMode, selectedMatch]);

  const handleReset = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setPhoneNumber(''); setCandidates([]); setConfirmUser(null);
    setKioskMode('attendance'); setMessage('전화번호 뒷자리 4자리를 눌러주세요.');
    setConfirmAction(null); setSelectedMatch(null); setSelectedProfile(null);
  };

  const handleNumberClick = (num: string) => { if (phoneNumber.length < 4) setPhoneNumber(prev => prev + num); };
  const handleDelete = () => setPhoneNumber(prev => prev.slice(0, -1));

  const handleSearchUser = async () => {
    if (phoneNumber.length !== 4) { setMessage('뒷자리를 모두 입력하세요.'); return; }
    setMessage('확인 중...');
    const { data } = await supabase.from('profiles').select('*').eq('phone_last4', phoneNumber);
    if (!data || data.length === 0) { setMessage('등록되지 않은 번호입니다.'); return; }
    if (data.length > 1) { setCandidates(data); setMessage('이름을 선택하세요.'); } 
    else { setConfirmUser(data[0]); setCandidates([]); setMessage(''); }
  };

  // 💡 입장 시 로직: 출석 기록은 쌓이고 프로필은 출석중으로 업데이트
  const handleConfirmAttendance = async () => {
    if (!confirmUser) return;
    const nowISO = new Date().toISOString();
    await supabase.from('profiles').update({ current_status: '출석중', last_check_in: nowISO }).eq('id', confirmUser.id);
    await supabase.from('attendance').insert([{ user_id: confirmUser.id, status: '출석중', checked_in_at: nowISO }]);
    setRefreshTrigger(p => p + 1); 
    resetTimerRef.current = setTimeout(() => handleReset(), 4000);
  };

  // 💡 귀가 시 로직: 열려있던 출석 기록에 퇴장 시간을 기록하고 닫음
  const handleGoHome = async () => {
    if (!confirmUser) return;
    await supabase.from('profiles').update({ current_status: '오프라인' }).eq('id', confirmUser.id);
    await supabase.from('attendance').update({ status: '귀가', checked_out_at: new Date().toISOString() }).eq('user_id', confirmUser.id).neq('status', '귀가');
    setRefreshTrigger(p => p + 1);
    resetTimerRef.current = setTimeout(() => handleReset(), 4000);
  };

  const submitRegister = async () => {
    if (!regName || regPhone.length !== 4) { alert('이름과 번호 4자리를 모두 입력하세요.'); return; }
    await supabase.from('profiles').insert([{ name: regName, phone_last4: regPhone, rank: regRank, tier: '준회원' }]);
    alert('가입이 완료되었습니다!'); handleReset();
  };

  const openProfileDetail = async (member: Profile) => {
    setKioskMode('profile_detail'); setSelectedProfile(member); setIsLoadingStats(true);

    try {
      const { data: profData } = await supabase.from('profiles').select('created_at').eq('id', member.id).single();
      const joinedAt = profData?.created_at ? new Date(profData.created_at).toLocaleDateString('ko-KR') : '정보 없음';

      const { data: blackMatches } = await supabase.from('matches').select('winner').eq('phase', '종료').contains('black_team', [member.id]);
      const { data: whiteMatches } = await supabase.from('matches').select('winner').eq('phase', '종료').contains('white_team', [member.id]);
      
      let w = 0, l = 0;
      blackMatches?.forEach(m => { if (m.winner === '흑승') w++; else if (m.winner === '백승') l++; });
      whiteMatches?.forEach(m => { if (m.winner === '백승') w++; else if (m.winner === '흑승') l++; });

      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: attData } = await supabase.from('attendance').select('checked_in_at').eq('user_id', member.id).gte('checked_in_at', thirtyDaysAgo.toISOString());
      
      const uniqueDays = new Set(attData?.map(a => new Date(a.checked_in_at).toLocaleDateString())).size;
      const attRate = Math.round((uniqueDays / 30) * 100);

      setProfileStats({ wins: w, losses: l, attendanceRate: attRate, joinedAt });
    } catch (err) { console.error(err); }
    setIsLoadingStats(false);
  };

  const openMatchWizard = () => { setKioskMode('match_wizard'); setMatchStep(1); setBlackTeam([]); setWhiteTeam([]); setHandicapType('호선'); setHandicapStones(2); setKomi(0.5); };
  const closeMatchWizard = () => { setKioskMode('attendance'); handleReset(); };

  const openMatchDetail = async (userId: string) => {
    const { data } = await supabase.from('matches').select('*').neq('phase', '종료').neq('phase', '취소');
    if (data) {
      const match = data.find(m => m.black_team.includes(userId) || m.white_team.includes(userId));
      if (match) { setSelectedMatch(match); setKioskMode('match_detail'); setConfirmAction(null); }
    }
  };

  const endMatch = async (result: string) => {
    if (!selectedMatch) return;
    await supabase.from('matches').update({ phase: result === '취소' ? '취소' : '종료', winner: result }).eq('id', selectedMatch.id);
    const allIds = [...selectedMatch.black_team, ...selectedMatch.white_team];
    await supabase.from('profiles').update({ current_status: '출석중' }).in('id', allIds);
    await supabase.from('attendance').update({ status: '출석중' }).in('user_id', allIds).neq('status', '귀가');
    alert(result === '취소' ? '대국이 취소되었습니다.' : '대국이 정상 종료되었습니다.');
    setRefreshTrigger(p => p + 1); handleReset();
  };

  const isHandicapValid = handicapType !== '접바둑' || handicapStones >= 2 || (handicapStones === 0 && komi >= 15);

  const submitMatch = async () => {
    const finalHandicap = handicapType === '접바둑' ? `접바둑 ${handicapStones}점 (${handicapStones===0?'역덤':'덤'} ${komi}집)` : `${handicapType}(덤 ${handicapType==='호선'?'6.5':'0.5'}집)`;
    await supabase.from('matches').insert([{ match_type: matchType, black_team: blackTeam.map(m => m.id), white_team: whiteTeam.map(m => m.id), handicap: finalHandicap }]);
    const allIds = [...blackTeam, ...whiteTeam].map(m => m.id);
    await supabase.from('profiles').update({ current_status: '대국중' }).in('id', allIds);
    await supabase.from('attendance').update({ status: '대국중' }).in('user_id', allIds).neq('status', '귀가');
    setRefreshTrigger(p => p + 1); handleReset();
  };

  return (
    <main className="flex flex-row w-full h-screen bg-[#e3c18b] font-sans select-none overflow-hidden text-slate-900">
      
      {/* ================= LEFT (실시간 현황판) ================= */}
      <section className="w-[40%] h-full bg-[#fdfbf7] border-r-8 border-[#2c1e16] flex flex-col shadow-2xl relative z-10">
        <header className="p-6 bg-white border-b-4 border-stone-200 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-[#2c1e16] tracking-tight">현재 현황</h1>
            <p className="text-stone-500 font-bold mt-1">대국중단/프로필 조회를 위해 이름을 터치하세요</p>
          </div>
          <div className="text-right">
            <span className="text-5xl font-black text-[#9a5b28]">{activeMembers.length}</span><span className="text-xl font-bold text-stone-600"> 명</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoadingList ? (
            <p className="text-center mt-10 text-stone-400 font-bold text-xl">목록을 불러오는 중...</p>
          ) : activeMembers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-stone-400 font-bold text-xl">현재 기원에 계신 분이 없습니다.</p>
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
                  } else if (member.current_status === '대국중') {
                    openMatchDetail(member.id);
                  } else {
                    openProfileDetail(member);
                  }
                }}
                className={`p-4 rounded-2xl shadow-sm border-2 flex justify-between items-center transition-all cursor-pointer hover:scale-[1.02] ${
                  member.current_status === '대국중' ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-white border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-black text-2xl text-[#2c1e16]">{member.name}</span>
                  <span className="text-sm text-stone-500 font-bold mt-1">{new Date(member.last_check_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 도착</span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="px-3 py-1 bg-stone-100 text-[#2c1e16] border-2 border-stone-300 text-lg font-extrabold rounded-lg">{member.rank}</span>
                  {member.current_status === '대국중' && <span className="px-3 py-1 bg-red-600 text-white text-sm font-black rounded-md shadow-md animate-pulse">대국중 (터치)</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ================= RIGHT (우측 영역) ================= */}
      <section className="w-[60%] h-full bg-[#2c1e16] text-[#fdfbf7] p-8 overflow-y-auto flex flex-col items-center justify-center relative custom-scrollbar">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fdfbf7 2px, transparent 2px), linear-gradient(90deg, #fdfbf7 2px, transparent 2px)', backgroundSize: '60px 60px' }}></div>

        {kioskMode === 'attendance' && (
          <div className="relative z-10 w-full max-w-md flex flex-col items-center py-6">
            <div className="w-full flex justify-between mb-8 gap-4">
               <button onClick={() => setKioskMode('register')} className="flex-1 bg-stone-700 hover:bg-stone-600 text-white font-extrabold py-3 rounded-2xl shadow-md text-xl transition-all">📝 신규 가입</button>
               <button onClick={openMatchWizard} className="flex-1 bg-[#9a5b28] hover:bg-[#854d20] text-white font-extrabold py-3 rounded-2xl shadow-md text-xl transition-all">⚔️ 대국 신청</button>
            </div>
            <h2 className="text-5xl font-black text-[#fdfbf7] tracking-tight mb-3">입장 / 귀가</h2>
            <p className="text-xl font-bold h-8 text-[#e3c18b] mb-6">{message}</p>

            {confirmUser ? (
              <div className="bg-[#3a291f] p-8 rounded-[40px] border-4 border-[#9a5b28] shadow-2xl text-center w-full">
                <h2 className="text-5xl font-black text-[#fdfbf7] mb-3">{confirmUser.name}</h2>
                <p className="text-[#e3c18b] text-2xl font-extrabold mb-8">{confirmUser.rank} / {confirmUser.tier}</p>
                {confirmUser.current_status !== '오프라인' ? (
                  <button onClick={handleGoHome} className="w-full py-6 bg-[#1a110b] border-4 border-[#e3c18b] text-[#e3c18b] font-black rounded-2xl text-3xl shadow-xl">귀가하기 (퇴장)</button>
                ) : (
                  <button onClick={handleConfirmAttendance} className="w-full py-6 bg-[#fdfbf7] text-[#2c1e16] font-black rounded-2xl text-3xl shadow-xl">출석하기 (입장)</button>
                )}
                <button onClick={handleReset} className="w-full mt-6 py-4 text-stone-400 font-bold text-xl">취소</button>
              </div>
            ) : candidates.length > 0 ? (
              <div className="bg-[#3a291f] p-8 rounded-3xl shadow-2xl space-y-4 w-full">
                <p className="text-center text-[#e3c18b] font-bold text-xl mb-4">본인의 이름을 선택해주세요</p>
                {candidates.map((cand) => (
                  <button key={cand.id} onClick={() => { setConfirmUser(cand); setCandidates([]); }} className="w-full py-5 bg-[#fdfbf7] text-[#2c1e16] rounded-2xl text-2xl font-extrabold shadow-lg flex justify-between px-6 items-center">
                    <span>{cand.name}</span><span className="text-lg bg-[#e3c18b] px-3 py-1 rounded-lg text-[#2c1e16]">{cand.rank}</span>
                  </button>
                ))}
                <button onClick={handleReset} className="w-full py-4 text-stone-400 font-bold text-xl mt-2">다시 입력하기</button>
              </div>
            ) : (
              <div className="bg-[#3a291f] p-8 rounded-[40px] shadow-2xl w-full">
                <div className="bg-[#1a110b] border-2 border-stone-800 rounded-3xl h-24 flex items-center justify-center mb-6 shadow-inner">
                  <span className="text-5xl font-mono tracking-[0.4em] text-[#e3c18b] font-black">{phoneNumber.padEnd(4, '—')}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                    <button key={num} onClick={() => handleNumberClick(num)} className="w-20 h-20 mx-auto rounded-full bg-[#fdfbf7] text-[#2c1e16] text-4xl font-black shadow-[0_6px_0_#d1c8b8] active:translate-y-1.5 active:shadow-none flex items-center justify-center transition-transform">{num}</button>
                  ))}
                  <button onClick={handleDelete} className="w-20 h-20 mx-auto rounded-full bg-[#1a110b] border-4 border-stone-700 text-[#e3c18b] text-xl font-black shadow-[0_6px_0_#000] active:translate-y-1.5 flex items-center justify-center">지움</button>
                  <button onClick={() => handleNumberClick('0')} className="w-20 h-20 mx-auto rounded-full bg-[#fdfbf7] text-[#2c1e16] text-4xl font-black shadow-[0_6px_0_#d1c8b8] active:translate-y-1.5 flex items-center justify-center">0</button>
                  <button onClick={handleReset} className="w-20 h-20 mx-auto rounded-full bg-[#1a110b] border-4 border-stone-700 text-stone-400 text-xl font-black shadow-[0_6px_0_#000] active:translate-y-1.5 flex items-center justify-center">취소</button>
                </div>
                <button onClick={handleSearchUser} className="w-full h-20 bg-[#9a5b28] text-white text-3xl font-black rounded-2xl shadow-[0_6px_0_#5c3516] active:translate-y-1.5 transition-transform">확인</button>
              </div>
            )}
          </div>
        )}

        {/* 회원 프로필 상세 보기 모드 */}
        {kioskMode === 'profile_detail' && selectedProfile && (
          <div className="relative z-10 w-full max-w-lg bg-[#3a291f] p-10 rounded-[40px] shadow-2xl border-4 border-stone-700 text-center my-6">
            <h2 className="text-4xl font-black text-white mb-2">회원 프로필</h2>
            <p className="text-stone-400 font-bold mb-8">가입일: {profileStats.joinedAt}</p>
            <div className="bg-[#1a110b] p-8 rounded-3xl mb-8 border-2 border-stone-800">
               <h3 className="text-5xl font-black text-[#fdfbf7] mb-2">{selectedProfile.name}</h3>
               <p className="text-2xl font-extrabold text-[#e3c18b] mb-8">{selectedProfile.rank} / {selectedProfile.tier}</p>
               {isLoadingStats ? (
                 <p className="text-stone-400 font-bold text-xl py-6 animate-pulse">전적 데이터를 불러오는 중...</p>
               ) : (
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-stone-800 p-4 rounded-2xl border border-stone-700">
                       <p className="text-stone-400 text-sm font-bold mb-1">통산 전적</p>
                       <p className="text-3xl font-black text-white"><span className="text-blue-400">{profileStats.wins}승</span> <span className="text-red-400">{profileStats.losses}패</span></p>
                       <p className="text-stone-500 text-sm font-bold mt-2">승률: {profileStats.wins + profileStats.losses > 0 ? Math.round((profileStats.wins / (profileStats.wins + profileStats.losses)) * 100) : 0}%</p>
                    </div>
                    <div className="bg-stone-800 p-4 rounded-2xl border border-stone-700 flex flex-col justify-center items-center">
                       <p className="text-stone-400 text-sm font-bold mb-1">최근 30일 출석률</p>
                       <p className="text-4xl font-black text-[#e3c18b]">{profileStats.attendanceRate}%</p>
                    </div>
                 </div>
               )}
            </div>
            <button onClick={handleReset} className="w-full py-5 bg-[#9a5b28] hover:bg-[#854d20] text-white text-3xl font-black rounded-2xl shadow-xl transition-all">확인 (닫기)</button>
          </div>
        )}

        {/* 대국 상세 (종료 및 취소) 모드 */}
        {kioskMode === 'match_detail' && selectedMatch && (
          <div className="relative z-10 w-full max-w-2xl bg-[#3a291f] p-8 rounded-[40px] shadow-2xl border-4 border-stone-700 text-center my-6">
            <h2 className="text-4xl font-black text-white mb-6">진행 중인 대국 관리</h2>
            <div className="bg-[#1a110b] p-6 rounded-3xl mb-6 flex flex-col gap-3 border-2 border-stone-800">
               <p className="text-2xl font-extrabold text-[#e3c18b]">{selectedMatch.match_type} / {selectedMatch.handicap}</p>
               <p className="text-xl font-bold text-stone-400">경과 시간: <span className="text-white text-3xl">{matchElapsed}</span></p>
            </div>
            {!confirmAction ? (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button onClick={() => setConfirmAction('black_win')} className="py-6 bg-stone-900 border-4 border-stone-600 text-white text-3xl font-black rounded-3xl hover:bg-stone-800">⚫ 흑 팀 승리</button>
                <button onClick={() => setConfirmAction('white_win')} className="py-6 bg-[#fdfbf7] border-4 border-stone-300 text-[#2c1e16] text-3xl font-black rounded-3xl hover:bg-white">⚪ 백 팀 승리</button>
                <button onClick={() => setConfirmAction('cancel')} className="col-span-2 py-4 bg-red-900/50 text-red-400 text-xl font-extrabold rounded-2xl hover:bg-red-800 hover:text-white border-2 border-red-800">대국 무효 (취소하기)</button>
              </div>
            ) : (
              <div className="bg-red-950/40 p-6 rounded-3xl mb-6 border-2 border-red-500/50">
                 <h3 className="text-3xl font-black text-white mb-6">{confirmAction === 'black_win' && '⚫ 흑 팀의 승리로 기록할까요?'}{confirmAction === 'white_win' && '⚪ 백 팀의 승리로 기록할까요?'}{confirmAction === 'cancel' && '정말 대국을 취소(무효) 할까요?'}</h3>
                 <div className="flex gap-4">
                    <button onClick={() => setConfirmAction(null)} className="flex-1 py-4 bg-stone-700 text-white text-2xl font-black rounded-xl">아니오</button>
                    <button onClick={() => endMatch(confirmAction === 'cancel' ? '취소' : confirmAction === 'black_win' ? '흑승' : '백승')} className="flex-1 py-4 bg-green-600 text-white text-2xl font-black rounded-xl">예, 확정합니다</button>
                 </div>
              </div>
            )}
            <button onClick={handleReset} className="w-full py-4 text-stone-400 font-extrabold text-xl hover:text-white mt-2 bg-stone-900/50 rounded-xl">닫기</button>
          </div>
        )}

        {/* 회원 가입 폼 */}
        {kioskMode === 'register' && (
           <div className="relative z-10 w-full max-w-xl bg-[#3a291f] p-8 rounded-[40px] shadow-2xl border-4 border-stone-700 text-center my-6">
              <h2 className="text-4xl font-black text-white mb-8">📝 신규 회원 등록</h2>
              <div className="space-y-6 text-left">
                 <div>
                    <label className="text-stone-400 text-xl font-bold mb-2 block">이름 (실명)</label>
                    <input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full p-4 text-2xl font-bold bg-[#1a110b] text-white rounded-xl border-2 border-stone-600 focus:border-[#e3c18b] outline-none" placeholder="홍길동" />
                 </div>
                 <div>
                    <label className="text-stone-400 text-xl font-bold mb-2 block">전화번호 뒷자리 4개 (출석용)</label>
                    <input type="number" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full p-4 text-2xl font-bold bg-[#1a110b] text-white rounded-xl border-2 border-stone-600 focus:border-[#e3c18b] outline-none" placeholder="1234" />
                 </div>
                 <div>
                    <label className="text-stone-400 text-xl font-bold mb-2 block">현재 급수</label>
                    <select value={regRank} onChange={e => setRegRank(e.target.value)} className="w-full p-4 text-2xl font-bold bg-[#1a110b] text-white rounded-xl border-2 border-stone-600 outline-none">
                       {['9단','8단','7단','6단','5단','4단','3단','2단','1단','1급','2급','3급','5급','7급','9급','13급','18급'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                 </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={handleReset} className="flex-1 py-4 bg-stone-700 text-white text-2xl font-black rounded-xl">취소</button>
                 <button onClick={submitRegister} className="flex-1 py-4 bg-green-600 text-white text-2xl font-black rounded-xl">등록하기</button>
              </div>
           </div>
        )}

        {/* 대국 신청 마법사 */}
        {kioskMode === 'match_wizard' && (
          <div className="relative z-10 w-full max-w-2xl bg-[#3a291f] p-8 rounded-[40px] shadow-2xl border-4 border-stone-700 my-6">
            <button onClick={closeMatchWizard} className="absolute top-6 right-6 text-stone-400 font-extrabold text-xl">✕ 닫기</button>
            <div className="flex gap-2 mb-8 justify-center">
              {[1, 2, 3, 4].map(step => (<div key={step} className={`h-2 w-16 rounded-full ${matchStep >= step ? 'bg-[#9a5b28]' : 'bg-stone-700'}`} />))}
            </div>

            {matchStep === 1 && (
              <div className="text-center">
                <h2 className="text-3xl font-black text-white mb-8">1. 대국 방식을 선택하세요</h2>
                <div className="grid grid-cols-2 gap-4">
                  {['랭킹전', '친선전', '페어전(2:2)', '페어전(3:3)', '페어전(4:4)'].map(type => (
                    <button key={type} onClick={() => { setMatchType(type); setMatchStep(2); }} className="py-6 bg-[#1a110b] border-2 border-stone-700 rounded-3xl text-2xl font-black text-stone-300 hover:bg-[#9a5b28] hover:text-white transition-all">
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {matchStep === 2 && (
              <div className="text-center">
                <h2 className="text-3xl font-black text-white mb-3">2. 대국자를 선택하세요</h2>
                <p className="text-[#e3c18b] mb-6 text-lg font-bold">좌측 명단을 터치하여 순서대로 팀을 채우세요.</p>
                <div className="flex gap-6">
                  <div className="flex-1 bg-[#1a110b] p-4 rounded-3xl border-2 border-stone-600">
                    <h3 className="text-2xl font-black text-stone-300 mb-4">⚫ 흑 팀</h3>
                    <div className="space-y-3 min-h-30">
                      {blackTeam.map(m => <div key={m.id} className="bg-stone-800 py-3 px-4 rounded-xl font-black text-xl text-white flex justify-between"><span>{m.name}</span><span className="text-[#e3c18b]">{m.rank}</span></div>)}
                    </div>
                  </div>
                  <div className="flex-1 bg-[#fdfbf7] p-4 rounded-3xl border-2 border-stone-300">
                    <h3 className="text-2xl font-black text-[#2c1e16] mb-4">⚪ 백 팀</h3>
                    <div className="space-y-3 min-h-30">
                      {whiteTeam.map(m => <div key={m.id} className="bg-white py-3 px-4 rounded-xl font-black text-xl text-[#2c1e16] flex justify-between border"><span>{m.name}</span><span className="text-[#9a5b28]">{m.rank}</span></div>)}
                    </div>
                  </div>
                </div>
                <button onClick={() => setMatchStep(3)} disabled={blackTeam.length === 0 || whiteTeam.length === 0} className="mt-8 w-full py-5 bg-[#9a5b28] disabled:bg-stone-700 text-white font-black text-2xl rounded-2xl">
                  다음 단계로 ➔
                </button>
              </div>
            )}

            {matchStep === 3 && (
              <div className="text-center">
                <h2 className="text-3xl font-extrabold text-white mb-6">3. 돌 가리기 방식을 선택하세요</h2>
                <div className="space-y-4">
                  <button onClick={() => { setMatchStep(4); }} className="w-full py-6 bg-[#1a110b] border-2 border-stone-700 rounded-2xl text-2xl font-black text-stone-300 hover:bg-[#9a5b28] hover:text-white">수동 (선택된 흑/백 그대로 진행)</button>
                </div>
                <button onClick={() => setMatchStep(2)} className="mt-6 text-stone-400 font-bold text-xl">⬅ 이전 단계</button>
              </div>
            )}

            {matchStep === 4 && (
              <div className="text-center">
                <h2 className="text-3xl font-black text-white mb-6">4. 치수를 설정하세요</h2>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {['호선', '정선', '접바둑'].map(type => (
                    // @ts-expect-error
                    <button key={type} onClick={() => setHandicapType(type)} className={`py-4 border-2 rounded-2xl font-black text-2xl ${handicapType === type ? 'bg-[#fdfbf7] text-[#2c1e16] border-white scale-105' : 'bg-[#1a110b] text-stone-400 border-stone-700'}`}>{type}</button>
                  ))}
                </div>
                {handicapType === '접바둑' && (
                  <div className="bg-[#1a110b] p-6 rounded-3xl border-2 border-stone-700 mb-6 flex flex-col gap-6">
                     <div className="flex justify-between items-center">
                        <span className="text-2xl font-black text-stone-300">깔아둘 돌</span>
                        <div className="flex items-center gap-4 bg-stone-800 rounded-full p-2">
                           <button onClick={() => setHandicapStones(p => p > 2 ? p - 1 : p === 2 ? 0 : 0)} className="w-12 h-12 bg-stone-700 rounded-full text-3xl font-black">-</button>
                           <span className="text-3xl font-black w-20 text-center text-[#e3c18b]">{handicapStones}점</span>
                           <button onClick={() => setHandicapStones(p => p === 0 ? 2 : p < 9 ? p + 1 : 9)} className="w-12 h-12 bg-stone-700 rounded-full text-3xl font-black">+</button>
                        </div>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-2xl font-black text-stone-300">{handicapStones === 0 ? '역덤' : '덤'}</span>
                        <div className="flex items-center gap-4 bg-stone-800 rounded-full p-2">
                           <button onClick={() => setKomi(p => p > 0.5 ? p - 1 : 0.5)} className="w-12 h-12 bg-stone-700 rounded-full text-3xl font-black">-</button>
                           <span className="text-3xl font-black w-24 text-center text-[#e3c18b]">{komi}집</span>
                           <button onClick={() => setKomi(p => p < 99.5 ? p + 1 : 99.5)} className="w-12 h-12 bg-stone-700 rounded-full text-3xl font-black">+</button>
                        </div>
                     </div>
                     {handicapStones === 0 && komi < 15 && (
                        <p className="text-red-400 font-bold text-lg bg-red-900/30 py-3 rounded-xl border border-red-500/50">⚠️ 0점 접바둑은 최소 15.5집 이상의 역덤이 필요합니다.</p>
                     )}
                  </div>
                )}
                <button onClick={submitMatch} disabled={!isHandicapValid} className="w-full py-6 bg-green-600 disabled:bg-stone-700 text-white text-3xl font-black rounded-2xl disabled:text-stone-500">✅ 대국 시작하기</button>
                <button onClick={() => setMatchStep(3)} className="mt-6 text-stone-400 font-bold text-xl">⬅ 이전 단계</button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}