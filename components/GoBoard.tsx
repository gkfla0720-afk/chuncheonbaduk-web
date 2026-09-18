'use client';

import { KifuMove } from '../types';
import { replayKifu, TerritoryMap, isPassMove } from '../lib/goRules';

interface GoBoardProps {
  size?: number; // 바둑판 줄 수 (기본 19줄)
  moves: KifuMove[];
  interactive?: boolean;
  onIntersectionClick?: (x: number, y: number) => void;
  // 계가(집 세기) 모드: 이미 놓인 돌을 탭해 사석(죽은 돌) 그룹을 표시할 때 사용.
  onStoneClick?: (x: number, y: number) => void;
  deadStones?: { x: number; y: number }[];
  // 계가 모드에서 빈 땅을 탭해 특정 색의 집으로 직접 지정할 때 사용.
  onEmptyPointClick?: (x: number, y: number) => void;
  // 계가 화면에서 세력/집 판정을 바닥에 표기하기 위한 지점별 데이터.
  territoryMap?: TerritoryMap;
  className?: string;
}

const CELL = 40;
const MARGIN = 32;

// 19줄 바둑판 기준 화점(성점) 위치. 다른 크기는 성점 없이 그린다.
const STAR_POINTS_19 = [3, 9, 15];

// 계가 화면에서 세력의 강약을 사각형 크기로 직관적으로 표현한다.
// 중립(owner 없음)은 아무 표시도 하지 않고, 강세는 돌(원)에 내접하는 정사각형보다 다소 작게,
// 보통/약세는 그보다 더 작은 정사각형으로 세력 차이를 시각적으로 구분한다.
const STONE_RADIUS = CELL / 2 - 2;
const INSCRIBED_HALF = (STONE_RADIUS * Math.SQRT2) / 2; // 원에 내접하는 정사각형의 반변 길이
const TIER_STYLE: Record<string, { half: number; opacity: number }> = {
  confirmed: { half: INSCRIBED_HALF * 0.78, opacity: 0.62 },
  strong: { half: INSCRIBED_HALF * 0.78, opacity: 0.55 },
  normal: { half: INSCRIBED_HALF * 0.48, opacity: 0.42 },
  weak: { half: INSCRIBED_HALF * 0.26, opacity: 0.32 },
};

export default function GoBoard({ size = 19, moves, interactive = false, onIntersectionClick, onStoneClick, deadStones = [], onEmptyPointClick, territoryMap, className = '' }: GoBoardProps) {
  const span = (size - 1) * CELL;
  const viewBoxSize = span + MARGIN * 2;

  // 사석(따낸 돌) 처리까지 반영한 "현재 보드"를 다시 재생해서 계산한다.
  // 단순히 kifu 배열을 그대로 그리면 따인 돌까지 남아있게 되므로 반드시 재생 결과를 사용해야 한다.
  const { board } = replayKifu(moves, size);
  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;
  const lastMoveAlive = lastMove && !isPassMove(lastMove) && board[lastMove.y][lastMove.x] === lastMove.color;
  const isDead = (x: number, y: number) => deadStones.some((d) => d.x === x && d.y === y);

  const lines = Array.from({ length: size }, (_, i) => MARGIN + i * CELL);

  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      className={`w-full h-full select-none ${className}`}
      style={{ touchAction: 'manipulation' }}
    >
      <rect x={0} y={0} width={viewBoxSize} height={viewBoxSize} rx={12} fill="#e6bb6a" />

      {lines.map((pos, i) => (
        <line key={`h-${i}`} x1={MARGIN} y1={pos} x2={MARGIN + span} y2={pos} stroke="#3a2a17" strokeWidth={1.5} />
      ))}
      {lines.map((pos, i) => (
        <line key={`v-${i}`} x1={pos} y1={MARGIN} x2={pos} y2={MARGIN + span} stroke="#3a2a17" strokeWidth={1.5} />
      ))}

      {size === 19 &&
        STAR_POINTS_19.flatMap((sx) =>
          STAR_POINTS_19.map((sy) => (
            <circle key={`star-${sx}-${sy}`} cx={MARGIN + sx * CELL} cy={MARGIN + sy * CELL} r={4} fill="#3a2a17" />
          ))
        )}

      {Array.from({ length: size }, (_, y) =>
        Array.from({ length: size }, (_, x) => {
          const stoneColor = board[y][x];
          const cx = MARGIN + x * CELL;
          const cy = MARGIN + y * CELL;
          const dead = stoneColor !== null && isDead(x, y);
          const territory = !stoneColor ? territoryMap?.[`${x},${y}`] : undefined;
          const tierStyle = territory && territory.owner ? TIER_STYLE[territory.tier] : undefined;
          return (
            <g key={`pt-${x}-${y}`}>
              {interactive && !stoneColor && (
                <rect
                  x={cx - CELL / 2}
                  y={cy - CELL / 2}
                  width={CELL}
                  height={CELL}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onIntersectionClick?.(x, y)}
                />
              )}
              {/* 계가 모드 세력/집 표기: 강세는 원(돌)에 내접하는 크기의 사각형, 보통/약세는 그보다 작은 사각형 */}
              {tierStyle && (
                <rect
                  x={cx - tierStyle.half}
                  y={cy - tierStyle.half}
                  width={tierStyle.half * 2}
                  height={tierStyle.half * 2}
                  rx={2}
                  fill={territory!.owner === 'black' ? '#1a1a1a' : '#f7f3ec'}
                  fillOpacity={tierStyle.opacity}
                  stroke={territory!.owner === 'black' ? '#000' : '#8c7a5c'}
                  strokeOpacity={tierStyle.opacity}
                  strokeWidth={1}
                />
              )}
              {!stoneColor && onEmptyPointClick && (
                <rect
                  x={cx - CELL / 2}
                  y={cy - CELL / 2}
                  width={CELL}
                  height={CELL}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onEmptyPointClick(x, y)}
                />
              )}
              {stoneColor && (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={CELL / 2 - 2}
                    fill={stoneColor === 'black' ? '#1a1a1a' : '#f7f3ec'}
                    stroke={stoneColor === 'black' ? '#000' : '#8c7a5c'}
                    strokeWidth={1.2}
                    opacity={dead ? 0.35 : 1}
                    className={onStoneClick ? 'cursor-pointer' : undefined}
                    onClick={() => onStoneClick?.(x, y)}
                  />
                  {dead && (
                    <g pointerEvents="none">
                      <line x1={cx - 10} y1={cy - 10} x2={cx + 10} y2={cy + 10} stroke="#dc2626" strokeWidth={3} />
                      <line x1={cx - 10} y1={cy + 10} x2={cx + 10} y2={cy - 10} stroke="#dc2626" strokeWidth={3} />
                    </g>
                  )}
                  {!dead && lastMoveAlive && lastMove!.x === x && lastMove!.y === y && (
                    <circle cx={cx} cy={cy} r={6} fill={stoneColor === 'black' ? '#f7f3ec' : '#1a1a1a'} />
                  )}
                </>
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}
