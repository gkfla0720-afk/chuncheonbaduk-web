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

  // 💡 전체화면 토글(On/Off) 기능
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`전체화면 전환 에러: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <section className="w-[40%] h-full bg-[#fdfbf7] border-r-8 border-[#2c1e16] flex flex-col shadow-2xl relative z-10">
      <header className="p-4 sm:p-6 bg-white border-b-4 border-stone-200 flex justify-between items-end">
        <div>
          {/* 💡 "현재 현황" 글씨에 전체화면 기능 연결 및 마우스 커서 변경 */}
          <h1 
            onClick={toggleFullScreen} 
            className="text-3xl font-black text-[#2c1e16] tracking-tight cursor-pointer hover:text-[#9a5b28] transition-colors"
            title="클릭 시 전체화면"
          >
            현재 현황 ⛶
          </h1>
          <p className="text-stone-500 font-bold mt-1 text-sm sm:text-base">이름을 터치하세요 (대국/프로필)</p>
        </div>
        <div className="text-right">
          <span className="text-4xl sm:text-5xl font-black text-[#9a5b28]">{activeMembers.length}</span>
          <span className="text-lg sm:text-xl font-bold text-stone-600"> 명</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
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
                <span className="text-xs sm:text-sm text-stone-500 font-bold mt-1">{new Date(member.last_check_in).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 도착</span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="px-3 py-1 bg-stone-100 text-[#2c1e16] border-2 border-stone-300 text-base sm:text-lg font-extrabold rounded-lg">{member.rank}</span>
                {member.current_status === '대국중' && <span className="px-2 py-1 bg-red-600 text-white text-xs sm:text-sm font-black rounded-md shadow-md animate-pulse">대국중</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}