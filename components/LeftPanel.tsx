import { Profile } from '../types';

interface LeftPanelProps {
  activeMembers: Profile[];
  isLoadingList: boolean;
  kioskMode: string;
  matchStep: number;
  matchType: string;
  blackTeam: Profile[];
  whiteTeam: Profile[];
  setBlackTeam: (team: Profile[]) => void;
  setWhiteTeam: (team: Profile[]) => void;
  openMatchDetail: (id: string) => void;
  openProfileDetail: (member: Profile) => void;
}

export default function LeftPanel({
  activeMembers,
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
    <section className="w-[38%] h-full board-panel border-r-4 border-[#c59d62] flex flex-col shadow-2xl relative z-10 bg-[#d9c7a1]">
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
        {isLoadingList ? (
          <p className="text-center mt-10 text-stone-400 font-bold text-xl">목록을 불러오는 중...</p>
        ) : activeMembers.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-stone-400 font-bold text-xl">현재 기원에 계신 분이 없습니다.</p>
          </div>
        ) : (
          activeMembers.map((member) => (
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
                } else if (member.current_status === '대국중') {
                  openMatchDetail(member.id);
                } else {
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
                  {new Date(member.last_check_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 도착
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