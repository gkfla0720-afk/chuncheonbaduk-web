'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, Match } from '../types';
import LeftPanel from '../components/LeftPanel';

const RANKS = [
  '18급', '17급', '16급', '15급', '14급', '13급', '12급', '11급', '10급', '9급',
  '8급', '7급', '6급', '5급', '4급', '3급', '2급', '1급',
  '1단', '2단', '3단', '4단', '5단', '6단', '7단', '8단', '9단'
];

export default function KioskPage() {
  const [activeMembers, setActiveMembers] = useState<Profile[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null);
  const [message, setMessage] = useState('전화번호 뒷자리 4자리를 눌러주세요.');
  const [showMembershipGuide, setShowMembershipGuide] = useState(false);
  
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
  const [regRank, setRegRank] = useState('10급');
  
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchActiveMembers = async () => {
      const now = new Date();
      const limitTime = new Date();
      limitTime.setHours(4, 0, 0, 0); 
      if (now < limitTime) limitTime.setDate(limitTime.getDate() - 1); 

      const { data: staleData } = await supabase.from('profiles').select('id').neq('current_status', '오프라인').lt('last_check_in', limitTime.toISOString());
      if (staleData && staleData.length > 0) {
        const staleIds = staleData.map(d => d.id);
        await supabase.from('profiles').update({ current_status: '오프라인' }).in('id', staleIds);
        await supabase.from('attendance').update({ status: '귀가', checked_out_at: limitTime.toISOString() }).in('user_id', staleIds).is('checked_out_at', null);
      }

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
    setIsProcessing(false);
  };

  const handleNumberClick = (num: string) => { if (phoneNumber.length < 4) setPhoneNumber(prev => prev + num); };
  const handleDelete = () => setPhoneNumber(prev => prev.slice(0, -1));

  const handleSearchUser = async () => {
    if (isProcessing) return;
    if (phoneNumber.length !== 4) { setMessage('뒷자리를 모두 입력하세요.'); return; }
    
    setIsProcessing(true); setMessage('확인 중...');
    const { data } = await supabase.from('profiles').select('*').eq('phone_last4', phoneNumber);
    
    if (!data || data.length === 0) { setMessage('등록되지 않은 번호입니다.'); setIsProcessing(false); return; }
    if (data.length > 1) { setCandidates(data); setMessage('이름을 선택하세요.'); setIsProcessing(false); } 
    else { setConfirmUser(data[0]); setCandidates([]); setMessage(''); setIsProcessing(false); }
  };

  const handleConfirmAttendance = async () => {
    if (isProcessing || !confirmUser) return;
    setIsProcessing(true); 
    const nowISO = new Date().toISOString();
    await supabase.from('profiles').update({ current_status: '출석중', last_check_in: nowISO }).eq('id', confirmUser.id);
    await supabase.from('attendance').insert([{ user_id: confirmUser.id, status: '출석중', checked_in_at: nowISO }]);
    setRefreshTrigger(p => p + 1); 
    resetTimerRef.current = setTimeout(() => handleReset(), 3000);
  };

  const handleGoHome = async () => {
    if (isProcessing || !confirmUser) return;
    setIsProcessing(true); 
    await supabase.from('profiles').update({ current_status: '오프라인' }).eq('id', confirmUser.id);
    const { data: latestAtt } = await supabase.from('attendance').select('id').eq('user_id', confirmUser.id).is('checked_out_at', null).order('checked_in_at', { ascending: false }).limit(1);
    if (latestAtt && latestAtt.length > 0) {
      await supabase.from('attendance').update({ status: '귀가', checked_out_at: new Date().toISOString() }).eq('id', latestAtt[0].id);
    }
    setRefreshTrigger(p => p + 1);
    resetTimerRef.current = setTimeout(() => handleReset(), 3000);
  };

  const handleRankChange = (delta: number) => {
    setRegRank(prev => {
      const idx = RANKS.indexOf(prev);
      if (idx === -1) return '10급';
      const nextIdx = idx + delta;
      if (nextIdx < 0) return RANKS[0];
      if (nextIdx >= RANKS.length) return RANKS[RANKS.length - 1];
      return RANKS[nextIdx];
    });
  };

  const submitRegister = async () => {
    if (isProcessing) return;
    if (!regName || regPhone.length !== 4) { alert('이름과 번호 4자리를 모두 입력하세요.'); return; }
    setIsProcessing(true);
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
    if (isProcessing || !selectedMatch) return;
    setIsProcessing(true);
    await supabase.from('matches').update({ phase: result === '취소' ? '취소' : '종료', winner: result }).eq('id', selectedMatch.id);
    const allIds = [...selectedMatch.black_team, ...selectedMatch.white_team];
    await supabase.from('profiles').update({ current_status: '출석중' }).in('id', allIds);
    alert(result === '취소' ? '대국이 취소되었습니다.' : '대국이 정상 종료되었습니다.');
    setRefreshTrigger(p => p + 1); handleReset();
  };

  const requiredPlayerCount = matchType.includes('2:2') ? 2 : matchType.includes('3:3') ? 3 : matchType.includes('4:4') ? 4 : 1;
  const isHandicapValid = handicapType !== '접바둑' || handicapStones >= 2 || (handicapStones === 0 && komi >= 15);

  const selectMemberToTeam = (member: Profile) => {
    if (member.current_status === '대국중') {
      alert('이미 대국 중인 회원은 중복으로 신청할 수 없습니다.');
      return;
    }
    if (blackTeam.some(m => m.id === member.id) || whiteTeam.some(m => m.id === member.id)) return;

    if (blackTeam.length < requiredPlayerCount) {
      setBlackTeam([...blackTeam, member]);
      return;
    }
    if (whiteTeam.length < requiredPlayerCount) {
      setWhiteTeam([...whiteTeam, member]);
      return;
    }

    if (blackTeam.length <= whiteTeam.length) {
      setBlackTeam([...blackTeam, member]);
    } else {
      setWhiteTeam([...whiteTeam, member]);
    }
  };

  const availableMembers = activeMembers.filter(member => {
    if (member.current_status === '오프라인') return false;
    if (member.current_status === '대국중') return false;
    return !blackTeam.some(m => m.id === member.id) && !whiteTeam.some(m => m.id === member.id);
  });

  const submitMatch = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const finalHandicap = handicapType === '접바둑' ? `접바둑 ${handicapStones}점 (${handicapStones===0?'역덤':'덤'} ${komi}집)` : `${handicapType}(덤 ${handicapType==='호선'?'6.5':'0.5'}집)`;
    await supabase.from('matches').insert([{ match_type: matchType, black_team: blackTeam.map(m => m.id), white_team: whiteTeam.map(m => m.id), handicap: finalHandicap }]);
    const allIds = [...blackTeam, ...whiteTeam].map(m => m.id);
    await supabase.from('profiles').update({ current_status: '대국중' }).in('id', allIds);
    setRefreshTrigger(p => p + 1); handleReset();
  };

  return (
    <main className="relative flex flex-row w-full h-screen bg-[#dcb36c] font-sans select-none overflow-visible text-stone-900">
      
      <LeftPanel
        activeMembers={activeMembers}
        isLoadingList={isLoadingList}
        kioskMode={kioskMode}
        matchStep={matchStep}
        matchType={matchType}
        blackTeam={blackTeam}
        whiteTeam={whiteTeam}
        setBlackTeam={setBlackTeam}
        setWhiteTeam={setWhiteTeam}
        openMatchDetail={openMatchDetail}
        openProfileDetail={openProfileDetail}
      />

      <section className="w-[62%] h-full board-surface text-stone-900 flex flex-col items-center justify-center relative overflow-hidden p-6">

        {/* 💡 레이아웃 100% 최적화: 스크롤을 막기 위해 가로(flex-row) 배치 적용 */}
        {kioskMode === 'attendance' && (
          <div className="relative z-10 w-full h-full flex flex-row items-center justify-center gap-8 xl:gap-12 px-2">
            
            {/* 중앙: 콤팩트하고 세련된 입력 키패드 영역 */}
            <div className="flex flex-col items-center w-full max-w-[420px]">
              <h2 className="text-4xl xl:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-[0_3px_12px_rgba(0,0,0,0.7)]">입장 / 귀가</h2>
              <p className="text-lg xl:text-xl font-extrabold h-8 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)] mb-2">{message}</p>

              {confirmUser ? (
                <div className="bg-[#1a1411]/85 p-8 rounded-[2.5rem] border-4 border-[#e8d5b5]/70 shadow-[0_15px_35px_rgba(0,0,0,0.4)] text-center w-full text-white backdrop-blur-sm">
                  <h2 className="text-4xl font-black mb-2 text-[#e8d5b5]">{confirmUser.name}</h2>
                  <p className="text-stone-300 text-xl font-extrabold mb-8">{confirmUser.rank} / {confirmUser.tier}</p>
                  {confirmUser.current_status !== '오프라인' ? (
                    <button onClick={handleGoHome} disabled={isProcessing} className="w-full py-5 bg-[#332a24] border-2 border-[#dcb36c] text-[#dcb36c] hover:bg-[#dcb36c] hover:text-stone-900 font-black rounded-2xl text-2xl shadow-xl transition-all disabled:opacity-50">
                      {isProcessing ? '처리중...' : '귀가하기 (퇴장)'}
                    </button>
                  ) : (
                    <button onClick={handleConfirmAttendance} disabled={isProcessing} className="w-full py-5 bg-white text-stone-900 hover:bg-stone-100 font-black rounded-2xl text-2xl shadow-xl transition-all disabled:opacity-50">
                      {isProcessing ? '처리중...' : '출석하기 (입장)'}
                    </button>
                  )}
                  <button onClick={handleReset} className="w-full mt-4 py-3 text-stone-400 hover:text-white font-bold text-lg">취소</button>
                </div>
              ) : candidates.length > 0 ? (
                <div className="bg-[#1a1411]/85 p-6 rounded-[2.5rem] shadow-[0_15px_35px_rgba(0,0,0,0.35)] space-y-3 w-full border-2 border-stone-700/80 backdrop-blur-sm">
                  <p className="text-center text-[#e8d5b5] font-bold text-lg mb-4">본인의 이름을 선택해주세요</p>
                  {candidates.map((cand) => (
                    <button key={cand.id} onClick={() => { setConfirmUser(cand); setCandidates([]); }} className="w-full py-4 bg-white text-stone-900 rounded-2xl text-xl font-extrabold shadow-md flex justify-between px-6 items-center hover:bg-stone-100">
                      <span>{cand.name}</span><span className="text-base bg-[#dcb36c] px-3 py-1 rounded-lg text-stone-900 font-black">{cand.rank}</span>
                    </button>
                  ))}
                  <button onClick={handleReset} className="w-full py-3 text-stone-400 font-bold text-lg mt-2">다시 입력하기</button>
                </div>
              ) : (
                <div className="bg-[#1a1411]/85 p-6 xl:p-8 rounded-[2.5rem] shadow-[0_15px_35px_rgba(0,0,0,0.35)] w-full border-4 border-stone-700/80 backdrop-blur-sm">
                  <div className="bg-[#120f0d] border border-stone-700 rounded-2xl h-16 xl:h-20 flex items-center justify-center mb-6 shadow-inner">
                    <span className="text-4xl xl:text-5xl font-mono tracking-[0.4em] text-[#e8d5b5] font-black">{phoneNumber.padEnd(4, '—')}</span>
                  </div>
                  {/* 숫자버튼 겹침을 방지하기 위해 80px(w-20) 고정 사이즈 적용 */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                      <button key={num} onClick={() => handleNumberClick(num)} className="w-20 h-20 mx-auto rounded-full bg-white text-stone-900 text-4xl font-black shadow-[0_5px_0_#999] active:translate-y-1 active:shadow-none flex items-center justify-center transition-all">{num}</button>
                    ))}
                    <button onClick={handleDelete} className="w-20 h-20 mx-auto rounded-full bg-[#332a24] text-[#e8d5b5] text-xl font-black shadow-[0_5px_0_#1a1512] active:translate-y-1 flex items-center justify-center">지움</button>
                    <button onClick={() => handleNumberClick('0')} className="w-20 h-20 mx-auto rounded-full bg-white text-stone-900 text-4xl font-black shadow-[0_5px_0_#999] active:translate-y-1 active:shadow-none flex items-center justify-center transition-all">0</button>
                    <button onClick={handleReset} className="w-20 h-20 mx-auto rounded-full bg-[#332a24] text-stone-400 text-xl font-black shadow-[0_5px_0_#1a1512] active:translate-y-1 flex items-center justify-center">취소</button>
                  </div>
                  <button onClick={handleSearchUser} disabled={isProcessing} className="w-full py-5 bg-[#b88c42] hover:bg-[#a37934] text-stone-950 text-2xl xl:text-3xl font-black rounded-2xl shadow-[0_5px_0_#755520] active:translate-y-1 transition-all disabled:opacity-50">
                    {isProcessing ? '확인 중...' : '확인 (입력완료)'}
                  </button>
                </div>
              )}
            </div>

            {/* 우측: 여백 공간을 활용한 큼직한 액션 버튼 */}
            <div className="flex flex-col gap-6 w-64 xl:w-72 shrink-0">
               <button onClick={() => setShowMembershipGuide(true)} className="w-full bg-[#f7f0e5] hover:bg-[#efe1cb] text-stone-900 font-extrabold py-4 rounded-[18px] shadow-[0_10px_18px_rgba(25,18,12,0.12)] text-lg transition-all border border-[#c69b5c] tracking-[0.02em]">
                 정회원 달성 조건
               </button>
               <button onClick={() => setKioskMode('register')} className="w-full bg-[#f8f5f1] hover:bg-[#f1e7d8] text-stone-900 font-black py-7 rounded-[24px] shadow-[0_12px_24px_rgba(25,18,12,0.18)] text-2xl xl:text-3xl transition-all border-2 border-[#c69b5c] flex items-center justify-center gap-3 tracking-[0.02em]">
                 <span>📝</span> 신규 가입
               </button>
               <button onClick={openMatchWizard} className="w-full bg-[#1e1a17] hover:bg-[#2b231e] text-[#efdfba] font-black py-7 rounded-[24px] shadow-[0_12px_24px_rgba(25,18,12,0.2)] text-2xl xl:text-3xl transition-all border-2 border-[#b88c42] flex items-center justify-center gap-3 tracking-[0.02em]">
                 <span>⚔️</span> 대국 신청
               </button>
            </div>
          </div>
        )}
      </section>

      {showMembershipGuide && (
        <div className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]">
          <div className="modal-card w-full max-w-lg rounded-[30px] border border-[#d4c3a2] bg-[#f8f4ee] p-6 shadow-[0_18px_45px_rgba(34,27,20,0.28)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.18em] text-[#7e5d3d]">회원 등급</p>
                <h3 className="mt-2 text-2xl font-black text-[#2a241d]">정회원 달성 조건</h3>
              </div>
              <button onClick={() => setShowMembershipGuide(false)} className="rounded-full bg-stone-200 px-3 py-1 text-xs font-bold text-stone-700 transition hover:bg-stone-300">닫기</button>
            </div>

            <div className="mt-5 rounded-[24px] border border-[#d9cab0] bg-[#f3ebdf] p-5">
              <p className="text-base leading-7 text-stone-700">
                정회원은 <span className="font-black text-[#8a5a2b]">기원 방문 10회 이상</span>과 <span className="font-black text-[#8a5a2b]">대국 10회 이상</span>을 충족한 회원에게 자동으로 승격됩니다.
              </p>
              <ul className="mt-4 space-y-3 text-sm text-stone-700">
                <li className="flex items-start gap-2"><span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#8a5a2b]" /> 방문 기록과 대국 기록이 누적되면 자동으로 정회원으로 인정됩니다.</li>
                <li className="flex items-start gap-2"><span className="mt-1 inline-block h-2 w-2 rounded-full bg-[#8a5a2b]" /> 승격 조건을 충족한 회원은 등급이 자연스럽게 정회원으로 바뀝니다.</li>
              </ul>
            </div>

            <button onClick={() => setShowMembershipGuide(false)} className="mt-5 w-full rounded-2xl bg-[#2a241d] py-3 text-base font-bold text-[#f8f3eb] transition hover:bg-[#1f1b18]">
              확인
            </button>
          </div>
        </div>
      )}

      {kioskMode === 'profile_detail' && selectedProfile && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]">
          <div className="modal-card w-full max-w-2xl bg-[#1f1a16] text-white p-10 rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.28)] border-4 border-[#b88c42] text-center">
            <h2 className="text-3xl font-black text-[#e8d5b5] mb-1">회원 기력 및 프로필</h2>
            <p className="text-stone-400 font-semibold mb-6">가입일: {profileStats.joinedAt}</p>
            <div className="bg-[#120f0d] p-8 rounded-3xl mb-8 border border-stone-800 shadow-inner">
               <h3 className="text-5xl font-black text-white mb-2">{selectedProfile.name}</h3>
               <p className="text-2xl font-extrabold text-[#dcb36c] mb-8">{selectedProfile.rank} / {selectedProfile.tier}</p>
               {isLoadingStats ? (
                 <p className="text-stone-400 font-bold py-8 animate-pulse text-lg">전적 데이터를 집계하는 중...</p>
               ) : (
                 <div className="grid grid-cols-2 gap-5">
                    <div className="bg-[#241f1b] p-5 rounded-2xl border border-stone-700">
                       <p className="text-stone-400 text-sm font-bold mb-2">대국 통산 전적</p>
                       <p className="text-3xl font-black"><span className="text-blue-400">{profileStats.wins}승</span> <span className="text-red-400">{profileStats.losses}패</span></p>
                       <p className="text-stone-400 text-sm font-bold mt-2">승률 {profileStats.wins + profileStats.losses > 0 ? Math.round((profileStats.wins / (profileStats.wins + profileStats.losses)) * 100) : 0}%</p>
                    </div>
                    <div className="bg-[#241f1b] p-5 rounded-2xl border border-stone-700 flex flex-col justify-center items-center">
                       <p className="text-stone-400 text-sm font-bold mb-2">최근 30일 출석률</p>
                       <p className="text-4xl font-black text-[#dcb36c]">{profileStats.attendanceRate}%</p>
                    </div>
                 </div>
               )}
            </div>
            <button onClick={handleReset} className="w-full py-5 bg-[#b88c42] hover:bg-[#a37934] text-stone-950 text-2xl font-black rounded-2xl shadow-xl transition-all">확인 (닫기)</button>
          </div>
        </div>
      )}

      {kioskMode === 'match_detail' && selectedMatch && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]">
          <div className="modal-card w-full max-w-2xl bg-[#1f1a16] text-white p-10 rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.28)] border-4 border-[#b88c42] text-center">
            <h2 className="text-3xl font-black text-white mb-6">진행 중인 대국 관리</h2>
            <div className="bg-[#120f0d] p-6 rounded-3xl mb-8 flex flex-col gap-2 border border-stone-800">
               <p className="text-2xl font-extrabold text-[#dcb36c]">{selectedMatch.match_type} / {selectedMatch.handicap}</p>
               <p className="text-lg font-bold text-stone-400">대국 경과 시간: <span className="text-white text-3xl ml-2 font-mono">{matchElapsed}</span></p>
            </div>
            {!confirmAction ? (
              <div className="grid grid-cols-2 gap-5 mb-6">
                <button onClick={() => setConfirmAction('black_win')} className="py-6 bg-stone-900 border-2 border-stone-600 text-white text-3xl font-black rounded-3xl hover:bg-black transition-all shadow-lg">⚫ 흑승</button>
                <button onClick={() => setConfirmAction('white_win')} className="py-6 bg-white border-2 border-stone-300 text-stone-900 text-3xl font-black rounded-3xl hover:bg-stone-100 transition-all shadow-lg">⚪ 백승</button>
                <button onClick={() => setConfirmAction('cancel')} className="col-span-2 py-4 bg-red-950/60 text-red-400 text-xl font-bold rounded-2xl hover:bg-red-900 hover:text-white border border-red-800 transition-all">대국 취소 (무효)</button>
              </div>
            ) : (
              <div className="bg-red-950/40 p-6 rounded-3xl mb-6 border border-red-500/50">
                 <h3 className="text-2xl font-black text-white mb-6">{confirmAction === 'black_win' && '⚫ 흑 팀의 승리로 확정할까요?'}{confirmAction === 'white_win' && '⚪ 백 팀의 승리로 확정할까요?'}{confirmAction === 'cancel' && '정말 대국을 무효 처리할까요?'}</h3>
                 <div className="flex gap-4">
                    <button onClick={() => setConfirmAction(null)} className="flex-1 py-4 bg-stone-700 text-white text-xl font-black rounded-xl">돌아가기</button>
                    <button onClick={() => endMatch(confirmAction === 'cancel' ? '취소' : confirmAction === 'black_win' ? '흑승' : '백승')} disabled={isProcessing} className="flex-1 py-4 bg-green-700 hover:bg-green-600 text-white text-xl font-black rounded-xl disabled:opacity-50 transition-all">
                      {isProcessing ? '처리중' : '확정'}
                    </button>
                 </div>
              </div>
            )}
            <button onClick={handleReset} className="w-full py-4 text-stone-400 hover:text-white font-bold text-lg bg-stone-900 rounded-2xl">닫기</button>
          </div>
        </div>
      )}

      {kioskMode === 'register' && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]">
          <div className="modal-card w-full max-w-xl bg-[#1f1a16] text-white p-10 rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.28)] border-4 border-[#b88c42] text-center">
            <h2 className="text-3xl font-black text-[#e8d5b5] mb-6">📝 신규 회원 등록</h2>
            <div className="space-y-5 text-left">
              <div>
                <label className="text-stone-300 text-sm font-bold mb-1.5 block">회원 성함</label>
                <input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full p-4 text-2xl font-bold bg-[#120f0d] text-white rounded-2xl border-2 border-stone-700 focus:border-[#dcb36c] outline-none" placeholder="홍길동" />
              </div>
              <div>
                <label className="text-stone-300 text-sm font-bold mb-1.5 block">전화번호 뒷자리 4개 (출석용)</label>
                <input type="number" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full p-4 text-2xl font-bold bg-[#120f0d] text-white rounded-2xl border-2 border-stone-700 focus:border-[#dcb36c] outline-none" placeholder="1234" />
              </div>
              <div>
                <label className="text-stone-300 text-sm font-bold mb-1.5 block">기력 (급/단)</label>
                <div className="flex justify-between items-center bg-[#120f0d] p-3 rounded-2xl border-2 border-stone-700">
                  <button onClick={() => handleRankChange(-1)} className="w-14 h-14 bg-stone-800 rounded-full text-3xl font-black text-white hover:bg-stone-700 transition-colors">-</button>
                  <span className="text-3xl font-black w-28 text-center text-[#dcb36c]">{regRank}</span>
                  <button onClick={() => handleRankChange(1)} className="w-14 h-14 bg-stone-800 rounded-full text-3xl font-black text-white hover:bg-stone-700 transition-colors">+</button>
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={handleReset} className="flex-1 py-4 bg-stone-800 text-stone-300 text-xl font-black rounded-2xl hover:bg-stone-700">취소</button>
              <button onClick={submitRegister} disabled={isProcessing} className="flex-1 py-4 bg-[#b88c42] hover:bg-[#a37934] text-stone-950 text-xl font-black rounded-2xl disabled:opacity-50 transition-all">
                {isProcessing ? '등록중' : '등록 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {kioskMode === 'match_wizard' && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]">
          <div className="modal-card w-full max-w-3xl bg-[#1f1a16] text-white p-10 rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.28)] border-4 border-[#b88c42]">
            <button onClick={closeMatchWizard} className="absolute top-6 right-6 text-stone-400 hover:text-white font-extrabold text-2xl">✕</button>
            <div className="flex gap-3 mb-8 justify-center">
              {[1, 2, 3, 4].map(step => (<div key={step} className={`h-2.5 w-16 rounded-full ${matchStep >= step ? 'bg-[#dcb36c]' : 'bg-stone-800'}`} />))}
            </div>

            {matchStep === 1 && (
              <div className="text-center">
                <h2 className="text-3xl font-black text-white mb-8">1. 대국 방식을 선택하세요</h2>
                <div className="grid grid-cols-2 gap-4">
                  {['랭킹전', '친선전', '페어전(2:2)', '페어전(3:3)', '페어전(4:4)'].map(type => (
                    <button key={type} onClick={() => { setMatchType(type); setMatchStep(2); }} className="py-6 bg-[#120f0d] border-2 border-stone-700 rounded-3xl text-2xl font-black text-stone-200 hover:bg-[#b88c42] hover:text-stone-950 hover:border-[#b88c42] transition-all shadow-md">
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {matchStep === 2 && (
              <div className="text-center">
                <h2 className="text-3xl font-black text-white mb-2">2. 대국자를 선택하세요</h2>
                <p className="text-[#dcb36c] mb-6 text-base font-bold">아래 목록에서 참가자를 선택하면 자동으로 흑/백 팀에 배치됩니다.</p>
                <div className="flex gap-5 items-start">
                  <div className="w-[32%] min-w-[220px] bg-[#120f0d] p-4 rounded-3xl border-2 border-stone-700 shadow-inner">
                    <h3 className="text-xl font-black text-white mb-4 border-b border-stone-800 pb-2">참가 인원</h3>
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {availableMembers.length === 0 ? (
                        <p className="text-stone-500 pt-8 text-sm">선택 가능한 인원이 없습니다.</p>
                      ) : (
                        availableMembers.map(member => (
                          <button
                            key={member.id}
                            onClick={() => selectMemberToTeam(member)}
                            className="w-full flex items-center justify-between rounded-2xl border border-stone-700 bg-[#1b1714] px-3 py-2 text-left transition hover:border-[#dcb36c] hover:bg-[#2b221d]"
                          >
                            <span className="text-base font-black text-white">{member.name}</span>
                            <span className="rounded-md bg-[#dcb36c] px-2 py-1 text-xs font-black text-stone-900">{member.rank}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex gap-4">
                    <div className="flex-1 bg-stone-900 p-5 rounded-3xl border-2 border-stone-700 shadow-inner">
                      <h3 className="text-2xl font-black text-white mb-4 border-b border-stone-800 pb-2">⚫ 흑 팀</h3>
                      <div className="space-y-3 min-h-[140px]">
                        {blackTeam.map(m => (
                          <div key={m.id} onClick={() => setBlackTeam(prev => prev.filter(p => p.id !== m.id))} className="bg-black/60 py-3 px-4 rounded-xl font-black text-xl text-white flex justify-between border border-stone-800 cursor-pointer hover:bg-red-900/80 transition-colors group">
                            <span>{m.name}</span>
                            <span className="text-[#dcb36c] group-hover:text-white">{m.rank} <span className="ml-2 text-red-400 group-hover:text-white">✕</span></span>
                          </div>
                        ))}
                        {blackTeam.length === 0 && <p className="text-stone-500 pt-8 text-sm">선수명을 선택해 주세요</p>}
                      </div>
                    </div>

                    <div className="flex-1 bg-white text-stone-900 p-5 rounded-3xl border-2 border-stone-300 shadow-inner">
                      <h3 className="text-2xl font-black text-stone-900 mb-4 border-b border-stone-200 pb-2">⚪ 백 팀</h3>
                      <div className="space-y-3 min-h-[140px]">
                        {whiteTeam.map(m => (
                          <div key={m.id} onClick={() => setWhiteTeam(prev => prev.filter(p => p.id !== m.id))} className="bg-stone-50 py-3 px-4 rounded-xl font-black text-xl text-stone-900 flex justify-between border border-stone-300 cursor-pointer hover:bg-red-100 transition-colors group">
                            <span>{m.name}</span>
                            <span className="text-[#8a5a20] group-hover:text-red-500">{m.rank} <span className="ml-2 text-red-500">✕</span></span>
                          </div>
                        ))}
                        {whiteTeam.length === 0 && <p className="text-stone-400 pt-8 text-sm">백 팀도 같은 방식으로 선택</p>}
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => setMatchStep(3)} disabled={blackTeam.length === 0 || whiteTeam.length === 0} className="mt-8 w-full py-5 bg-[#b88c42] hover:bg-[#a37934] disabled:bg-stone-800 text-stone-950 font-black text-2xl rounded-2xl transition-all">
                  다음 단계로 ➔
                </button>
              </div>
            )}

            {matchStep === 3 && (
              <div className="text-center">
                <h2 className="text-3xl font-black text-white mb-8">3. 돌 가리기 방식을 선택하세요</h2>
                <div className="space-y-4">
                  <button onClick={() => { setMatchStep(4); }} className="w-full py-6 bg-[#120f0d] border-2 border-stone-700 rounded-3xl text-2xl font-black text-stone-200 hover:bg-[#b88c42] hover:text-stone-950 hover:border-[#b88c42] transition-all">수동 (선택된 흑/백 순서대로 진행)</button>
                </div>
                <button onClick={() => setMatchStep(2)} className="mt-6 text-stone-400 hover:text-white font-bold text-lg">⬅ 이전 단계</button>
              </div>
            )}

            {matchStep === 4 && (
              <div className="text-center">
                <h2 className="text-3xl font-black text-white mb-6">4. 치수를 설정하세요</h2>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {(['호선', '정선', '접바둑'] as const).map(type => (
                    <button key={type} onClick={() => setHandicapType(type)} className={`py-4 border-2 rounded-2xl font-black text-2xl transition-all ${handicapType === type ? 'bg-white text-stone-900 border-white scale-105 shadow-xl' : 'bg-[#120f0d] text-stone-400 border-stone-700'}`}>{type}</button>
                  ))}
                </div>
                {handicapType === '접바둑' && (
                  <div className="bg-[#120f0d] p-6 rounded-3xl border-2 border-stone-800 mb-6 flex flex-col gap-5">
                     <div className="flex justify-between items-center px-2">
                        <span className="text-xl font-black text-stone-300">깔아둘 돌</span>
                        <div className="flex items-center gap-3 bg-stone-900 rounded-full p-1.5 border border-stone-700">
                           <button onClick={() => setHandicapStones(p => p > 2 ? p - 1 : p === 2 ? 0 : 0)} className="w-12 h-12 bg-stone-800 rounded-full text-2xl font-black hover:bg-stone-700 transition-colors">-</button>
                           <span className="text-2xl font-black w-16 text-center text-[#dcb36c]">{handicapStones}점</span>
                           <button onClick={() => setHandicapStones(p => p === 0 ? 2 : p < 9 ? p + 1 : 9)} className="w-12 h-12 bg-stone-800 rounded-full text-2xl font-black hover:bg-stone-700 transition-colors">+</button>
                        </div>
                     </div>
                     <div className="flex justify-between items-center px-2">
                        <span className="text-xl font-black text-stone-300">{handicapStones === 0 ? '역덤' : '덤'}</span>
                        <div className="flex items-center gap-3 bg-stone-900 rounded-full p-1.5 border border-stone-700">
                           <button onClick={() => setKomi(p => p > 0.5 ? p - 1 : 0.5)} className="w-12 h-12 bg-stone-800 rounded-full text-2xl font-black hover:bg-stone-700 transition-colors">-</button>
                           <span className="text-2xl font-black w-24 text-center text-[#dcb36c]">{komi}집</span>
                           <button onClick={() => setKomi(p => p < 99.5 ? p + 1 : 99.5)} className="w-12 h-12 bg-stone-800 rounded-full text-2xl font-black hover:bg-stone-700 transition-colors">+</button>
                        </div>
                     </div>
                     {handicapStones === 0 && komi < 15 && (
                        <p className="text-red-400 font-bold text-sm bg-red-950/40 py-2.5 rounded-xl border border-red-500/50">⚠️ 0점 접바둑은 최소 15.5집 이상의 역덤이 필요합니다.</p>
                     )}
                  </div>
                )}
                <button onClick={submitMatch} disabled={!isHandicapValid || isProcessing} className="w-full py-5 bg-green-700 hover:bg-green-600 disabled:bg-stone-800 text-white text-2xl font-black rounded-2xl disabled:text-stone-600 transition-all shadow-xl">
                  {isProcessing ? '처리중' : '✅ 대국 시작하기'}
                </button>
                <button onClick={() => setMatchStep(3)} className="mt-4 text-stone-400 hover:text-white font-bold text-lg">⬅ 이전 단계</button>
              </div>
            )}

          </div>
        </div>
      )}
    </main>
  );
}