'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchProfileStats } from '@/lib/profileStats';
import { Profile, Match } from '../types';
import LeftPanel from '../components/LeftPanel';
import AttendanceScreen from '../components/AttendanceScreen';
import MatchWizard from '../components/MatchWizard';
import MembershipGuideModal from '../components/modals/MembershipGuideModal';
import ProfileDetailModal from '../components/modals/ProfileDetailModal';
import MatchDetailModal from '../components/modals/MatchDetailModal';
import RegisterModal from '../components/modals/RegisterModal';

const RANKS = [
  '18급', '17급', '16급', '15급', '14급', '13급', '12급', '11급', '10급', '9급',
  '8급', '7급', '6급', '5급', '4급', '3급', '2급', '1급',
  '1단', '2단', '3단', '4단', '5단', '6단', '7단', '8단', '9단'
];

export default function KioskPage() {
  const [activeMembers, setActiveMembers] = useState<Profile[]>([]);
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
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
  const [drawMethod, setDrawMethod] = useState<'수동' | '랜덤'>('수동');
  const [blackTeam, setBlackTeam] = useState<Profile[]>([]);
  const [whiteTeam, setWhiteTeam] = useState<Profile[]>([]);
  const [handicapType, setHandicapType] = useState<'호선' | '정선' | '접바둑'>('호선');
  const [handicapStones, setHandicapStones] = useState(2);
  const [komi, setKomi] = useState(0.5);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchElapsed, setMatchElapsed] = useState('');
  const [confirmAction, setConfirmAction] = useState<'black_win' | 'white_win' | 'cancel' | null>(null);

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [profileStats, setProfileStats] = useState({ wins: 0, losses: 0, attendanceRate: 0, joinedAt: '', tier: '' });
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

        // 자동 퇴장 대상자가 대국 중이었다면, 대국이 종료 처리되지 않은 채 남지 않도록
        // 승패에는 영향을 주지 않는 '보류' 상태로 전환해 기록만 남긴다.
        // (추후 관리자 기능에서 검토/수정 가능하도록 DB에만 흔적을 남기는 용도)
        const { data: ongoingMatches } = await supabase.from('matches').select('id, black_team, white_team').eq('phase', '진행중');
        const staleMatchIds = (ongoingMatches || [])
          .filter(m => m.black_team.some(id => staleIds.includes(id)) || m.white_team.some(id => staleIds.includes(id)))
          .map(m => m.id);
        if (staleMatchIds.length > 0) {
          await supabase.from('matches').update({ phase: '보류' }).in('id', staleMatchIds);
        }

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
    const fetchLiveMatches = async () => {
      const { data } = await supabase.from('matches').select('*').eq('phase', '진행중').order('started_at', { ascending: false });
      setLiveMatches(data || []);
    };
    fetchLiveMatches();
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
    const { error: profileError } = await supabase.from('profiles').update({ current_status: '출석중', last_check_in: nowISO }).eq('id', confirmUser.id);
    const { error: attendanceError } = await supabase.from('attendance').insert([{ user_id: confirmUser.id, status: '출석중', checked_in_at: nowISO }]);
    if (profileError || attendanceError) {
      console.error(profileError || attendanceError);
      setMessage('출석 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsProcessing(false);
      return;
    }
    setRefreshTrigger(p => p + 1); 
    resetTimerRef.current = setTimeout(() => handleReset(), 3000);
  };

  const handleGoHome = async () => {
    if (isProcessing || !confirmUser) return;
    setIsProcessing(true); 
    const { error: profileError } = await supabase.from('profiles').update({ current_status: '오프라인' }).eq('id', confirmUser.id);
    if (profileError) {
      console.error(profileError);
      setMessage('귀가 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsProcessing(false);
      return;
    }
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
    const { error } = await supabase.from('profiles').insert([{ name: regName, phone_last4: regPhone, rank: regRank, tier: '준회원' }]);
    if (error) {
      console.error(error);
      alert('가입 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsProcessing(false);
      return;
    }
    alert('가입이 완료되었습니다!'); handleReset();
  };

  const openProfileDetail = async (member: Profile) => {
    setKioskMode('profile_detail'); setSelectedProfile(member); setIsLoadingStats(true);
    try {
      const stats = await fetchProfileStats(member.id);
      setProfileStats(stats);
    } catch (err) {
      console.error(err);
    }
    setIsLoadingStats(false);
  };

  const openMatchWizard = () => { setKioskMode('match_wizard'); setMatchStep(1); setDrawMethod('수동'); setBlackTeam([]); setWhiteTeam([]); setHandicapType('호선'); setHandicapStones(2); setKomi(0.5); };
  const closeMatchWizard = () => { setKioskMode('attendance'); handleReset(); };

  const openMatchDetail = async (userId: string) => {
    const { data } = await supabase.from('matches').select('*').eq('phase', '진행중');
    if (data) {
      const match = data.find(m => m.black_team.includes(userId) || m.white_team.includes(userId));
      if (match) { setSelectedMatch(match); setKioskMode('match_detail'); setConfirmAction(null); }
    }
  };

  const endMatch = async (result: string) => {
    if (isProcessing || !selectedMatch) return;
    setIsProcessing(true);
    const { error } = await supabase.from('matches').update({ phase: result === '취소' ? '취소' : '종료', winner: result }).eq('id', selectedMatch.id);
    if (error) {
      console.error(error);
      alert('대국 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsProcessing(false);
      return;
    }
    const allIds = [...selectedMatch.black_team, ...selectedMatch.white_team];
    await supabase.from('profiles').update({ current_status: '출석중' }).in('id', allIds);
    alert(result === '취소' ? '대국이 취소되었습니다.' : '대국이 정상 종료되었습니다.');
    setRefreshTrigger(p => p + 1); handleReset();
  };

  const requiredPlayerCount = matchType.includes('2:2') ? 2 : matchType.includes('3:3') ? 3 : matchType.includes('4:4') ? 4 : 1;
  const isHandicapValid = handicapType !== '접바둑' || handicapStones >= 2 || (handicapStones === 0 && komi >= 15);

  const applyAutoDraw = () => {
    if (blackTeam.length === 0 && whiteTeam.length === 0) return;

    const allPlayers = [...blackTeam, ...whiteTeam].filter(Boolean);
    const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);

    setBlackTeam(shuffled.slice(0, half));
    setWhiteTeam(shuffled.slice(half));
    setHandicapType('호선');
    setDrawMethod('랜덤');
    setMatchStep(4);
  };

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
    const { error } = await supabase.from('matches').insert([{ match_type: matchType, black_team: blackTeam.map(m => m.id), white_team: whiteTeam.map(m => m.id), handicap: finalHandicap }]);
    if (error) {
      console.error(error);
      alert('대국 등록 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsProcessing(false);
      return;
    }
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
        {kioskMode === 'attendance' && (
          <AttendanceScreen
            liveMatches={liveMatches}
            activeMembers={activeMembers}
            message={message}
            confirmUser={confirmUser}
            candidates={candidates}
            phoneNumber={phoneNumber}
            isProcessing={isProcessing}
            onNumberClick={handleNumberClick}
            onDelete={handleDelete}
            onSearchUser={handleSearchUser}
            onReset={handleReset}
            onConfirmAttendance={handleConfirmAttendance}
            onGoHome={handleGoHome}
            onSelectCandidate={(cand) => { setConfirmUser(cand); setCandidates([]); }}
            onShowMembershipGuide={() => setShowMembershipGuide(true)}
            onOpenRegister={() => setKioskMode('register')}
            onOpenMatchWizard={openMatchWizard}
          />
        )}
      </section>

      {showMembershipGuide && (
        <MembershipGuideModal onClose={() => setShowMembershipGuide(false)} />
      )}

      {kioskMode === 'profile_detail' && selectedProfile && (
        <ProfileDetailModal
          profile={selectedProfile}
          stats={profileStats}
          isLoadingStats={isLoadingStats}
          onClose={handleReset}
        />
      )}

      {kioskMode === 'match_detail' && selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          matchElapsed={matchElapsed}
          confirmAction={confirmAction}
          setConfirmAction={setConfirmAction}
          endMatch={endMatch}
          isProcessing={isProcessing}
          onClose={handleReset}
        />
      )}

      {kioskMode === 'register' && (
        <RegisterModal
          regName={regName}
          setRegName={setRegName}
          regPhone={regPhone}
          setRegPhone={setRegPhone}
          regRank={regRank}
          handleRankChange={handleRankChange}
          onCancel={handleReset}
          onSubmit={submitRegister}
          isProcessing={isProcessing}
        />
      )}

      {kioskMode === 'match_wizard' && (
        <MatchWizard
          matchStep={matchStep}
          setMatchStep={setMatchStep}
          matchType={matchType}
          setMatchType={setMatchType}
          availableMembers={availableMembers}
          blackTeam={blackTeam}
          whiteTeam={whiteTeam}
          setBlackTeam={setBlackTeam}
          setWhiteTeam={setWhiteTeam}
          selectMemberToTeam={selectMemberToTeam}
          drawMethod={drawMethod}
          setDrawMethod={setDrawMethod}
          applyAutoDraw={applyAutoDraw}
          handicapType={handicapType}
          setHandicapType={setHandicapType}
          handicapStones={handicapStones}
          setHandicapStones={setHandicapStones}
          komi={komi}
          setKomi={setKomi}
          isHandicapValid={isHandicapValid}
          submitMatch={submitMatch}
          isProcessing={isProcessing}
          onClose={closeMatchWizard}
        />
      )}
    </main>
  );
}

