'use client';

import { KifuMove } from '../types';

interface GoBoardProps {
  size?: number; // 바둑판 줄 수 (기본 19줄)
  moves: KifuMove[];
  interactive?: boolean;
  onIntersectionClick?: (x: number, y: number) => void;
  className?: string;
}

const CELL = 40;
const MARGIN = 32;

// 19줄 바둑판 기준 화점(성점) 위치. 다른 크기는 성점 없이 그린다.
const STAR_POINTS_19 = [3, 9, 15];

export default function GoBoard({ size = 19, moves, interactive = false, onIntersectionClick, className = '' }: GoBoardProps) {
  const span = (size - 1) * CELL;
  const viewBoxSize = span + MARGIN * 2;
  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;

  const findMove = (x: number, y: number) => moves.find((m) => m.x === x && m.y === y);

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
          const move = findMove(x, y);
          const cx = MARGIN + x * CELL;
          const cy = MARGIN + y * CELL;
          return (
            <g key={`pt-${x}-${y}`}>
              {interactive && !move && (
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
              {move && (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={CELL / 2 - 2}
                    fill={move.color === 'black' ? '#1a1a1a' : '#f7f3ec'}
                    stroke={move.color === 'black' ? '#000' : '#8c7a5c'}
                    strokeWidth={1.2}
                  />
                  {lastMove === move && (
                    <circle cx={cx} cy={cy} r={6} fill={move.color === 'black' ? '#f7f3ec' : '#1a1a1a'} />
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
