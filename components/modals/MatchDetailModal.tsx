import { useEffect, useState } from 'react';
import { Match, Profile, KifuMove } from '../../types';
import { TerritoryResult } from '../../lib/goRules';
import GoBoard from '../GoBoard';
import ScoringPanel from './ScoringPanel';

export type QuickAction = 'register' | 'match_wizard' | 'attendance';

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
  onOpenQuickAction: (action: QuickAction) => void;
}

// 승부 확정/무효 처리 버튼 묶음. 일반 모드와 중계 확대 모드 양쪽에서 재사용한다.
function EndMatchControls({
  confirmAction,
  setConfirmAction,
  endMatch,
  isProcessing,
  hasKifu,
  onStartScoring,
}: Pick<MatchDetailModalProps, 'confirmAction' | 'setConfirmAction' | 'endMatch' | 'isProcessing'> & { hasKifu: boolean; onStartScoring: () => void }) {
  if (!confirmAction) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setConfirmAction('black_win')} className="py-4 bg-stone-900 border-2 border-stone-600 text-white text-2xl font-black rounded-2xl hover:bg-black transition-all shadow-lg">⚫ 흑승</button>
        <button onClick={() => setConfirmAction('white_win')} className="py-4 bg-white border-2 border-stone-300 text-stone-900 text-2xl font-black rounded-2xl hover:bg-stone-100 transition-all shadow-lg">⚪ 백승</button>
        {hasKifu && (
          <button onClick={onStartScoring} className="col-span-2 py-3 bg-[#b88c42] hover:bg-[#a67a35] text-[#1f1a16] text-xl font-black rounded-2xl transition-all shadow-lg">📐 계가로 승부 확정 (집 세기)</button>
        )}
        <button onClick={() => setConfirmAction('cancel')} className="col-span-2 py-3 bg-red-950/60 text-red-400 text-[26px] font-bold rounded-2xl hover:bg-red-900 hover:text-white border border-red-800 transition-all">대국 취소 (무효)</button>
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
  onOpenQuickAction,
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
              <GoBoard size={match.board_size} moves={kifu} interactive onIntersectionClick={onPlaceKifuMove} />
            </div>
          </div>

          {/* 우측: 남는 공간에 대국/대국자 정보와 조작 버튼을 심플하게 배치 */}
          <div className="w-full lg:w-[400px] shrink-0 border-t-2 lg:border-t-0 lg:border-l-2 border-stone-800 p-6 flex flex-col gap-4 overflow-y-auto">
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
            </div>

            <div className="rounded-2xl border border-stone-700 bg-[linear-gradient(90deg,#0f0d0c_0%,#0f0d0c_49.5%,#f9f6f2_49.5%,#f9f6f2_100%)] p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <div className="min-w-0 text-left">
                  {blackProfiles.length > 0 ? blackProfiles.map(p => (
                    <div key={p.id}>
                      <p className="text-xl font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                      <p className="text-lg font-bold text-stone-400">{p.rank}</p>
                    </div>
                  )) : <p className="text-stone-500">-</p>}
                </div>
                <span className="text-lg font-black tracking-[0.2em] text-[#dcb36c]">VS</span>
                <div className="min-w-0 text-right">
                  {whiteProfiles.length > 0 ? whiteProfiles.map(p => (
                    <div key={p.id}>
                      <p className="text-xl font-black text-stone-900 whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                      <p className="text-lg font-bold text-stone-600">{p.rank}</p>
                    </div>
                  )) : <p className="text-stone-500">-</p>}
                </div>
              </div>
            </div>

            <button
              onClick={onUndoKifuMove}
              disabled={kifu.length === 0}
              className="w-full rounded-xl bg-stone-700 hover:bg-stone-600 disabled:opacity-40 px-4 py-2.5 text-lg font-black text-white transition-all"
            >
              한 수 되돌리기
            </button>
            <button
              onClick={() => onToggleStreaming(false)}
              className="w-full rounded-xl bg-red-700 hover:bg-red-600 px-4 py-2.5 text-lg font-black text-white transition-all"
            >
              중계 종료
            </button>

            {/* 출석부 역할도 겸하는 태블릿 특성상, 중계 도중에도 입/퇴장이나 신규가입 등을
                다른 화면 전환 없이 팝업으로 바로 처리할 수 있게 한다. */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-800">
              <button onClick={() => onOpenQuickAction('attendance')} className="rounded-xl bg-[#332a24] hover:bg-[#443830] border border-[#b88c42] px-2 py-3 text-sm font-black text-[#e8d5b5] transition-all">🚪 입장/귀가</button>
              <button onClick={() => onOpenQuickAction('register')} className="rounded-xl bg-[#332a24] hover:bg-[#443830] border border-[#b88c42] px-2 py-3 text-sm font-black text-[#e8d5b5] transition-all">📝 신규가입</button>
              <button onClick={() => onOpenQuickAction('match_wizard')} className="rounded-xl bg-[#332a24] hover:bg-[#443830] border border-[#b88c42] px-2 py-3 text-sm font-black text-[#e8d5b5] transition-all">⚔️ 대국신청</button>
            </div>

            <div className="pt-2 border-t border-stone-800">
              <EndMatchControls confirmAction={confirmAction} setConfirmAction={setConfirmAction} endMatch={endMatch} isProcessing={isProcessing} hasKifu={kifu.length > 0} onStartScoring={() => setIsScoring(true)} />
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
        </div>

        <div className="rounded-3xl border border-stone-700 bg-[linear-gradient(90deg,#0f0d0c_0%,#0f0d0c_49.5%,#f9f6f2_49.5%,#f9f6f2_100%)] p-4 mb-8 shadow-inner">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <div className="space-y-2 text-left">
              {blackProfiles.length > 0 ? blackProfiles.map(p => (
                <div key={p.id}>
                  <p className="text-[36px] leading-tight font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                  <p className="text-[35px] leading-tight font-bold text-stone-400">{p.rank}</p>
                </div>
              )) : <p className="text-stone-500">-</p>}
            </div>
            <span className="text-2xl font-black tracking-[0.2em] text-[#dcb36c]">VS</span>
            <div className="space-y-2 text-right">
              {whiteProfiles.length > 0 ? whiteProfiles.map(p => (
                <div key={p.id}>
                  <p className="text-[36px] leading-tight font-black text-stone-900 whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</p>
                  <p className="text-[35px] leading-tight font-bold text-stone-600">{p.rank}</p>
                </div>
              )) : <p className="text-stone-500">-</p>}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-700 bg-[#120f0d] p-5 mb-8">
          <div className="flex items-center justify-between">
            <p className="text-xl font-black text-white flex items-center gap-2">📡 실시간 기보 중계</p>
            <button
              onClick={() => onToggleStreaming(true)}
              className="rounded-xl px-4 py-2 text-xl font-black transition-all bg-[#b88c42] hover:bg-[#a67a35] text-[#1f1a16]"
            >
              중계 시작
            </button>
          </div>
        </div>

        <EndMatchControls confirmAction={confirmAction} setConfirmAction={setConfirmAction} endMatch={endMatch} isProcessing={isProcessing} hasKifu={kifu.length > 0} onStartScoring={() => setIsScoring(true)} />
      </div>
    </div>
  );
}
