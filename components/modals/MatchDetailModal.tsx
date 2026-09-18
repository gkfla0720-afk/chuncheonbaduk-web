import { useEffect, useState } from 'react';
import { Match, Profile, KifuMove } from '../../types';
import { TerritoryResult } from '../../lib/goRules';
import GoBoard from '../GoBoard';
import ScoringPanel from './ScoringPanel';
import CalculatorIcon from '../icons/CalculatorIcon';

interface MatchDetailModalProps {
  match: Match;
  blackProfiles: Profile[];
  whiteProfiles: Profile[];
  matchElapsed: string;
  confirmAction: 'black_win' | 'white_win' | 'cancel' | null;
  setConfirmAction: (action: 'black_win' | 'white_win' | 'cancel' | null) => void;
  endMatch: (result: string, scoring?: { result: TerritoryResult; deadStones: { x: number; y: number }[] }) => void;
  isProcessing: boolean;
  onClose: () => void;
  onToggleStreaming: (turnOn: boolean) => void;
  onPlaceKifuMove: (x: number, y: number) => void;
  onUndoKifuMove: () => void;
  onPassKifuMove: () => void;
  onOpenProfile: (profile: Profile) => void;
}

// 승부 확정/무효 처리 버튼 묶음. 일반 모드와 중계 확대 모드 양쪽에서 재사용한다.
// 대국 취소 버튼은 두 모드 모두 이 컴포넌트 밖(중계 종료 버튼 옆)에 배치되므로,
// 여기서는 흑승/백승/계가 3개만 한 줄로 표기한다.
function EndMatchControls({
  confirmAction,
  setConfirmAction,
  endMatch,
  isProcessing,
  hasKifu,
  onStartScoring,
  variant = 'full',
}: Pick<MatchDetailModalProps, 'confirmAction' | 'setConfirmAction' | 'endMatch' | 'isProcessing'> & { hasKifu: boolean; onStartScoring: () => void; variant?: 'full' | 'compact' }) {
  if (!confirmAction) {
    if (variant === 'compact') {
      return (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setConfirmAction('black_win')} className="py-3 bg-stone-900 border-2 border-stone-600 text-white text-lg font-black rounded-2xl hover:bg-black transition-all shadow-lg">⚫ 흑승</button>
          <button onClick={() => setConfirmAction('white_win')} className="py-3 bg-white border-2 border-stone-300 text-stone-900 text-lg font-black rounded-2xl hover:bg-stone-100 transition-all shadow-lg">⚪ 백승</button>
          {hasKifu ? (
            <button onClick={onStartScoring} className="py-3 bg-[#b88c42] hover:bg-[#a67a35] text-[#1f1a16] text-lg font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-1.5"><CalculatorIcon /> 계가</button>
          ) : (
            <span />
          )}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setConfirmAction('black_win')} className="py-4 bg-stone-900 border-2 border-stone-600 text-white text-2xl font-black rounded-2xl hover:bg-black transition-all shadow-lg">⚫ 흑승</button>
        <button onClick={() => setConfirmAction('white_win')} className="py-4 bg-white border-2 border-stone-300 text-stone-900 text-2xl font-black rounded-2xl hover:bg-stone-100 transition-all shadow-lg">⚪ 백승</button>
        {hasKifu ? (
          <button onClick={onStartScoring} className="py-4 bg-[#b88c42] hover:bg-[#a67a35] text-[#1f1a16] text-2xl font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"><CalculatorIcon /> 계가</button>
        ) : (
          <span />
        )}
      </div>
    );
  }
  return (
    <div className="bg-red-950/40 p-5 rounded-3xl border border-red-500/50">
      <h3 className="text-xl font-black text-white mb-4">{confirmAction === 'black_win' && '⚫ 흑 팀 승리로 확정할까요?'}{confirmAction === 'white_win' && '⚪ 백 팀 승리로 확정할까요?'}{confirmAction === 'cancel' && '정말 대국을 무효 처리할까요?'}</h3>
      <div className="flex gap-3">
        <button onClick={() => setConfirmAction(null)} className="flex-1 py-3 bg-stone-700 text-white text-lg font-black rounded-xl">돌아가기</button>
        <button onClick={() => endMatch(confirmAction === 'cancel' ? '취소' : confirmAction === 'black_win' ? '흑승' : '백승')} disabled={isProcessing} className="flex-1 py-3 bg-green-700 hover:bg-green-600 text-white text-lg font-black rounded-xl disabled:opacity-50 transition-all">
          {isProcessing ? '처리중' : '확정'}
        </button>
      </div>
    </div>
  );
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
  onToggleStreaming,
  onPlaceKifuMove,
  onUndoKifuMove,
  onPassKifuMove,
  onOpenProfile,
}: MatchDetailModalProps) {
  const kifu = (match.kifu as unknown as KifuMove[]) || [];
  // 중계를 시작하면 관리자가 돌을 놓기 편하도록 바둑판을 확대(전체화면풍) 모드로 자동 전환한다.
  // 언제든 '축소' 버튼으로 되돌아갈 수 있고, 중계를 끄면 자동으로 축소된다.
  const [boardExpanded, setBoardExpanded] = useState(match.is_streaming);
  useEffect(() => {
    setBoardExpanded(match.is_streaming);
  }, [match.is_streaming]);
  // 계가(집 세기) 모드: 종국된 바둑판을 크게 보여주고 죽은 돌을 표시해 자동으로 승부를 계산한다.
  const [isScoring, setIsScoring] = useState(false);

  // 태블릿 터치 특성상 한 번의 탭으로 바로 착수되면 실수가 잦으므로, 탭하면 우선 반투명
  // "가착수"만 표시하고 별도의 착수 버튼을 눌러야 실제 기보에 반영되도록 한다.
  // 다른 자리를 다시 탭하면 위치를 옮길 수 있고, 같은 자리를 다시 탭하면 취소된다.
  const [pendingMove, setPendingMove] = useState<{ x: number; y: number } | null>(null);
  const nextMoveColor: 'black' | 'white' = kifu.length % 2 === 0 ? 'black' : 'white';
  // 기보가 갱신되면(직접 확정했든, 다른 화면에서 두었든) 더는 유효하지 않으므로 가착수를 비운다.
  useEffect(() => {
    setPendingMove(null);
  }, [kifu.length]);

  const handleBoardTap = (x: number, y: number) => {
    setPendingMove((prev) => (prev && prev.x === x && prev.y === y ? null : { x, y }));
  };
  const confirmPendingMove = () => {
    if (!pendingMove) return;
    onPlaceKifuMove(pendingMove.x, pendingMove.y);
    setPendingMove(null);
  };

  const handleScoringConfirm = (result: TerritoryResult, deadStones: { x: number; y: number }[]) => {
    endMatch(result.winner === '흑' ? '흑승' : '백승', { result, deadStones });
  };

  if (isScoring) {
    return (
      <div
        className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.75)] p-3 backdrop-blur-[2px]"
        onClick={(e) => { if (e.target === e.currentTarget) setIsScoring(false); }}
      >
        <div className="modal-card relative w-full h-[96vh] max-w-[1500px] bg-[#1f1a16] text-white rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.4)] border-4 border-[#b88c42] overflow-hidden flex flex-col p-4 lg:p-6">
          <ScoringPanel
            kifu={kifu}
            boardSize={match.board_size}
            komi={match.komi}
            isProcessing={isProcessing}
            onCancel={() => setIsScoring(false)}
            onConfirm={handleScoringConfirm}
          />
        </div>
      </div>
    );
  }

  if (match.is_streaming && boardExpanded) {
    return (
      <div
        className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.75)] p-3 backdrop-blur-[2px]"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal-card relative w-full h-[96vh] max-w-[1500px] bg-[#1f1a16] text-white rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.4)] border-4 border-[#b88c42] overflow-hidden flex flex-col lg:flex-row">
          {/* 좌측: 대형 바둑판 - 관리자가 터치로 돌을 놓기 편하도록 화면 대부분을 차지 */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-[#120f0d] p-4 lg:p-8 gap-4">
            {/* SVG 바둑판은 자체 viewBox 비율을 유지한 채(letterbox) 이 박스를 최대한 채운다.
                aspect-square로 미리 정사각형을 강제하면 flex 레이아웃 계산 단계에서 실제
                가용 공간보다 작게 잡히는 문제가 있어, 넉넉한 박스만 주고 비율 유지는 SVG에 맡긴다. */}
            <div className="w-full h-full max-w-full max-h-full rounded-2xl overflow-hidden">
              <GoBoard
                size={match.board_size}
                moves={kifu}
                interactive
                onIntersectionClick={handleBoardTap}
                previewStone={pendingMove ? { ...pendingMove, color: nextMoveColor } : null}
              />
            </div>
          </div>

          {/* 우측: 남는 공간에 대국/대국자 정보와 조작 버튼을 심플하게 배치 */}
          <div className="w-full lg:w-[460px] shrink-0 border-t-2 lg:border-t-0 lg:border-l-2 border-stone-800 p-6 flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-xl font-black text-[#dcb36c] flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-lg font-black text-white animate-pulse">LIVE</span>
                실시간 기보 중계
              </p>
              <button onClick={() => setBoardExpanded(false)} className="rounded-xl bg-stone-700 hover:bg-stone-600 px-3 py-2 text-lg font-black text-white transition-all">축소</button>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-[#120f0d] p-4">
              <p className="text-xl font-extrabold text-[#dcb36c]">{match.match_type} / {match.handicap}</p>
              <p className="text-lg font-bold text-stone-400 mt-1">경과 시간: <span className="text-white text-xl ml-1 font-mono">{matchElapsed}</span></p>
              <p className="text-lg font-bold text-stone-400 mt-1">⚫ 흑 시간제한없음 · ⚪ 백 시간제한없음</p>
            </div>

            <div className="rounded-2xl border border-stone-700 bg-[linear-gradient(90deg,#0f0d0c_0%,#0f0d0c_49.5%,#f9f6f2_49.5%,#f9f6f2_100%)] p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <div className="min-w-0 text-left">
                  {blackProfiles.length > 0 ? blackProfiles.map(p => (
                    <button key={p.id} onClick={() => onOpenProfile(p)} className="block w-full text-left rounded-lg px-1 -mx-1 hover:bg-white/10 transition-colors">
                      <p className="text-xl font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                      <p className="text-lg font-bold text-stone-400">{p.rank}</p>
                    </button>
                  )) : <p className="text-stone-500">-</p>}
                </div>
                <span className="text-lg font-black tracking-[0.2em] text-[#dcb36c]">VS</span>
                <div className="min-w-0 text-right">
                  {whiteProfiles.length > 0 ? whiteProfiles.map(p => (
                    <button key={p.id} onClick={() => onOpenProfile(p)} className="block w-full text-right rounded-lg px-1 -mx-1 hover:bg-black/10 transition-colors">
                      <p className="text-xl font-black text-stone-900 whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                      <p className="text-lg font-bold text-stone-600">{p.rank}</p>
                    </button>
                  )) : <p className="text-stone-500">-</p>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onUndoKifuMove}
                disabled={kifu.length === 0}
                className="w-full rounded-xl bg-stone-700 hover:bg-stone-600 disabled:opacity-40 px-4 py-2.5 text-lg font-black text-white transition-all"
              >
                ↩️ 한 수 되돌리기
              </button>
              <button
                onClick={onPassKifuMove}
                className="w-full rounded-xl bg-[#4a3620] hover:bg-[#5c4429] border border-[#b88c42] px-4 py-2.5 text-lg font-black text-[#e8c98a] transition-all"
              >
                ⏭️ 착수 넘김
              </button>
            </div>
            <button
              onClick={confirmPendingMove}
              disabled={!pendingMove}
              className={`w-full rounded-xl px-4 py-3 text-lg font-black transition-all ${
                pendingMove
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg animate-pulse'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed'
              }`}
            >
              {pendingMove ? `✅ ${pendingMove.x + 1}열 ${pendingMove.y + 1}행 착수 확정` : '바둑판을 탭해 착수 위치를 선택하세요'}
            </button>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                onClick={() => onToggleStreaming(false)}
                className="w-full rounded-xl bg-red-700 hover:bg-red-600 px-4 py-2.5 text-lg font-black text-white transition-all"
              >
                중계 종료
              </button>
              <button
                onClick={() => setConfirmAction('cancel')}
                className="rounded-xl bg-red-950/60 text-red-400 px-4 py-2.5 text-base font-bold hover:bg-red-900 hover:text-white border border-red-800 transition-all"
              >
                대국 취소
              </button>
            </div>

            <div className="pt-2 border-t border-stone-800">
              <EndMatchControls confirmAction={confirmAction} setConfirmAction={setConfirmAction} endMatch={endMatch} isProcessing={isProcessing} hasKifu={kifu.length > 0} onStartScoring={() => setIsScoring(true)} variant="compact" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-card relative w-full max-w-3xl bg-[#1f1a16] text-white p-10 rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.28)] border-4 border-[#b88c42] text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/30 text-2xl font-black text-stone-200 hover:bg-black/50 hover:text-white"
        >
          ✕
        </button>
        <h2 className="text-3xl font-black text-white mb-6">진행 중인 대국 관리</h2>
        <div className="bg-[#120f0d] p-6 rounded-3xl mb-6 flex flex-col gap-2 border border-stone-800">
          <p className="text-2xl font-extrabold text-[#dcb36c]">{match.match_type} / {match.handicap}</p>
          <p className="text-xl font-bold text-stone-400">대국 경과 시간: <span className="text-white text-3xl ml-2 font-mono">{matchElapsed}</span></p>
          <p className="text-xl font-bold text-stone-400">⚫ 흑 시간제한없음 · ⚪ 백 시간제한없음</p>
        </div>

        <div className="rounded-3xl border border-stone-700 bg-[linear-gradient(90deg,#0f0d0c_0%,#0f0d0c_49.5%,#f9f6f2_49.5%,#f9f6f2_100%)] p-4 mb-8 shadow-inner">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <div className="space-y-2 text-left">
              {blackProfiles.length > 0 ? blackProfiles.map(p => (
                <button key={p.id} onClick={() => onOpenProfile(p)} className="block w-full text-left rounded-xl px-2 -mx-2 hover:bg-white/10 transition-colors">
                  <p className="text-[36px] leading-tight font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                  <p className="text-[35px] leading-tight font-bold text-stone-400">{p.rank}</p>
                </button>
              )) : <p className="text-stone-500">-</p>}
            </div>
            <span className="text-2xl font-black tracking-[0.2em] text-[#dcb36c]">VS</span>
            <div className="space-y-2 text-right">
              {whiteProfiles.length > 0 ? whiteProfiles.map(p => (
                <button key={p.id} onClick={() => onOpenProfile(p)} className="block w-full text-right rounded-xl px-2 -mx-2 hover:bg-black/10 transition-colors">
                  <p className="text-[36px] leading-tight font-black text-stone-900 whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                  <p className="text-[35px] leading-tight font-bold text-stone-600">{p.rank}</p>
                </button>
              )) : <p className="text-stone-500">-</p>}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-700 bg-[#120f0d] p-5 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-xl font-black text-white flex items-center gap-2">📡 실시간 기보 중계</p>
            {match.is_streaming ? (
              <button
                onClick={() => setBoardExpanded(true)}
                className="rounded-xl px-4 py-2 text-xl font-black transition-all bg-stone-800 border border-red-500 text-red-400 hover:bg-stone-700 flex items-center gap-2"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                중계중
              </button>
            ) : (
              <button
                onClick={() => onToggleStreaming(true)}
                className="rounded-xl px-4 py-2 text-xl font-black transition-all bg-[#b88c42] hover:bg-[#a67a35] text-[#1f1a16]"
              >
                중계 시작
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 mb-6">
          <button
            onClick={() => onToggleStreaming(false)}
            disabled={!match.is_streaming}
            className="w-full rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-xl font-black text-white transition-all"
          >
            중계 종료
          </button>
          <button
            onClick={() => setConfirmAction('cancel')}
            className="rounded-xl bg-red-950/60 text-red-400 px-4 py-3 text-lg font-bold hover:bg-red-900 hover:text-white border border-red-800 transition-all"
          >
            대국 취소
          </button>
        </div>

        <EndMatchControls confirmAction={confirmAction} setConfirmAction={setConfirmAction} endMatch={endMatch} isProcessing={isProcessing} hasKifu={kifu.length > 0} onStartScoring={() => setIsScoring(true)} />
      </div>
    </div>
  );
}
