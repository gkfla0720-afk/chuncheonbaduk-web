import { useState } from 'react';
import GoBoard from '../GoBoard';
import { KifuMove } from '../../types';
import { calculateJapaneseScore, findConnectedGroup, TerritoryResult, Stone } from '../../lib/goRules';

interface ScoringPanelProps {
  kifu: KifuMove[];
  boardSize: number;
  komi: number;
  isProcessing: boolean;
  onCancel: () => void;
  onConfirm: (result: TerritoryResult, deadStones: { x: number; y: number }[]) => void;
}

// 일본식 계가(집 세기) 화면: 관리자가 종국된 바둑판에서 죽은 돌(사석)을 탭해 표시하면
// lib/goRules.ts가 실시간으로 바둑 규칙에 가까운 세력/집 추정을 계산해 승부를 미리 보여준다.
// - 사방이 막힌 확정가와 세력이 뚜렷한 자리는 자동으로 집에 포함된다.
// - 상대 돌과 맞닿은 접전지나 세력 차이가 애매한 자리는 자동으로 세지 않고, 바닥에 옅게 표시만 되며
//   관리자가 직접 땅을 눌러 원하는 색으로 지정해야 최종 집수에 반영된다(땅 tap = 집으로 지정, 돌 tap = 사석 처리).
export default function ScoringPanel({ kifu, boardSize, komi, isProcessing, onCancel, onConfirm }: ScoringPanelProps) {
  const [deadStones, setDeadStones] = useState<{ x: number; y: number }[]>([]);
  const [manualTerritory, setManualTerritory] = useState<Record<string, Stone>>({});

  // 돌 하나를 탭하면 같은 색으로 연결된 그룹 전체가 한번에 죽은 돌/산 돌로 토글된다.
  const toggleDeadGroup = (x: number, y: number) => {
    const group = findConnectedGroup(kifu, boardSize, x, y);
    if (group.length === 0) return;
    setDeadStones((prev) => {
      const groupKeys = new Set(group.map(([gx, gy]) => `${gx},${gy}`));
      const alreadyDead = prev.some((d) => groupKeys.has(`${d.x},${d.y}`));
      const withoutGroup = prev.filter((d) => !groupKeys.has(`${d.x},${d.y}`));
      if (alreadyDead) return withoutGroup;
      return [...withoutGroup, ...group.map(([gx, gy]) => ({ x: gx, y: gy }))];
    });
  };

  // 빈 땅을 탭하면 흑집 -> 백집 -> (지정 해제, 자동 판정 사용) 순으로 순환한다.
  // 확정가/강세로 이미 자동 인정된 자리도 관리자가 원하면 반대로 뒤집을 수 있다.
  const toggleManualTerritory = (x: number, y: number) => {
    const key = `${x},${y}`;
    setManualTerritory((prev) => {
      const next = { ...prev };
      const current = next[key];
      if (!current) next[key] = 'black';
      else if (current === 'black') next[key] = 'white';
      else delete next[key];
      return next;
    });
  };

  const result = calculateJapaneseScore(kifu, boardSize, komi, deadStones, manualTerritory);

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
        <p className="text-lg font-bold text-stone-300 text-center px-2">
          📐 죽은 돌(사석)은 돌을 탭, 집으로 정할 땅은 빈 자리를 탭하세요.
        </p>
        <div className="w-full h-full max-w-full max-h-full rounded-2xl overflow-hidden border-2 border-[#b88c42] shadow-lg">
          <GoBoard
            size={boardSize}
            moves={kifu}
            onStoneClick={toggleDeadGroup}
            onEmptyPointClick={toggleManualTerritory}
            deadStones={deadStones}
            territoryMap={result.territoryMap}
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm font-bold text-stone-400">
          <span className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 bg-white/65" />강세/확정가 (자동 집 인정)</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 bg-white/45" />보통 (탭해서 지정 필요)</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 bg-white/30" />약세/접전지 (탭해서 지정 필요)</span>
        </div>
      </div>

      <div className="w-full lg:w-[360px] shrink-0 flex flex-col gap-4">
        <div className="rounded-2xl border border-stone-700 bg-[#120f0d] p-5">
          <p className="text-xl font-black text-[#dcb36c] mb-3">계가 결과</p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-black/30 p-3">
              <p className="text-lg font-bold text-stone-400">⚫ 흑</p>
              <p className="text-3xl font-black text-white">{result.blackScore}집</p>
              <p className="text-sm text-stone-500 mt-1">집 {result.blackTerritory}집 + 사석</p>
            </div>
            <div className="rounded-xl bg-black/30 p-3">
              <p className="text-lg font-bold text-stone-400">⚪ 백</p>
              <p className="text-3xl font-black text-white">{result.whiteScore}집</p>
              <p className="text-sm text-stone-500 mt-1">집 {result.whiteTerritory}집 + 사석 + 덤{komi}</p>
            </div>
          </div>
          <p className="mt-4 text-center text-2xl font-black text-[#dcb36c]">
            {result.winner === '무승부' ? '무승부 (사석 표시를 다시 확인해주세요)' : `${result.winner} ${Math.abs(result.margin)}집 승`}
          </p>
        </div>

        <button onClick={onCancel} className="w-full py-3 bg-stone-700 hover:bg-stone-600 text-white text-lg font-black rounded-xl transition-all">
          계가 취소하고 돌아가기
        </button>
        <button
          onClick={() => onConfirm(result, deadStones)}
          disabled={isProcessing || result.winner === '무승부'}
          className="w-full py-4 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xl font-black rounded-xl transition-all"
        >
          {isProcessing ? '처리중' : '이 결과로 대국 종료'}
        </button>
      </div>
    </div>
  );
}
