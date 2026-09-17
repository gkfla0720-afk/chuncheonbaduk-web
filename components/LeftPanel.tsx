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
        console.warn(`전체화면 에러: ${err.message}`);
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  return (
    <section className="w-[38%] h-full bg-[#f7f3ea] border-r-4 border-[#b88c42] flex flex-col shadow-2xl relative z-10">
      <header className="p-6 xl:p-8 2xl:p-10 bg-white border-b-2 border-[#d9c49d] flex justify-between items-end shadow-sm">
        <div>
          <h1 
            onClick={toggleFullScreen} 
            className="text-4xl xl:text-5xl 2xl:text-6xl font-black text-stone-800 tracking-tight cursor-pointer hover:text-[#b88c42] transition-colors flex items-center gap-2"
            title="클릭 시 전체화면"
          >
            현재 현황 <span className="text-2xl opacity-60">⛶</span>
          </h1>
          <p className="text-stone-500 font-bold mt-2 text-base xl:text-xl 2xl:text-2xl">터치 시 대국 관리 / 프로필 조회</p>
        </div>
        <div className="text-right">
          <span className="text-6xl xl:text-7xl 2xl:text-[6rem] font-black text-[#8a5a20]">{activeMembers.length}</span>
          <span className="text-2xl xl:text-3xl font-bold text-stone-600"> 명</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 xl:p-6 space-y-4 custom-scrollbar">
        {isLoadingList ? (
          <p className="text-center mt-10 text-stone-400 font-bold text-2xl xl:text-3xl">목록을 불러오는 중...</p>
        ) : activeMembers.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-stone-400 font-bold text-2xl xl:text-3xl">현재 기원에 계신 분이 없습니다.</p>
          </div>
        ) : (
          activeMembers.map((member) => (
            <div 
              key={member.id} 
              onClick={() => {
                if (kioskMode === 'match_wizard' && matchStep === 2) {
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
              className={`p-5 xl:p-6 rounded-3xl border-2 flex justify-between items-center transition-all cursor-pointer hover:scale-[1.01] shadow-sm ${
                member.current_status === '대국중' 
                  ? 'bg-amber-50/80 border-amber-500 hover:bg-amber-100' 
                  : 'bg-white border-[#e0cfb3] hover:border-[#b88c42]'
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="font-black text-3xl xl:text-4xl 2xl:text-5xl text-stone-800">{member.name}</span>
                <span className="text-sm xl:text-lg 2xl:text-xl text-stone-500 font-semibold">
                  {new Date(member.last_check_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 도착
                </span>
              </div>
              <div className="flex flex-col items-end gap-2 xl:gap-3">
                <span className="px-4 py-2 bg-stone-100 text-stone-800 border border-stone-300 text-xl xl:text-2xl 2xl:text-3xl font-extrabold rounded-xl shadow-inner">
                  {member.rank}
                </span>
                {member.current_status === '대국중' && (
                  <span className="px-3 py-1 bg-stone-900 text-amber-300 text-sm xl:text-base 2xl:text-lg font-black rounded-lg shadow-md animate-pulse border border-amber-400">
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