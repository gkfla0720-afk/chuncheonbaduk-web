import { KifuMove } from '../types';

export type Stone = 'black' | 'white';
export type Board = (Stone | null)[][]; // board[y][x]

export interface ReplayResult {
  board: Board;
  // 대국 중 상대에게 따인(사석 처리된) 돌의 개수. blackCaptures = 흑이 백을 잡은 수.
  blackCaptures: number;
  whiteCaptures: number;
  // 각 수를 두고 난 직후의 보드 상태 스냅샷(패 규칙 판정에 사용).
  boardHistory: Board[];
}

const emptyBoard = (size: number): Board => Array.from({ length: size }, () => Array<Stone | null>(size).fill(null));

const cloneBoard = (board: Board): Board => board.map((row) => [...row]);

const inBounds = (size: number, x: number, y: number) => x >= 0 && x < size && y >= 0 && y < size;

const neighbors = (size: number, x: number, y: number) =>
  [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ].filter(([nx, ny]) => inBounds(size, nx, ny)) as [number, number][];

// 같은 색으로 연결된 돌 그룹과 그 그룹의 활로(liberty)를 찾는다.
function findGroup(board: Board, size: number, x: number, y: number) {
  const color = board[y][x];
  if (!color) return { color, stones: [] as [number, number][], liberties: new Set<string>() };
  const stones: [number, number][] = [];
  const liberties = new Set<string>();
  const visited = new Set<string>();
  const stack: [number, number][] = [[x, y]];
  visited.add(`${x},${y}`);
  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    stones.push([cx, cy]);
    for (const [nx, ny] of neighbors(size, cx, cy)) {
      const key = `${nx},${ny}`;
      const cell = board[ny][nx];
      if (cell === null) {
        liberties.add(key);
      } else if (cell === color && !visited.has(key)) {
        visited.add(key);
        stack.push([nx, ny]);
      }
    }
  }
  return { color, stones, liberties };
}

// 기보 전체를 처음부터 다시 재생해 사석(따낸 돌)까지 반영한 "현재 보드"를 계산한다.
// alive 플래그 등을 별도로 저장하지 않고 항상 순수 재생으로 도출하므로,
// 한 수 되돌리기(undo)는 배열 마지막 원소만 지우면 자동으로 정합성이 맞는다.
export function replayKifu(kifu: KifuMove[], size: number): ReplayResult {
  const board = emptyBoard(size);
  const boardHistory: Board[] = [];
  let blackCaptures = 0;
  let whiteCaptures = 0;

  for (const move of kifu) {
    const { x, y, color } = move;
    if (!inBounds(size, x, y) || board[y][x] !== null) {
      // 손상된 데이터는 무시하고 계속 진행(방어적 처리)
      boardHistory.push(cloneBoard(board));
      continue;
    }
    board[y][x] = color;
    const opponent: Stone = color === 'black' ? 'white' : 'black';
    for (const [nx, ny] of neighbors(size, x, y)) {
      if (board[ny][nx] === opponent) {
        const group = findGroup(board, size, nx, ny);
        if (group.liberties.size === 0) {
          for (const [gx, gy] of group.stones) board[gy][gx] = null;
          if (color === 'black') blackCaptures += group.stones.length;
          else whiteCaptures += group.stones.length;
        }
      }
    }
    boardHistory.push(cloneBoard(board));
  }

  return { board, blackCaptures, whiteCaptures, boardHistory };
}

export interface MoveAttemptResult {
  legal: boolean;
  reason?: string;
  captured?: [number, number][];
}

