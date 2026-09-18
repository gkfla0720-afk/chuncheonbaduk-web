import { Profile, Match } from '../types';

interface AttendanceScreenProps {
  liveMatches: Match[];
  activeMembers: Profile[];
  message: string;
  confirmUser: Profile | null;
  candidates: Profile[];
  phoneNumber: string;
  isProcessing: boolean;
  onNumberClick: (num: string) => void;
  onDelete: () => void;
  onSearchUser: () => void;
  onReset: () => void;
  onConfirmAttendance: () => void;
  onGoHome: () => void;
  onSelectCandidate: (candidate: Profile) => void;
  onShowMembershipGuide: () => void;
  onOpenRegister: () => void;
  onOpenMatchWizard: () => void;
}

const NUMBER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function AttendanceScreen({
  liveMatches,
  activeMembers,
  message,
  confirmUser,
  candidates,
  phoneNumber,
  isProcessing,
  onNumberClick,
  onDelete,
  onSearchUser,
  onReset,
  onConfirmAttendance,
  onGoHome,
  onSelectCandidate,
  onShowMembershipGuide,
  onOpenRegister,
  onOpenMatchWizard,
}: AttendanceScreenProps) {
  return (
    <div className="relative z-10 w-full h-full flex flex-row items-center justify-center gap-8 xl:gap-12 px-2">
      <div className="flex flex-col items-center gap-5 w-[53%] max-w-[620px] shrink-0">
        {liveMatches.length > 0 && (
          <div className="w-full rounded-[28px] border-2 border-[#d8c4a2] bg-[#1d1714]/85 p-5 shadow-[0_14px_30px_rgba(10,8,7,0.28)] backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-[12px] font-extrabold tracking-[0.22em] text-[#e0c48f] uppercase">LIVE</p>
              <span className="rounded-full bg-[#e9cc96] px-2.5 py-1 text-[11px] font-black text-[#2a1d13]">진행 중 대국</span>
            </div>
            <div className="space-y-3">
              {liveMatches.slice(0, 2).map((match) => {
                const blackPlayers = (match.black_team || []).map(id => activeMembers.find(member => member.id === id)).filter(Boolean) as Profile[];
                const whitePlayers = (match.white_team || []).map(id => activeMembers.find(member => member.id === id)).filter(Boolean) as Profile[];
                return (
                  <div key={match.id} className="rounded-[22px] border border-[#6b4d30] bg-[#120f0d]/80 p-3 text-white">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-[12px] font-black tracking-[0.14em] text-[#dcb36c]">{match.match_type}</span>
                      <span className="text-[12px] font-bold text-[#f7e7c4]">{match.handicap}</span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="space-y-1 text-left">
                        {blackPlayers.length > 0 ? blackPlayers.map(player => (
                          <div key={player.id} className="text-[15px] font-black text-[#f3e8d1] whitespace-nowrap">{player.name}</div>
                        )) : <div className="text-[14px] text-stone-400">-</div>}
                      </div>
                      <div className="text-[15px] font-black tracking-[0.2em] text-[#dcb36c]">VS</div>
                      <div className="space-y-1 text-right">
                        {whitePlayers.length > 0 ? whitePlayers.map(player => (
                          <div key={player.id} className="text-[15px] font-black text-[#f3e8d1] whitespace-nowrap">{player.name}</div>
                        )) : <div className="text-[14px] text-stone-400">-</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 중앙: 콤팩트하고 세련된 입력 키패드 영역 */}
      <div className="flex flex-col items-center w-full max-w-[420px]">
        <h2 className="text-4xl xl:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-[0_3px_12px_rgba(0,0,0,0.7)]">입장 / 귀가</h2>
        <p className="text-lg xl:text-xl font-extrabold h-8 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)] mb-2">{message}</p>

        {confirmUser ? (
          <div className="bg-[#1a1411]/85 p-8 rounded-[2.5rem] border-4 border-[#e8d5b5]/70 shadow-[0_15px_35px_rgba(0,0,0,0.4)] text-center w-full text-white backdrop-blur-sm">
            <h2 className="text-4xl font-black mb-2 text-[#e8d5b5]">{confirmUser.name}</h2>
            <p className="text-stone-300 text-xl font-extrabold mb-8">{confirmUser.rank} / {confirmUser.tier}</p>
            {confirmUser.current_status !== '오프라인' ? (
              <button onClick={onGoHome} disabled={isProcessing} className="w-full py-5 bg-[#332a24] border-2 border-[#dcb36c] text-[#dcb36c] hover:bg-[#dcb36c] hover:text-stone-900 font-black rounded-2xl text-2xl shadow-xl transition-all disabled:opacity-50">
                {isProcessing ? '처리중...' : '귀가하기 (퇴장)'}
              </button>
            ) : (
              <button onClick={onConfirmAttendance} disabled={isProcessing} className="w-full py-5 bg-white text-stone-900 hover:bg-stone-100 font-black rounded-2xl text-2xl shadow-xl transition-all disabled:opacity-50">
                {isProcessing ? '처리중...' : '출석하기 (입장)'}
              </button>
            )}
            <button onClick={onReset} className="w-full mt-4 py-3 text-stone-400 hover:text-white font-bold text-lg">취소</button>
          </div>
        ) : candidates.length > 0 ? (
          <div className="bg-[#1a1411]/85 p-6 rounded-[2.5rem] shadow-[0_15px_35px_rgba(0,0,0,0.35)] space-y-3 w-full border-2 border-stone-700/80 backdrop-blur-sm">
            <p className="text-center text-[#e8d5b5] font-bold text-lg mb-4">본인의 이름을 선택해주세요</p>
            {candidates.map((cand) => (
              <button key={cand.id} onClick={() => onSelectCandidate(cand)} className="w-full py-4 bg-white text-stone-900 rounded-2xl text-xl font-extrabold shadow-md flex justify-between px-6 items-center hover:bg-stone-100">
                <span>{cand.name}</span><span className="text-base bg-[#dcb36c] px-3 py-1 rounded-lg text-stone-900 font-black">{cand.rank}</span>
              </button>
            ))}
            <button onClick={onReset} className="w-full py-3 text-stone-400 font-bold text-lg mt-2">다시 입력하기</button>
          </div>
        ) : (
          <div className="bg-[#1a1411]/85 p-6 xl:p-8 rounded-[2.5rem] shadow-[0_15px_35px_rgba(0,0,0,0.35)] w-full border-4 border-stone-700/80 backdrop-blur-sm">
            <div className="bg-[#120f0d] border border-stone-700 rounded-2xl h-16 xl:h-20 flex items-center justify-center mb-6 shadow-inner">
              <span className="text-4xl xl:text-5xl font-mono tracking-[0.4em] text-[#e8d5b5] font-black">{phoneNumber.padEnd(4, '—')}</span>
            </div>
            {/* 숫자버튼 겹침을 방지하기 위해 80px(w-20) 고정 사이즈 적용 */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {NUMBER_KEYS.map(num => (
                <button key={num} onClick={() => onNumberClick(num)} className="w-20 h-20 mx-auto rounded-full bg-white text-stone-900 text-4xl font-black shadow-[0_5px_0_#999] active:translate-y-1 active:shadow-none flex items-center justify-center transition-all">{num}</button>
              ))}
              <button onClick={onDelete} className="w-20 h-20 mx-auto rounded-full bg-[#332a24] text-[#e8d5b5] text-xl font-black shadow-[0_5px_0_#1a1512] active:translate-y-1 flex items-center justify-center">지움</button>
              <button onClick={() => onNumberClick('0')} className="w-20 h-20 mx-auto rounded-full bg-white text-stone-900 text-4xl font-black shadow-[0_5px_0_#999] active:translate-y-1 active:shadow-none flex items-center justify-center transition-all">0</button>
              <button onClick={onReset} className="w-20 h-20 mx-auto rounded-full bg-[#332a24] text-stone-400 text-xl font-black shadow-[0_5px_0_#1a1512] active:translate-y-1 flex items-center justify-center">취소</button>
            </div>
            <button onClick={onSearchUser} disabled={isProcessing} className="w-full py-5 bg-[#b88c42] hover:bg-[#a37934] text-stone-950 text-2xl xl:text-3xl font-black rounded-2xl shadow-[0_5px_0_#755520] active:translate-y-1 transition-all disabled:opacity-50">
              {isProcessing ? '확인 중...' : '확인 (입력완료)'}
            </button>
          </div>
        )}
      </div>

      {/* 우측: 여백 공간을 활용한 큼직한 액션 버튼 */}
      <div className="flex flex-col gap-6 w-64 xl:w-72 shrink-0">
        <button onClick={onShowMembershipGuide} className="w-full bg-[#f7f0e5] hover:bg-[#efe1cb] text-stone-900 font-extrabold py-4 rounded-[18px] shadow-[0_10px_18px_rgba(25,18,12,0.12)] text-lg transition-all border border-[#c69b5c] tracking-[0.02em]">
          정회원 달성 조건
        </button>
        <button onClick={onOpenRegister} className="w-full bg-[#f8f5f1] hover:bg-[#f1e7d8] text-stone-900 font-black py-7 rounded-[24px] shadow-[0_12px_24px_rgba(25,18,12,0.18)] text-2xl xl:text-3xl transition-all border-2 border-[#c69b5c] flex items-center justify-center gap-3 tracking-[0.02em]">
          <span>📝</span> 신규 가입
        </button>
        <button onClick={onOpenMatchWizard} className="w-full bg-[#1e1a17] hover:bg-[#2b231e] text-[#efdfba] font-black py-7 rounded-[24px] shadow-[0_12px_24px_rgba(25,18,12,0.2)] text-2xl xl:text-3xl transition-all border-2 border-[#b88c42] flex items-center justify-center gap-3 tracking-[0.02em]">
          <span>⚔️</span> 대국 신청
        </button>
      </div>
    </div>
  );
}
