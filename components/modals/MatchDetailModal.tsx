import { Match, Profile } from '../../types';

interface MatchDetailModalProps {
  match: Match;
  blackProfiles: Profile[];
  whiteProfiles: Profile[];
  matchElapsed: string;
  confirmAction: 'black_win' | 'white_win' | 'cancel' | null;
  setConfirmAction: (action: 'black_win' | 'white_win' | 'cancel' | null) => void;
  endMatch: (result: string) => void;
  isProcessing: boolean;
  onClose: () => void;
}

export default function MatchDetailModal({
  match,
  blackProfiles,
  whiteProfiles,
  matchElapsed,
  confirmAction,
  setConfirmAction,
  endMatch,
  isProcessing,
  onClose,
}: MatchDetailModalProps) {
  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]">
      <div className="modal-card w-full max-w-3xl bg-[#1f1a16] text-white p-10 rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.28)] border-4 border-[#b88c42] text-center">
        <h2 className="text-3xl font-black text-white mb-6">진행 중인 대국 관리</h2>
        <div className="bg-[#120f0d] p-6 rounded-3xl mb-6 flex flex-col gap-2 border border-stone-800">
          <p className="text-2xl font-extrabold text-[#dcb36c]">{match.match_type} / {match.handicap}</p>
          <p className="text-lg font-bold text-stone-400">대국 경과 시간: <span className="text-white text-3xl ml-2 font-mono">{matchElapsed}</span></p>
        </div>

        <div className="rounded-3xl border border-stone-700 bg-[linear-gradient(90deg,#0f0d0c_0%,#0f0d0c_49.5%,#f9f6f2_49.5%,#f9f6f2_100%)] p-4 mb-8 shadow-inner">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <div className="space-y-2 text-left">
              {blackProfiles.length > 0 ? blackProfiles.map(p => (
                <div key={p.id}>
                  <p className="text-2xl font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                  <p className="text-sm font-bold text-stone-400">{p.rank}</p>
                </div>
              )) : <p className="text-stone-500">-</p>}
            </div>
            <span className="text-2xl font-black tracking-[0.2em] text-[#dcb36c]">VS</span>
            <div className="space-y-2 text-right">
              {whiteProfiles.length > 0 ? whiteProfiles.map(p => (
                <div key={p.id}>
                  <p className="text-2xl font-black text-stone-900 whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                  <p className="text-sm font-bold text-stone-600">{p.rank}</p>
                </div>
              )) : <p className="text-stone-500">-</p>}
            </div>
          </div>
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
        <button onClick={onClose} className="w-full py-4 text-stone-400 hover:text-white font-bold text-lg bg-stone-900 rounded-2xl">닫기</button>
      </div>
    </div>
  );
}
