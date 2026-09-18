import { Profile, Match } from '../types';

interface LeftPanelProps {
  activeMembers: Profile[];
  liveMatches: Match[];
  isLoadingList: boolean;
  kioskMode: string;
  matchStep: number;
  matchType: string;
  blackTeam: Profile[];
  whiteTeam: Profile[];
  setBlackTeam: (team: Profile[]) => void;
  setWhiteTeam: (team: Profile[]) => void;
  openMatchDetail: (matchId: number) => void;
  openProfileDetail: (member: Profile) => void;
}

export default function LeftPanel({
  activeMembers,
  liveMatches,
  isLoadingList,
  kioskMode,
  matchStep,
  matchType,
  blackTeam,
  whiteTeam,
  setBlackTeam,
  setWhiteTeam,
  openMatchDetail,
  openProfileDetail
}: LeftPanelProps) {
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`전체화면 전환 에러: ${err.message}`);
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  return (
    <section
      className="w-[38%] h-full board-panel border-r-4 border-[#c59d62] flex flex-col shadow-2xl relative z-10"
      style={{ backgroundColor: '#d9c7a1' }}
    >
      <header className="p-5 xl:p-6 bg-[#f3ead3]/90 border-b-2 border-[#caa96f] flex justify-between items-end shadow-sm">
        <div>
          <h1 
            onClick={toggleFullScreen} 
            className="text-3xl xl:text-4xl font-black text-stone-800 tracking-tight cursor-pointer hover:text-[#b88c42] transition-colors flex items-center gap-2"
            title="클릭 시 전체화면"
          >
            현재 현황 <span className="text-xl opacity-60">⛶</span>
          </h1>
          <p className="text-stone-500 font-bold mt-1 text-sm xl:text-base">춘천에서 바둑을 사랑하는 바둑인들이 모인 공간입니다.</p>
        </div>
        <div className="text-right">
          <span className="text-5xl xl:text-6xl font-black text-[#8a5a20]">{activeMembers.length}</span>
          <span className="text-xl font-bold text-stone-600"> 명</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {/* 대국 중인 대국이 있으면 사람 명단보다 먼저 대국 정보를 배치 */}
        {liveMatches.length > 0 && (
          <div className="mb-2 space-y-2">
            <p className="text-xs font-black tracking-[0.16em] text-[#8a5a20]">진행 중 대국</p>
            {liveMatches.map((match) => {
              const blackPlayers = (match.black_team || []).map(id => activeMembers.find(m => m.id === id)).filter(Boolean) as Profile[];
              const whitePlayers = (match.white_team || []).map(id => activeMembers.find(m => m.id === id)).filter(Boolean) as Profile[];
              return (
                <div
                  key={match.id}
                  onClick={() => openMatchDetail(match.id)}
                  className="rounded-2xl border-2 border-amber-500 bg-stone-900/90 p-3 xl:p-4 cursor-pointer hover:brightness-110 transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black tracking-[0.14em] text-[#dcb36c]">{match.match_type}</span>
                    <span className="text-[11px] font-bold text-[#f7e7c4]">{match.handicap}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="space-y-0.5 text-left">
                      {blackPlayers.map(p => (
                        <div key={p.id} className="text-sm xl:text-base font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                      ))}
                    </div>
                    <div className="text-xs xl:text-sm font-black tracking-[0.2em] text-[#dcb36c]">VS</div>
                    <div className="space-y-0.5 text-right">
                      {whitePlayers.map(p => (
                        <div key={p.id} className="text-sm xl:text-base font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isLoadingList ? (
          <p className="text-center mt-10 text-stone-400 font-bold text-xl">목록을 불러오는 중...</p>
        ) : activeMembers.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-stone-400 font-bold text-xl">현재 기원에 계신 분이 없습니다.</p>
          </div>
        ) : (
          // 대국 중인 회원이 명단에서도 상단에 우선적으로 보이도록 정렬 (안정 정렬이라 동일 상태 내 순서는 유지됨)
          [...activeMembers]
            .sort((a, b) => (b.current_status === '대국중' ? 1 : 0) - (a.current_status === '대국중' ? 1 : 0))
            .map((member) => (
            <div 
              key={member.id} 
              onClick={() => {
                if (kioskMode === 'match_wizard' && matchStep === 2) {
                  // 💡 1. 이미 대국 중인 사람은 명단에 추가 불가능하도록 차단!
                  if (member.current_status === '대국중') {
                    alert('이미 대국 중인 회원은 중복으로 신청할 수 없습니다.');
                    return;
                  }
                  if (blackTeam.find(m => m.id === member.id) || whiteTeam.find(m => m.id === member.id)) return;
                  
                  const req = matchType.includes('2:2') ? 2 : matchType.includes('3:3') ? 3 : matchType.includes('4:4') ? 4 : 1;
                  if (blackTeam.length < req) setBlackTeam([...blackTeam, member]);
                  else if (whiteTeam.length < req) setWhiteTeam([...whiteTeam, member]);
                } else {
                  // 대국 중 여부와 상관없이 명단 클릭 시에는 항상 프로필을 표시
                  openProfileDetail(member);
                }
              }}
              className={`p-4 xl:p-5 rounded-2xl border-2 flex justify-between items-center transition-all cursor-pointer hover:scale-[1.01] shadow-sm ${
                member.current_status === '대국중' 
                  ? 'bg-amber-50/80 border-amber-500 hover:bg-amber-100' 
                  : 'bg-white border-[#e0cfb3] hover:border-[#b88c42]'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-black text-2xl xl:text-3xl text-stone-800">{member.name}</span>
                <span className="text-xs xl:text-sm text-stone-500 font-semibold mt-1">
                  {member.last_check_in
                    ? `${new Date(member.last_check_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 도착`
                    : '도착 시간 정보 없음'}
                </span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="px-3 py-1 bg-stone-100 text-stone-800 border border-stone-300 text-base xl:text-lg font-extrabold rounded-lg shadow-inner">
                  {member.rank}
                </span>
                {member.current_status === '대국중' && (
                  <span className="px-2.5 py-0.5 bg-stone-900 text-amber-300 text-xs font-black rounded-md shadow-md animate-pulse border border-amber-400">
                    대국중
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}