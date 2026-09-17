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

  const isHandicapValid = handicapType !== '접바둑' || handicapStones >= 2 || (handicapStones === 0 && komi >= 15);

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
    <main className="flex flex-row w-full h-screen bg-[#e3c18b] font-sans select-none overflow-hidden text-slate-900">
      
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

      <section className="w-[60%] h-full bg-[#2c1e16] text-[#fdfbf7] flex flex-col items-center justify-center relative overflow-y-auto custom-scrollbar">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fdfbf7 2px, transparent 2px), linear-gradient(90deg, #fdfbf7 2px, transparent 2px)', backgroundSize: '60px 60px' }}></div>

        {/* 💡 새로운 레이아웃: 키패드는 가운데-좌측, 액션 버튼은 우측에 큼직하게 배치 */}
        {kioskMode === 'attendance' && (
          <div className="relative z-10 w-full flex flex-row items-center justify-center gap-12 px-8">
            
            {/* 1. 입장/귀가 키패드 영역 */}
            <div className="flex flex-col items-center w-full max-w-sm">
              <h2 className="text-4xl font-black text-[#fdfbf7] tracking-tight mb-2">입장 / 귀가</h2>
              <p className="text-lg font-bold h-6 text-[#e3c18b] mb-6">{message}</p>

              {confirmUser ? (
                <div className="bg-[#3a291f] p-8 rounded-4xl border-4 border-[#9a5b28] shadow-2xl text-center w-full">
                  <h2 className="text-4xl font-black text-[#fdfbf7] mb-2">{confirmUser.name}</h2>
                  <p className="text-[#e3c18b] text-xl font-extrabold mb-8">{confirmUser.rank} / {confirmUser.tier}</p>
                  {confirmUser.current_status !== '오프라인' ? (
                    <button onClick={handleGoHome} disabled={isProcessing} className="w-full py-5 bg-[#1a110b] border-4 border-[#e3c18b] text-[#e3c18b] font-black rounded-2xl text-2xl shadow-xl disabled:opacity-50">
                      {isProcessing ? '처리중...' : '귀가하기 (퇴장)'}
                    </button>
                  ) : (
                    <button onClick={handleConfirmAttendance} disabled={isProcessing} className="w-full py-5 bg-[#fdfbf7] text-[#2c1e16] font-black rounded-2xl text-2xl shadow-xl disabled:opacity-50">
                      {isProcessing ? '처리중...' : '출석하기 (입장)'}
                    </button>
                  )}
                  <button onClick={handleReset} className="w-full mt-4 py-3 text-stone-400 font-bold text-lg">취소</button>
                </div>
              ) : candidates.length > 0 ? (
                <div className="bg-[#3a291f] p-6 rounded-4xl shadow-2xl space-y-3 w-full">
                  <p className="text-center text-[#e3c18b] font-bold text-lg mb-4">본인의 이름을 선택해주세요</p>
                  {candidates.map((cand) => (
                    <button key={cand.id} onClick={() => { setConfirmUser(cand); setCandidates([]); }} className="w-full py-4 bg-[#fdfbf7] text-[#2c1e16] rounded-2xl text-xl font-extrabold shadow-lg flex justify-between px-6 items-center">
                      <span>{cand.name}</span><span className="text-base bg-[#e3c18b] px-3 py-1 rounded-lg text-[#2c1e16]">{cand.rank}</span>
                    </button>
                  ))}
                  <button onClick={handleReset} className="w-full py-3 text-stone-400 font-bold text-lg mt-2">다시 입력하기</button>
                </div>
              ) : (
                <div className="bg-[#3a291f] p-8 rounded-4xl shadow-2xl w-full">
                  <div className="bg-[#1a110b] border-2 border-stone-800 rounded-2xl h-16 flex items-center justify-center mb-6 shadow-inner">
                    <span className="text-4xl font-mono tracking-[0.4em] text-[#e3c18b] font-black">{phoneNumber.padEnd(4, '—')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                      <button key={num} onClick={() => handleNumberClick(num)} className="w-20 h-20 mx-auto rounded-full bg-[#fdfbf7] text-[#2c1e16] text-4xl font-black shadow-[0_6px_0_#d1c8b8] active:translate-y-1.5 active:shadow-none flex items-center justify-center transition-transform">{num}</button>
                    ))}
                    <button onClick={handleDelete} className="w-20 h-20 mx-auto rounded-full bg-[#1a110b] border-4 border-stone-700 text-[#e3c18b] text-xl font-black shadow-[0_6px_0_#000] active:translate-y-1.5 flex items-center justify-center">지움</button>
                    <button onClick={() => handleNumberClick('0')} className="w-20 h-20 mx-auto rounded-full bg-[#fdfbf7] text-[#2c1e16] text-4xl font-black shadow-[0_6px_0_#d1c8b8] active:translate-y-1.5 flex items-center justify-center">0</button>
                    <button onClick={handleReset} className="w-20 h-20 mx-auto rounded-full bg-[#1a110b] border-4 border-stone-700 text-stone-400 text-xl font-black shadow-[0_6px_0_#000] active:translate-y-1.5 flex items-center justify-center">취소</button>
                  </div>
                  <button onClick={handleSearchUser} disabled={isProcessing} className="w-full py-4 bg-[#9a5b28] text-white text-2xl font-black rounded-2xl shadow-[0_6px_0_#5c3516] active:translate-y-1.5 transition-transform disabled:opacity-50">
                    {isProcessing ? '확인 중...' : '확인'}
                  </button>
                </div>
              )}
            </div>

            {/* 2. 우측 상단 액션 버튼 영역 */}
            <div className="flex flex-col gap-6 w-56 shrink-0 pb-10">
               <button onClick={() => setKioskMode('register')} className="w-full bg-stone-700 hover:bg-stone-600 text-white font-extrabold py-6 rounded-3xl shadow-xl text-2xl transition-all border-2 border-stone-500 hover:border-stone-400">📝 신규 가입</button>
               <button onClick={openMatchWizard} className="w-full bg-[#9a5b28] hover:bg-[#854d20] text-white font-extrabold py-6 rounded-3xl shadow-xl text-2xl transition-all border-2 border-[#b46a30] hover:border-[#d98542]">⚔️ 대국 신청</button>
            </div>

          </div>
        )}

        {/* 회원 프로필 상세 보기 모드 */}
        {kioskMode === 'profile_detail' && selectedProfile && (
          <div className="relative z-10 w-full max-w-md bg-[#3a291f] p-8 rounded-4xl shadow-2xl border-4 border-stone-700 text-center">
            <h2 className="text-3xl font-black text-white mb-2">회원 프로필</h2>
            <p className="text-stone-400 font-bold mb-6">가입일: {profileStats.joinedAt}</p>
            
            <div className="bg-[#1a110b] p-6 rounded-3xl mb-6 border-2 border-stone-800">
               <h3 className="text-4xl font-black text-[#fdfbf7] mb-2">{selectedProfile.name}</h3>
               <p className="text-xl font-extrabold text-[#e3c18b] mb-6">{selectedProfile.rank} / {selectedProfile.tier}</p>
               
               {isLoadingStats ? (
                 <p className="text-stone-400 font-bold py-6 animate-pulse">전적 데이터를 불러오는 중...</p>
               ) : (
                 <div className="grid grid-cols-2 gap-3">
                    <div className="bg-stone-800 p-4 rounded-xl border border-stone-700">
                       <p className="text-stone-400 text-xs font-bold mb-1">통산 전적</p>
                       <p className="text-2xl font-black text-white">
                         <span className="text-blue-400">{profileStats.wins}승</span> <span className="text-red-400">{profileStats.losses}패</span>
                       </p>
                       <p className="text-stone-500 text-xs font-bold mt-1">승률: {profileStats.wins + profileStats.losses > 0 ? Math.round((profileStats.wins / (profileStats.wins + profileStats.losses)) * 100) : 0}%</p>
                    </div>
                    <div className="bg-stone-800 p-4 rounded-xl border border-stone-700 flex flex-col justify-center items-center">
                       <p className="text-stone-400 text-xs font-bold mb-1">최근 30일 출석률</p>
                       <p className="text-3xl font-black text-[#e3c18b]">{profileStats.attendanceRate}%</p>
                    </div>
                 </div>
               )}
            </div>
            <button onClick={handleReset} className="w-full py-4 bg-[#9a5b28] hover:bg-[#854d20] text-white text-2xl font-black rounded-xl shadow-xl transition-all">
              확인 (닫기)
            </button>
          </div>
        )}

        {/* 대국 상세 (종료 및 취소) 모드 */}
        {kioskMode === 'match_detail' && selectedMatch && (
          <div className="relative z-10 w-full max-w-lg bg-[#3a291f] p-8 rounded-4xl shadow-2xl border-4 border-stone-700 text-center">
            <h2 className="text-3xl font-black text-white mb-6">진행 중인 대국 관리</h2>
            <div className="bg-[#1a110b] p-6 rounded-2xl mb-6 flex flex-col gap-2 border-2 border-stone-800">
               <p className="text-xl font-extrabold text-[#e3c18b]">{selectedMatch.match_type} / {selectedMatch.handicap}</p>
               <p className="text-lg font-bold text-stone-400">경과 시간: <span className="text-white text-2xl">{matchElapsed}</span></p>
            </div>

            {!confirmAction ? (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button onClick={() => setConfirmAction('black_win')} className="py-5 bg-stone-900 border-4 border-stone-600 text-white text-2xl font-black rounded-2xl hover:bg-stone-800">⚫ 흑 승리</button>
                <button onClick={() => setConfirmAction('white_win')} className="py-5 bg-[#fdfbf7] border-4 border-stone-300 text-[#2c1e16] text-2xl font-black rounded-2xl hover:bg-white">⚪ 백 승리</button>
                <button onClick={() => setConfirmAction('cancel')} className="col-span-2 py-3 bg-red-900/50 text-red-400 text-lg font-extrabold rounded-xl hover:bg-red-800 hover:text-white border-2 border-red-800">대국 무효 (취소하기)</button>
              </div>
            ) : (
              <div className="bg-red-950/40 p-6 rounded-2xl mb-6 border-2 border-red-500/50">
                 <h3 className="text-2xl font-black text-white mb-6">
                   {confirmAction === 'black_win' && '⚫ 흑 팀의 승리로 기록할까요?'}
                   {confirmAction === 'white_win' && '⚪ 백 팀의 승리로 기록할까요?'}
                   {confirmAction === 'cancel' && '정말 대국을 취소할까요?'}
                 </h3>
                 <div className="flex gap-4">
                    <button onClick={() => setConfirmAction(null)} className="flex-1 py-4 bg-stone-700 text-white text-xl font-black rounded-xl">아니오</button>
                    <button onClick={() => endMatch(confirmAction === 'cancel' ? '취소' : confirmAction === 'black_win' ? '흑승' : '백승')} disabled={isProcessing} className="flex-1 py-4 bg-green-600 text-white text-xl font-black rounded-xl disabled:opacity-50">
                      {isProcessing ? '처리중' : '예, 확정'}
                    </button>
                 </div>
              </div>
            )}
            <button onClick={handleReset} className="w-full py-3 text-stone-400 font-bold text-lg hover:text-white mt-2 bg-stone-900/50 rounded-xl">닫기</button>
          </div>
        )}

        {/* 회원 가입 폼 */}
        {kioskMode === 'register' && (
           <div className="relative z-10 w-full max-w-md bg-[#3a291f] p-8 rounded-4xl shadow-2xl border-4 border-stone-700 text-center">
              <h2 className="text-3xl font-black text-white mb-6">📝 신규 회원 등록</h2>
              <div className="space-y-4 text-left">
                 <div>
                    <label className="text-stone-400 text-sm font-bold mb-1 block">이름 (실명)</label>
                    <input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full p-4 text-xl font-bold bg-[#1a110b] text-white rounded-xl border-2 border-stone-600 focus:border-[#e3c18b] outline-none" placeholder="홍길동" />
                 </div>
                 <div>
                    <label className="text-stone-400 text-sm font-bold mb-1 block">전화번호 뒷자리 4개 (출석용)</label>
                    <input type="number" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full p-4 text-xl font-bold bg-[#1a110b] text-white rounded-xl border-2 border-stone-600 focus:border-[#e3c18b] outline-none" placeholder="1234" />
                 </div>
                 <div>
                    <label className="text-stone-400 text-sm font-bold mb-1 block">현재 기력 (급/단)</label>
                    <div className="flex justify-between items-center bg-[#1a110b] p-3 rounded-xl border-2 border-stone-600">
                       <button onClick={() => handleRankChange(-1)} className="w-12 h-12 bg-stone-700 rounded-full text-2xl font-black text-white hover:bg-stone-600 transition-colors">-</button>
                       <span className="text-2xl font-black w-24 text-center text-[#e3c18b]">{regRank}</span>
                       <button onClick={() => handleRankChange(1)} className="w-12 h-12 bg-stone-700 rounded-full text-2xl font-black text-white hover:bg-stone-600 transition-colors">+</button>
                    </div>
                 </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={handleReset} className="flex-1 py-4 bg-stone-700 text-white text-xl font-black rounded-xl">취소</button>
                 <button onClick={submitRegister} disabled={isProcessing} className="flex-1 py-4 bg-green-600 text-white text-xl font-black rounded-xl disabled:opacity-50">
                    {isProcessing ? '등록중' : '등록하기'}
                 </button>
              </div>
           </div>
        )}

        {/* 대국 신청 마법사 */}
        {kioskMode === 'match_wizard' && (
          <div className="relative z-10 w-full max-w-xl bg-[#3a291f] p-8 rounded-4xl shadow-2xl border-4 border-stone-700">
            <button onClick={closeMatchWizard} className="absolute top-5 right-5 text-stone-400 font-extrabold text-xl">✕</button>
            <div className="flex gap-2 mb-6 justify-center">
              {[1, 2, 3, 4].map(step => (<div key={step} className={`h-2 w-12 rounded-full ${matchStep >= step ? 'bg-[#9a5b28]' : 'bg-stone-700'}`} />))}
            </div>

            {matchStep === 1 && (
              <div className="text-center">
                <h2 className="text-2xl font-black text-white mb-6">1. 대국 방식을 선택하세요</h2>
                <div className="grid grid-cols-2 gap-3">
                  {['랭킹전', '친선전', '페어전(2:2)', '페어전(3:3)', '페어전(4:4)'].map(type => (
                    <button key={type} onClick={() => { setMatchType(type); setMatchStep(2); }} className="py-5 bg-[#1a110b] border-2 border-stone-700 rounded-2xl text-xl font-black text-stone-300 hover:bg-[#9a5b28] hover:text-white transition-all">
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {matchStep === 2 && (
              <div className="text-center">
                <h2 className="text-2xl font-black text-white mb-2">2. 대국자를 선택하세요</h2>
                <p className="text-[#e3c18b] mb-4 text-sm font-bold">좌측 명단을 터치하여 팀을 구성하세요.</p>
                <div className="flex gap-4">
                  <div className="flex-1 bg-[#1a110b] p-3 rounded-2xl border-2 border-stone-600">
                    <h3 className="text-xl font-black text-stone-300 mb-3">⚫ 흑 팀</h3>
                    <div className="space-y-2 min-h-30">
                      {blackTeam.map(m => <div key={m.id} className="bg-stone-800 py-2 px-3 rounded-xl font-black text-lg text-white flex justify-between"><span>{m.name}</span><span className="text-[#e3c18b]">{m.rank}</span></div>)}
                    </div>
                  </div>
                  <div className="flex-1 bg-[#fdfbf7] p-3 rounded-2xl border-2 border-stone-300">
                    <h3 className="text-xl font-black text-[#2c1e16] mb-3">⚪ 백 팀</h3>
                    <div className="space-y-2 min-h-30">
                      {whiteTeam.map(m => <div key={m.id} className="bg-white py-2 px-3 rounded-xl font-black text-lg text-[#2c1e16] flex justify-between border"><span>{m.name}</span><span className="text-[#9a5b28]">{m.rank}</span></div>)}
                    </div>
                  </div>
                </div>
                <button onClick={() => setMatchStep(3)} disabled={blackTeam.length === 0 || whiteTeam.length === 0} className="mt-6 w-full py-4 bg-[#9a5b28] disabled:bg-stone-700 text-white font-black text-xl rounded-2xl">
                  다음 단계로 ➔
                </button>
              </div>
            )}

            {matchStep === 3 && (
              <div className="text-center">
                <h2 className="text-2xl font-extrabold text-white mb-6">3. 돌 가리기 방식을 선택하세요</h2>
                <div className="space-y-3">
                  <button onClick={() => { setMatchStep(4); }} className="w-full py-5 bg-[#1a110b] border-2 border-stone-700 rounded-2xl text-xl font-black text-stone-300 hover:bg-[#9a5b28] hover:text-white">수동 (선택된 흑/백 그대로 진행)</button>
                </div>
                <button onClick={() => setMatchStep(2)} className="mt-4 text-stone-400 font-bold text-lg">⬅ 이전 단계</button>
              </div>
            )}

            {matchStep === 4 && (
              <div className="text-center">
                <h2 className="text-2xl font-black text-white mb-4">4. 치수를 설정하세요</h2>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {(['호선', '정선', '접바둑'] as const).map(type => (
                    <button key={type} onClick={() => setHandicapType(type)} className={`py-3 border-2 rounded-xl font-black text-xl ${handicapType === type ? 'bg-[#fdfbf7] text-[#2c1e16] border-white scale-105' : 'bg-[#1a110b] text-stone-400 border-stone-700'}`}>{type}</button>
                  ))}
                </div>
                {handicapType === '접바둑' && (
                  <div className="bg-[#1a110b] p-5 rounded-2xl border-2 border-stone-700 mb-6 flex flex-col gap-4">
                     <div className="flex justify-between items-center">
                        <span className="text-lg font-black text-stone-300">깔아둘 돌</span>
                        <div className="flex items-center gap-3 bg-stone-800 rounded-full p-1.5">
                           <button onClick={() => setHandicapStones(p => p > 2 ? p - 1 : p === 2 ? 0 : 0)} className="w-10 h-10 bg-stone-700 rounded-full text-2xl font-black">-</button>
                           <span className="text-2xl font-black w-16 text-center text-[#e3c18b]">{handicapStones}점</span>
                           <button onClick={() => setHandicapStones(p => p === 0 ? 2 : p < 9 ? p + 1 : 9)} className="w-10 h-10 bg-stone-700 rounded-full text-2xl font-black">+</button>
                        </div>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-lg font-black text-stone-300">{handicapStones === 0 ? '역덤' : '덤'}</span>
                        <div className="flex items-center gap-3 bg-stone-800 rounded-full p-1.5">
                           <button onClick={() => setKomi(p => p > 0.5 ? p - 1 : 0.5)} className="w-10 h-10 bg-stone-700 rounded-full text-2xl font-black">-</button>
                           <span className="text-2xl font-black w-20 text-center text-[#e3c18b]">{komi}집</span>
                           <button onClick={() => setKomi(p => p < 99.5 ? p + 1 : 99.5)} className="w-10 h-10 bg-stone-700 rounded-full text-2xl font-black">+</button>
                        </div>
                     </div>
                     {handicapStones === 0 && komi < 15 && (
                        <p className="text-red-400 font-bold text-sm bg-red-900/30 py-2 rounded-lg border border-red-500/50">⚠️ 0점 접바둑은 최소 15.5집 이상의 역덤이 필요합니다.</p>
                     )}
                  </div>
                )}
                <button onClick={submitMatch} disabled={!isHandicapValid || isProcessing} className="w-full py-5 bg-green-600 disabled:bg-stone-700 text-white text-2xl font-black rounded-2xl disabled:text-stone-500">
                  {isProcessing ? '처리중' : '✅ 대국 시작하기'}
                </button>
                <button onClick={() => setMatchStep(3)} className="mt-4 text-stone-400 font-bold text-lg">⬅ 이전 단계</button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}