// 새 착수가 바둑 규칙(자충수/패)상 유효한지 검사한다. 유효하면 캡처된 돌 좌표도 함께 반환.
export function checkMoveLegality(kifu: KifuMove[], size: number, x: number, y: number, color: Stone): MoveAttemptResult {
  if (!inBounds(size, x, y)) return { legal: false, reason: '바둑판 범위를 벗어났습니다.' };

  const { board: currentBoard, boardHistory } = replayKifu(kifu, size);
  if (currentBoard[y][x] !== null) return { legal: false, reason: '이미 돌이 놓인 자리입니다.' };

  const candidate = cloneBoard(currentBoard);
  candidate[y][x] = color;

  const opponent: Stone = color === 'black' ? 'white' : 'black';
  const captured: [number, number][] = [];
  for (const [nx, ny] of neighbors(size, x, y)) {
    if (candidate[ny][nx] === opponent) {
      const group = findGroup(candidate, size, nx, ny);
      if (group.liberties.size === 0) {
        for (const stone of group.stones) captured.push(stone);
      }
    }
  }
  for (const [cx, cy] of captured) candidate[cy][cx] = null;

  const ownGroup = findGroup(candidate, size, x, y);
  if (ownGroup.liberties.size === 0) {
    return { legal: false, reason: '자충수(자살수)입니다. 상대 돌을 따내지 못하면 둘 수 없습니다.' };
  }

  // 패(ko) 규칙: 이번 수를 둔 결과가 상대의 직전 수를 두기 전 보드와 완전히 같다면 금지.
  // boardHistory[i] = i+1번째 수를 둔 직후의 보드. 상대의 직전 수는 kifu 마지막 수이므로,
  // "그 직전"의 보드는 boardHistory[length-2] (두 수 전 보드)에 해당한다.
  if (captured.length > 0 && kifu.length >= 1) {
    const prevBoard = kifu.length >= 2 ? boardHistory[kifu.length - 2] : emptyBoard(size);
    const sameAsPrev = prevBoard.every((row, ry) => row.every((cell, rx) => cell === candidate[ry][rx]));
    if (sameAsPrev) {
      return { legal: false, reason: '패(ko) 규칙 위반입니다. 상대가 먼저 다른 곳에 착수한 뒤 다시 시도하세요.' };
    }
  }

  return { legal: true, captured };
}

export interface TerritoryResult {
  blackTerritory: number;
  whiteTerritory: number;
  blackScore: number;
  whiteScore: number;
  margin: number; // 양수면 흑이 이 집수만큼, 음수면 백이 그만큼 앞섬
  winner: '흑' | '백' | '무승부';
}

// 일본식 계가: 사석(대국 중 따낸 돌 + 종국 시 관리자가 표시한 죽은 돌) + 집(빈 영역 중 한쪽 색으로만 둘러싸인 곳)
export function calculateJapaneseScore(
  kifu: KifuMove[],
  size: number,
  komi: number,
  deadStones: { x: number; y: number }[]
): TerritoryResult {
  const { board, blackCaptures, whiteCaptures } = replayKifu(kifu, size);

  // 관리자가 죽었다고 표시한 돌은 보드에서 제거하고, 상대의 사석으로 집계한다.
  let blackDeadRemoved = 0;
  let whiteDeadRemoved = 0;
  const finalBoard = cloneBoard(board);
  for (const { x, y } of deadStones) {
    if (!inBounds(size, x, y)) continue;
    const stone = finalBoard[y][x];
    if (stone === 'black') { blackDeadRemoved += 1; finalBoard[y][x] = null; }
    else if (stone === 'white') { whiteDeadRemoved += 1; finalBoard[y][x] = null; }
  }

  // 빈 영역을 flood fill해서 인접한 색이 한쪽뿐이면 그 색의 집으로 센다.
  const visited = new Set<string>();
  let blackTerritory = 0;
  let whiteTerritory = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const key = `${x},${y}`;
      if (finalBoard[y][x] !== null || visited.has(key)) continue;
      const region: [number, number][] = [];
      const borderColors = new Set<Stone>();
      const stack: [number, number][] = [[x, y]];
      visited.add(key);
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        region.push([cx, cy]);
        for (const [nx, ny] of neighbors(size, cx, cy)) {
          const cell = finalBoard[ny][nx];
          const nkey = `${nx},${ny}`;
          if (cell === null) {
            if (!visited.has(nkey)) { visited.add(nkey); stack.push([nx, ny]); }
          } else {
            borderColors.add(cell);
          }
        }
      }
      if (borderColors.size === 1) {
        const owner = [...borderColors][0];
        if (owner === 'black') blackTerritory += region.length;
        else whiteTerritory += region.length;
      }
    }
  }

  const blackPrisoners = blackCaptures + whiteDeadRemoved; // 흑이 잡은 백돌(대국 중 + 종국 사석)
  const whitePrisoners = whiteCaptures + blackDeadRemoved; // 백이 잡은 흑돌
  const blackScore = blackTerritory + blackPrisoners;
  const whiteScore = whiteTerritory + whitePrisoners + komi;
  const margin = blackScore - whiteScore;

  return {
    blackTerritory,
    whiteTerritory,
    blackScore,
    whiteScore,
    margin,
    winner: margin > 0 ? '흑' : margin < 0 ? '백' : '무승부',
  };
}

// 지정한 좌표와 같은 색으로 연결된 돌 그룹 전체의 좌표를 반환한다(죽은 돌 표시용 토글 클릭에 사용).
export function findConnectedGroup(kifu: KifuMove[], size: number, x: number, y: number): [number, number][] {
  const { board } = replayKifu(kifu, size);
  if (!inBounds(size, x, y) || board[y][x] === null) return [];
  return findGroup(board, size, x, y).stones;
}
