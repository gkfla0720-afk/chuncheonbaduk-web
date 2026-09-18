'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchProfileStats } from '@/lib/profileStats';
import { fetchProfileMatchHistory, MatchHistoryEntry } from '@/lib/matchHistory';
import { Profile, Match, KifuMove } from '../types';
import { checkMoveLegality, TerritoryResult } from '../lib/goRules';
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
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRank, setRegRank] = useState('10급');

  // 대국 중계(전체화면 확대) 상태에서도 출석 관리를 놓치지 않도록, 대국 상세 화면을 벗어나지
  // 않고 신규가입/대국신청/입장·귀가를 팝업으로 바로 처리할 수 있게 하는 상태.
  const [quickAction, setQuickAction] = useState<'register' | 'match_wizard' | 'attendance' | null>(null);

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
    // profiles 뿐 아니라 matches 변경(다른 키오스크에서 대국 시작/종료 등)도 즉시 반영되도록 구독
    const channel = supabase
      .channel('profiles_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => setRefreshTrigger(p => p + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => setRefreshTrigger(p => p + 1))
      .subscribe();
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
    setIsProcessing(false); setQuickAction(null);
    // 신규 가입 입력값도 함께 초기화해, 직전 가입자의 입력 정보가 다음 화면에 남지 않도록 한다.
    setRegName(''); setRegPhone(''); setRegRank('10급');
  };

  // 대국 상세(중계 화면)를 벗어나지 않은 채, 그 위에 띄운 신규가입/대국신청/입장·귀가
  // 팝업만 닫는다. handleReset과 달리 kioskMode/selectedMatch는 건드리지 않는다.
  const closeQuickAction = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setPhoneNumber(''); setCandidates([]); setConfirmUser(null);
    setMessage('전화번호 뒷자리 4자리를 눌러주세요.'); setIsProcessing(false);
    setRegName(''); setRegPhone(''); setRegRank('10급');
    setQuickAction(null);
  };

  const handleNumberClick = (num: string) => { if (phoneNumber.length < 4) setPhoneNumber(prev => prev + num); };
  const handleDelete = () => setPhoneNumber(prev => prev.slice(0, -1));

  const handleSearchUser = async () => {
    if (isProcessing) return;
    if (phoneNumber.length !== 4) { setMessage('뒷자리를 모두 입력하세요.'); return; }
    
    setIsProcessing(true); setMessage('확인 중...');
    const { data } = await supabase.from('profiles').select('*').eq('phone_last4', phoneNumber);
    
    if (!data || data.length === 0) {
      alert('등록되지 않은 번호입니다.');
      setPhoneNumber(''); setMessage('전화번호 뒷자리 4자리를 눌러주세요.'); setIsProcessing(false);
      return;
    }
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
    resetTimerRef.current = setTimeout(() => { quickAction ? closeQuickAction() : handleReset(); }, 3000);
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
    resetTimerRef.current = setTimeout(() => { quickAction ? closeQuickAction() : handleReset(); }, 3000);
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
    alert('가입이 완료되었습니다!');
    quickAction ? closeQuickAction() : handleReset();
  };

  const openProfileDetail = async (member: Profile) => {
    setKioskMode('profile_detail'); setSelectedProfile(member); setIsLoadingStats(true); setIsLoadingHistory(true);
    try {
      const [stats, history] = await Promise.all([fetchProfileStats(member.id), fetchProfileMatchHistory(member.id)]);
      setProfileStats(stats);
      setMatchHistory(history);
    } catch (err) {
      console.error(err);
    }
    setIsLoadingStats(false); setIsLoadingHistory(false);
  };

  const openMatchWizard = (asQuickAction = false) => {
    setMatchStep(1); setDrawMethod('수동'); setBlackTeam([]); setWhiteTeam([]); setHandicapType('호선'); setHandicapStones(2); setKomi(0.5);
    if (asQuickAction) setQuickAction('match_wizard'); else setKioskMode('match_wizard');
  };
  const closeMatchWizard = () => { setKioskMode('attendance'); handleReset(); };

  // 중계 화면(대국 상세)을 유지한 채로 신규가입/입장·귀가 팝업을 여는 진입점
  const openQuickAction = (action: 'register' | 'match_wizard' | 'attendance') => {
    if (action === 'match_wizard') { openMatchWizard(true); return; }
    if (action === 'register') { setRegName(''); setRegPhone(''); setRegRank('10급'); }
    if (action === 'attendance') { setPhoneNumber(''); setCandidates([]); setConfirmUser(null); setMessage('전화번호 뒷자리 4자리를 눌러주세요.'); }
    setQuickAction(action);
  };

  const openMatchDetail = (matchId: number) => {
    const match = liveMatches.find(m => m.id === matchId);
    if (match) { setSelectedMatch(match); setKioskMode('match_detail'); setConfirmAction(null); }
  };

  // 계가(집 세기)로 종료할 때는 산출된 흑/백 집수와 관리자가 표시한 사석을 함께 기록한다.
  // 승/패에는 영향이 없는 범위지만, 추후 관리자 화면에서 근거 자료로 확인/수정할 수 있게 남겨둔다.
  const endMatch = async (result: string, scoring?: { result: TerritoryResult; deadStones: { x: number; y: number }[] }) => {
    if (isProcessing || !selectedMatch) return;
    setIsProcessing(true);
    // 기보(kifu)는 matches 행에 그대로 남아 대국 종료 후에도 영구 보존된다.
    // 중계 슬롯은 하나뿐이므로, 대국이 끝나면 다음 대국이 중계를 시작할 수 있도록 반드시 꺼둔다.
    const updatePayload: Partial<Match> = { phase: result === '취소' ? '취소' : '종료', winner: result, is_streaming: false };
    if (scoring) {
      updatePayload.black_score = scoring.result.blackScore;
      updatePayload.white_score = scoring.result.whiteScore;
      updatePayload.dead_stones = scoring.deadStones as unknown as Match['dead_stones'];
    }
    const { error } = await supabase.from('matches').update(updatePayload).eq('id', selectedMatch.id);
    if (error) {
      console.error(error);
      alert('대국 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsProcessing(false);
      return;
    }
    const allIds = [...selectedMatch.black_team, ...selectedMatch.white_team];
    await supabase.from('profiles').update({ current_status: '출석중' }).in('id', allIds);
    alert(
      result === '취소'
        ? '대국이 취소되었습니다.'
        : scoring
          ? `계가 완료: ${scoring.result.winner} ${Math.abs(scoring.result.margin)}집 승 (흑 ${scoring.result.blackScore}집 : 백 ${scoring.result.whiteScore}집)`
          : '대국이 정상 종료되었습니다.'
    );
    setRefreshTrigger(p => p + 1); handleReset();
  };

  // 실시간 기보 중계는 동시에 1개 대국만 가능하다. 다른 대국이 이미 중계 중이면
  // 확인을 받은 뒤 그 대국의 중계를 끄고 이 대국의 중계를 시작한다.
  const toggleStreaming = async (turnOn: boolean) => {
    if (isProcessing || !selectedMatch) return;
    if (turnOn) {
      const otherStreaming = liveMatches.find(m => m.is_streaming && m.id !== selectedMatch.id);
      if (otherStreaming && !window.confirm(`다른 대국(${otherStreaming.match_type})이 중계 중입니다. 이 대국으로 전환할까요?`)) return;
    }
    setIsProcessing(true);
    if (turnOn) {
      await supabase.from('matches').update({ is_streaming: false }).eq('is_streaming', true);
    }
    const { error } = await supabase.from('matches').update({ is_streaming: turnOn }).eq('id', selectedMatch.id);
    if (error) {
      console.error(error);
      alert('중계 상태 변경 중 오류가 발생했습니다.');
      setIsProcessing(false);
      return;
    }
    setSelectedMatch(prev => (prev ? { ...prev, is_streaming: turnOn } : prev));
    setRefreshTrigger(p => p + 1);
    setIsProcessing(false);
  };

  // 착수는 매 수마다 lib/goRules.ts로 규칙(자충수/패)을 검사한 뒤, 최신 기보를 다시 읽어와
  // 다른 기기에서 먼저 놓인 수와 어긋나지 않는지 확인하고 나서야 저장한다. 사석(따낸 돌)은
  // kifu 배열에서 지우지 않고 그대로 두어도, 화면은 항상 재생(replay)해서 그리므로 문제없다.
  const placeKifuMove = async (x: number, y: number) => {
    if (!selectedMatch) return;
    const { data: fresh, error: fetchError } = await supabase.from('matches').select('kifu').eq('id', selectedMatch.id).single();
    if (fetchError || !fresh) { console.error(fetchError); return; }
    const kifu = (fresh.kifu as unknown as KifuMove[]) || [];
    const nextColor: 'black' | 'white' = kifu.length % 2 === 0 ? 'black' : 'white';
    const legality = checkMoveLegality(kifu, selectedMatch.board_size, x, y, nextColor);
    if (!legality.legal) {
      alert(legality.reason || '둘 수 없는 자리입니다.');
      return;
    }
    const newKifu = [...kifu, { x, y, color: nextColor }];
    const { data, error } = await supabase.from('matches').update({ kifu: newKifu as unknown as Match['kifu'] }).eq('id', selectedMatch.id).select('kifu').single();
    if (error) { console.error(error); alert('착수 저장 중 오류가 발생했습니다.'); return; }
    setSelectedMatch(prev => (prev ? { ...prev, kifu: data.kifu } : prev));
  };

  const undoKifuMove = async () => {
    if (!selectedMatch) return;
    const { data, error } = await supabase.rpc('undo_kifu_move', { p_match_id: selectedMatch.id });
    if (error) { console.error(error); return; }
    setSelectedMatch(prev => (prev ? { ...prev, kifu: data as unknown as Match['kifu'] } : prev));
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
    // 계가 시 whiteScore에 그대로 더해지는 숫자이므로, 접바둑 없이 덤만으로 실력 차를 보정하는
    // "역덤"은 오히려 흑에게 유리하도록 부호를 반전해서 저장해야 계가 결과가 올바르게 나온다.
    const finalKomi = handicapType === '호선' ? 6.5 : handicapType === '정선' ? 0.5 : (handicapStones === 0 ? -komi : komi);
    const { error } = await supabase.from('matches').insert([{ match_type: matchType, black_team: blackTeam.map(m => m.id), white_team: whiteTeam.map(m => m.id), handicap: finalHandicap, komi: finalKomi }]);
    if (error) {
      console.error(error);
      alert('대국 등록 중 오류가 발생했습니다. 다시 시도해주세요.');
      setIsProcessing(false);
      return;
    }
    const allIds = [...blackTeam, ...whiteTeam].map(m => m.id);
    await supabase.from('profiles').update({ current_status: '대국중' }).in('id', allIds);
    setRefreshTrigger(p => p + 1);
    quickAction ? closeQuickAction() : handleReset();
  };

  return (
    <main className="relative flex flex-row w-full h-screen bg-[#dcb36c] font-sans select-none overflow-visible text-stone-900">

      <LeftPanel
        activeMembers={activeMembers}
        liveMatches={liveMatches}
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
          // 입장/귀가 팝업과 동일한 카드 디자인(둥근 모서리/짙은 배경/두꺼운 테두리)을 메인 화면에도 적용.
          // 다만 팝업과 구분되도록 테두리는 금색 대신 회색을 쓰고, 가장 뒤 바둑판 사진(board-surface)은 그대로 유지한다.
          <div className="relative z-10 w-full max-w-5xl bg-[#1f1a16]/95 rounded-[36px] border-4 border-stone-400/70 shadow-2xl p-8 xl:p-10">
            <AttendanceScreen
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
              onOpenMatchWizard={() => openMatchWizard(false)}
            />
          </div>
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
          matchHistory={matchHistory}
          isLoadingHistory={isLoadingHistory}
          onClose={handleReset}
        />
      )}

      {kioskMode === 'match_detail' && selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          blackProfiles={selectedMatch.black_team.map(id => activeMembers.find(m => m.id === id)).filter(Boolean) as Profile[]}
          whiteProfiles={selectedMatch.white_team.map(id => activeMembers.find(m => m.id === id)).filter(Boolean) as Profile[]}
          matchElapsed={matchElapsed}
          confirmAction={confirmAction}
          setConfirmAction={setConfirmAction}
          endMatch={endMatch}
          isProcessing={isProcessing}
          onClose={handleReset}
          onToggleStreaming={toggleStreaming}
          onPlaceKifuMove={placeKifuMove}
          onUndoKifuMove={undoKifuMove}
          onOpenQuickAction={openQuickAction}
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

      {/* 대국 상세(중계) 화면을 유지한 채 신규가입/대국신청/입장·귀가를 팝업으로 처리한다. */}
      {quickAction === 'register' && (
        <RegisterModal
          regName={regName}
          setRegName={setRegName}
          regPhone={regPhone}
          setRegPhone={setRegPhone}
          regRank={regRank}
          handleRankChange={handleRankChange}
          onCancel={closeQuickAction}
          onSubmit={submitRegister}
          isProcessing={isProcessing}
        />
      )}

      {quickAction === 'match_wizard' && (
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
          onClose={closeQuickAction}
        />
      )}

      {quickAction === 'attendance' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.65)] p-4 backdrop-blur-[2px]"
          onClick={(e) => { if (e.target === e.currentTarget) closeQuickAction(); }}
        >
          {/* 중계 화면 등에서 열리는 팝업이므로 입장/귀가 키패드만 표시하는 콤팩트한 크기로 고정한다.
              (신규가입/대국신청 버튼은 이미 별도로 있어 중복 노출 및 세로 넘침을 유발했었다)
              뒤 배경에 바둑판 사진이 깔리지 않도록 board-surface 대신 일반 모달과 같은 단색 배경을 사용한다.
              (지난 라운드에서 넘침 방지를 위해 10% 축소했던 것을 다시 10% 확대한 크기) */}
          <div className="relative w-full max-w-[493px] bg-[#1f1a16] rounded-[28px] border-4 border-[#b88c42] shadow-2xl p-7">
            <button
              onClick={closeQuickAction}
              className="absolute top-3 right-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/30 text-2xl font-black text-stone-200 hover:bg-black/50 hover:text-white"
            >
              ✕
            </button>
            <AttendanceScreen
              message={message}
              confirmUser={confirmUser}
              candidates={candidates}
              phoneNumber={phoneNumber}
              isProcessing={isProcessing}
              onNumberClick={handleNumberClick}
              onDelete={handleDelete}
              onSearchUser={handleSearchUser}
              onReset={closeQuickAction}
              onConfirmAttendance={handleConfirmAttendance}
              onGoHome={handleGoHome}
              onSelectCandidate={(cand) => { setConfirmUser(cand); setCandidates([]); }}
              compact
            />
          </div>
        </div>
      )}
    </main>
  );
}

