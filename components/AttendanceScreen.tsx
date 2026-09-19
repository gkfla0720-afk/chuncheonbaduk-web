import { Profile } from '../types';

interface AttendanceScreenProps {
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
  // 중계 화면 등 좁은 팝업에서 열릴 때는 키패드를 더 작게 표시한다.
  compact?: boolean;
}

const NUMBER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default function AttendanceScreen({
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
  compact = false,
}: AttendanceScreenProps) {
  return (
    <div className={`relative z-10 w-full h-full flex flex-row items-center justify-center px-2 ${compact ? 'max-w-[420px] mx-auto' : ''}`}>
      {/* 진행 중 대국 카드는 왼쪽 '현재 현황' 패널에서만 표시한다 (중복 노출 방지) */}

      {/* 중앙: 콤팩트하고 세련된 입력 키패드 영역 - 항상 동일한 고정 폭 유지 */}
      <div className={`flex flex-col items-center shrink-0 ${compact ? 'w-full' : 'w-[420px]'}`}>
        {(confirmUser || candidates.length > 0) && (
          <p className={`font-extrabold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)] ${compact ? 'text-lg h-6 mb-1' : 'text-xl h-8 mb-2'}`}>{message}</p>
        )}

        {confirmUser ? (
          <div className={compact ? 'w-full text-center text-white py-2' : 'bg-[#1a1411]/85 p-8 rounded-[2.5rem] border-4 border-[#e8d5b5]/70 shadow-[0_15px_35px_rgba(0,0,0,0.4)] text-center w-full text-white backdrop-blur-sm'}>
            <h2 className={`font-black text-white/70 tracking-tight ${compact ? 'text-lg mb-2' : 'text-xl mb-3'}`}>입장 / 귀가</h2>
            <h2 className={`font-black text-[#e8d5b5] ${compact ? 'text-3xl mb-1' : 'text-4xl mb-2'}`}>{confirmUser.name}</h2>
            <p className={`text-stone-300 font-extrabold ${compact ? 'text-lg mb-4' : 'text-xl mb-8'}`}>{confirmUser.rank} / {confirmUser.tier}</p>
            {confirmUser.current_status !== '오프라인' ? (
              <button onClick={onGoHome} disabled={isProcessing} className={`w-full bg-[#332a24] border-2 border-[#dcb36c] text-[#dcb36c] hover:bg-[#dcb36c] hover:text-stone-900 font-black rounded-2xl shadow-xl transition-all disabled:opacity-50 ${compact ? 'py-[18px] text-xl' : 'py-5 text-2xl'}`}>
                {isProcessing ? '처리중...' : '귀가하기'}
              </button>
            ) : (
              <button onClick={onConfirmAttendance} disabled={isProcessing} className={`w-full bg-white text-stone-900 hover:bg-stone-100 font-black rounded-2xl shadow-xl transition-all disabled:opacity-50 ${compact ? 'py-[18px] text-xl' : 'py-5 text-2xl'}`}>
                {isProcessing ? '처리중...' : '입장하기'}
              </button>
            )}
            <button onClick={onReset} className={`w-full text-stone-400 hover:text-white font-bold ${compact ? 'mt-[13px] py-[9px] text-lg' : 'mt-4 py-3 text-xl'}`}>취소</button>
          </div>
        ) : candidates.length > 0 ? (
          <div className={compact ? 'space-y-2 w-full py-2' : 'bg-[#1a1411]/85 p-6 rounded-[2.5rem] shadow-[0_15px_35px_rgba(0,0,0,0.35)] space-y-3 w-full border-2 border-stone-700/80 backdrop-blur-sm'}>
            <h2 className={`font-black text-white/70 tracking-tight text-center ${compact ? 'text-lg mb-2' : 'text-xl mb-3'}`}>입장 / 귀가</h2>
            <p className={`text-center text-[#e8d5b5] font-bold ${compact ? 'text-lg mb-2' : 'text-xl mb-4'}`}>본인의 이름을 선택해주세요</p>
            {candidates.map((cand) => (
              <button key={cand.id} onClick={() => onSelectCandidate(cand)} className={`w-full bg-white text-stone-900 rounded-2xl font-extrabold shadow-md flex justify-between items-center hover:bg-stone-100 ${compact ? 'py-[13px] px-[22px] text-lg' : 'py-4 px-6 text-xl'}`}>
                <span>{cand.name}</span><span className="text-xl bg-[#dcb36c] px-3 py-1 rounded-lg text-stone-900 font-black">{cand.rank}</span>
              </button>
            ))}
            <button onClick={onReset} className={`w-full text-stone-400 font-bold ${compact ? 'py-[9px] text-lg mt-1' : 'py-3 text-xl mt-2'}`}>다시 입력하기</button>
          </div>
        ) : (
          <div className={compact ? 'w-full' : 'bg-[#1a1411]/85 p-6 xl:p-8 rounded-[2.5rem] shadow-[0_15px_35px_rgba(0,0,0,0.35)] w-full border-4 border-stone-700/80 backdrop-blur-sm'}>
            {/* 숫자패드/지움/확인 버튼을 담은 박스 안에 '입장 / 귀가' 타이틀을 포함시켜
                박스 하나로도 이 화면의 용도를 바로 알 수 있게 한다. */}
            <h2 className={`font-black text-white tracking-tight text-center drop-shadow-[0_3px_12px_rgba(0,0,0,0.7)] ${compact ? 'text-2xl xl:text-3xl mb-2' : 'text-3xl xl:text-4xl mb-3'}`}>입장 / 귀가</h2>
            {/* 안내 문구를 전화번호 표시 박스 안에 포함시켜 팝업 전체 높이를 줄인다 */}
            <div className={`bg-[#120f0d] border border-stone-700 rounded-2xl shadow-inner ${compact ? 'px-[13px] py-[9px] mb-[18px]' : 'px-4 py-3 mb-6'}`}>
              <p className={`font-extrabold text-center text-[#e8d5b5] ${compact ? 'text-base mb-1' : 'text-lg mb-2'}`}>{message}</p>
              <div className={compact ? 'h-[53px] xl:h-[62px] flex items-center justify-center' : 'h-16 xl:h-20 flex items-center justify-center'}>
                <span className={`font-mono tracking-[0.4em] text-[#e8d5b5] font-black ${compact ? 'text-3xl xl:text-4xl' : 'text-4xl xl:text-5xl'}`}>{phoneNumber.padEnd(4, '—')}</span>
              </div>
            </div>
            {/* 숫자버튼 겹침을 방지하기 위해 고정 사이즈 적용 (compact에서도 팝업 크기에 맞춰 10% 확대) */}
            <div className={`grid grid-cols-3 ${compact ? 'gap-[13px] mb-[18px]' : 'gap-4 mb-6'}`}>
              {NUMBER_KEYS.map(num => (
                <button key={num} onClick={() => onNumberClick(num)} className={`mx-auto rounded-full bg-white text-stone-900 font-black shadow-[0_5px_0_#999] active:translate-y-1 active:shadow-none flex items-center justify-center transition-all ${compact ? 'w-[70px] h-[70px] text-3xl' : 'w-20 h-20 text-4xl'}`}>{num}</button>
              ))}
              <button onClick={onDelete} className={`mx-auto rounded-full bg-[#332a24] text-[#e8d5b5] font-black shadow-[0_5px_0_#1a1512] active:translate-y-1 flex items-center justify-center ${compact ? 'w-[70px] h-[70px] text-lg' : 'w-20 h-20 text-xl'}`}>지움</button>
              <button onClick={() => onNumberClick('0')} className={`mx-auto rounded-full bg-white text-stone-900 font-black shadow-[0_5px_0_#999] active:translate-y-1 active:shadow-none flex items-center justify-center transition-all ${compact ? 'w-[70px] h-[70px] text-3xl' : 'w-20 h-20 text-4xl'}`}>0</button>
              <button onClick={onReset} className={`mx-auto rounded-full bg-[#332a24] text-stone-400 font-black shadow-[0_5px_0_#1a1512] active:translate-y-1 flex items-center justify-center ${compact ? 'w-[70px] h-[70px] text-lg' : 'w-20 h-20 text-xl'}`}>취소</button>
            </div>
            <button onClick={onSearchUser} disabled={isProcessing} className={`w-full bg-[#b88c42] hover:bg-[#a37934] text-stone-950 font-black rounded-2xl shadow-[0_5px_0_#755520] active:translate-y-1 transition-all disabled:opacity-50 ${compact ? 'py-[18px] text-xl xl:text-2xl' : 'py-5 text-2xl xl:text-3xl'}`}>
              {isProcessing ? '확인 중...' : '확인 (입력완료)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
