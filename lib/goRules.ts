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

// "착수 넘김(pass)"은 x/y가 모두 -1인 특수 좌표로 표현한다. 실제 바둑판에는 아무 영향이 없다.
export const isPassMove = (move: Pick<KifuMove, 'x' | 'y'>): boolean => move.x < 0 || move.y < 0;

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
    if (isPassMove(move)) {
      // 착수 넘김: 보드 상태 변화 없이 히스토리에만 한 칸을 채워 인덱스를 맞춘다.
      boardHistory.push(cloneBoard(board));
      continue;
    }
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

export type TerritoryTier = 'confirmed' | 'strong' | 'normal' | 'weak' | 'neutral';

export interface TerritoryPoint {
  owner: Stone | null; // null이면 완전 중립(양쪽 어디에도 속하지 않는 덤/무주지)
  tier: TerritoryTier;
}

// 좌표키(`x,y`) -> 판정 결과. 돌이 놓인 자리는 포함하지 않는다(빈 자리만 대상).
export type TerritoryMap = Record<string, TerritoryPoint>;

export interface TerritoryResult {
  blackTerritory: number;
  whiteTerritory: number;
  blackScore: number;
  whiteScore: number;
  margin: number; // 양수면 흑이 이 집수만큼, 음수면 백이 그만큼 앞섬
  winner: '흑' | '백' | '무승부';
  // 계가 화면에서 바닥에 세력/집 표기를 그리기 위한 지점별 판정 결과.
  territoryMap: TerritoryMap;
}

// 실제 계가 감각에 가깝게 빈 자리들을 판정한다.
// 1) 한쪽 색으로만 완전히 둘러싸인 영역(사방이 막힌 집) -> '확정가'로 100% 인정.
// 2) 그렇지 않은(=상대 돌과도 연결된 '접전지') 빈 자리는 흑/백 돌 중 어느 쪽이 더 가까운지로 세력을 추정한다.
//    - 상대 돌과 바로 인접해 있으면 접전지이므로 보수적으로 판단(강세로 인정하지 않는다).
//    - 그 외에는 거리 차이가 클수록(세력이 강할수록) '강세'로 인정해 확정가처럼 계산하고,
//      거리 차이가 애매하면 '보통', 차이가 거의 없으면 '약세'/'중립'으로 표기해 계가 확정 전에는 집으로 세지 않는다.
export function estimateTerritory(board: Board, size: number): TerritoryMap {
  const map: TerritoryMap = {};
  const visited = new Set<string>();

  // 1단계: 순수하게 한쪽 색으로만 둘러싸인 집(확정가)을 찾는다.
  const unresolved: [number, number][] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const key = `${x},${y}`;
      if (board[y][x] !== null || visited.has(key)) continue;
      const region: [number, number][] = [];
      const borderColors = new Set<Stone>();
      const stack: [number, number][] = [[x, y]];
      visited.add(key);
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        region.push([cx, cy]);
        for (const [nx, ny] of neighbors(size, cx, cy)) {
          const cell = board[ny][nx];
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
        for (const [rx, ry] of region) map[`${rx},${ry}`] = { owner, tier: 'confirmed' };
      } else {
        unresolved.push(...region);
      }
    }
  }

  if (unresolved.length === 0) return map;

  // 2단계: 접전지/세력 추정 - 흑돌/백돌 각각으로부터 다중 시작점 BFS로 최단 거리를 구한다.
  // 거리가 가까울수록(=주변에 자신의 세력이 강할수록) 그 색의 집일 확률이 높다고 본다.
  const INF = Infinity;
  const distBlack: number[][] = Array.from({ length: size }, () => Array(size).fill(INF));
  const distWhite: number[][] = Array.from({ length: size }, () => Array(size).fill(INF));
  const bfs = (dist: number[][], color: Stone) => {
    const queue: [number, number][] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (board[y][x] === color) { dist[y][x] = 0; queue.push([x, y]); }
      }
    }
    let head = 0;
    while (head < queue.length) {
      const [cx, cy] = queue[head++];
      for (const [nx, ny] of neighbors(size, cx, cy)) {
        if (dist[ny][nx] === INF) { dist[ny][nx] = dist[cy][cx] + 1; queue.push([nx, ny]); }
      }
    }
  };
  bfs(distBlack, 'black');
  bfs(distWhite, 'white');

  const STRONG_GAP = 4; // 이 이상 가까우면 세력이 강해 확정가로 인정
  const NORMAL_GAP = 2; // 이 이상이면 '보통', 그보다 작으면 '약세'

  for (const [x, y] of unresolved) {
    const db = distBlack[y][x];
    const dw = distWhite[y][x];
    if (db === INF && dw === INF) {
      map[`${x},${y}`] = { owner: null, tier: 'neutral' };
      continue;
    }
    const diff = dw - db; // 양수면 흑이 더 가까움
    if (diff === 0) {
      map[`${x},${y}`] = { owner: null, tier: 'neutral' };
      continue;
    }
    const owner: Stone = diff > 0 ? 'black' : 'white';
    const gap = Math.abs(diff);
    const touchesBlack = neighbors(size, x, y).some(([nx, ny]) => board[ny][nx] === 'black');
    const touchesWhite = neighbors(size, x, y).some(([nx, ny]) => board[ny][nx] === 'white');
    const isFrontline = touchesBlack && touchesWhite; // 양쪽 돌 모두와 바로 맞닿은 접전지
    let tier: TerritoryTier;
    if (isFrontline) {
      // 상대 돌과 바로 인접한 접전지는 보수적으로 판정(강세로 자동 인정하지 않는다).
      tier = 'weak';
    } else if (gap >= STRONG_GAP) {
      tier = 'strong';
    } else if (gap >= NORMAL_GAP) {
      tier = 'normal';
    } else {
      tier = 'weak';
    }
    map[`${x},${y}`] = { owner, tier };
  }

  return map;
}

// 일본식 계가: 사석(대국 중 따낸 돌 + 종국 시 관리자가 표시한 죽은 돌) + 집(확정가 + 강한 세력 + 관리자가 직접 지정한 자리)
export function calculateJapaneseScore(
  kifu: KifuMove[],
  size: number,
  komi: number,
  deadStones: { x: number; y: number }[],
  manualTerritory: Record<string, Stone> = {}
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

  const territoryMap = estimateTerritory(finalBoard, size);
  let blackTerritory = 0;
  let whiteTerritory = 0;
  for (const key of Object.keys(territoryMap)) {
    const manualOwner = manualTerritory[key];
    if (manualOwner) {
      // 관리자가 직접 땅을 눌러 지정한 자리는 판정과 무관하게 그 색의 집으로 확정한다.
      if (manualOwner === 'black') blackTerritory += 1; else whiteTerritory += 1;
      continue;
    }
    const { owner, tier } = territoryMap[key];
    // 확정가(사방이 막힌 집) + 세력이 강한 자리만 자동으로 집에 포함한다.
    // '보통'/'약세'/'중립'인 접전지는 관리자가 직접 눌러 지정하기 전까지는 집으로 세지 않는다.
    if ((tier === 'confirmed' || tier === 'strong') && owner) {
      if (owner === 'black') blackTerritory += 1; else whiteTerritory += 1;
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
    territoryMap,
  };
}

// 지정한 좌표와 같은 색으로 연결된 돌 그룹 전체의 좌표를 반환한다(죽은 돌 표시용 토글 클릭에 사용).
export function findConnectedGroup(kifu: KifuMove[], size: number, x: number, y: number): [number, number][] {
  const { board } = replayKifu(kifu, size);
  if (!inBounds(size, x, y) || board[y][x] === null) return [];
  return findGroup(board, size, x, y).stones;
}

// ── 치수(핸디캡)/덤 관련 규칙 ───────────────────────────────────────────────
// 대국 신청 화면(MatchWizard)과 실제 대국 기록 저장 로직(app/page.tsx)이 모두 이 값과
// 함수만 참조하도록 해서, 치수/덤 규칙을 바꿀 때 한 곳만 고치면 전체에 일관되게 반영된다.

export type HandicapType = '호선' | '정선' | '접바둑';

export const KOMI_HOSEON = 6.5; // 호선(맞바둑)의 표준 덤
export const KOMI_JEONGSEON = 0.5; // 정선의 표준 덤
export const MIN_HANDICAP_STONES = 2; // 접바둑에서 허용하는 최소 치석 수(1점 접바둑은 의미가 없어 제외)
export const MAX_HANDICAP_STONES = 9; // 접바둑에서 허용하는 최대 치석 수
export const HANDICAP_KOMI_STEP = 1;
export const HANDICAP_KOMI_MIN = 0.5;
export const HANDICAP_KOMI_MAX = 99.5;
export const MIN_REVERSE_KOMI = 15.5; // 0점 접바둑(치석 없이 역덤으로만 실력차 보정)에 필요한 최소 역덤

export function decrementHandicapStones(current: number): number {
  return current > MIN_HANDICAP_STONES ? current - 1 : 0;
}

export function incrementHandicapStones(current: number): number {
  return current === 0 ? MIN_HANDICAP_STONES : Math.min(current + 1, MAX_HANDICAP_STONES);
}

export function decrementKomi(current: number): number {
  return current > HANDICAP_KOMI_MIN ? current - HANDICAP_KOMI_STEP : HANDICAP_KOMI_MIN;
}

export function incrementKomi(current: number): number {
  return current < HANDICAP_KOMI_MAX ? current + HANDICAP_KOMI_STEP : HANDICAP_KOMI_MAX;
}

// 접바둑 0점(치석 없이 역덤만으로 보정)일 때는 최소 역덤 이상이어야 유효하다.
export function isHandicapSettingValid(handicapType: HandicapType, handicapStones: number, komi: number): boolean {
  return handicapType !== '접바둑' || handicapStones >= MIN_HANDICAP_STONES || (handicapStones === 0 && komi >= MIN_REVERSE_KOMI);
}

// 계가에 실제로 쓰이는 최종 덤 값. 접바둑 0점의 "역덤"은 흑에게 유리하도록 부호를 반전해서 저장해야
// calculateJapaneseScore의 whiteScore 계산(집+사석+덤)이 올바르게 나온다.
export function getFinalKomi(handicapType: HandicapType, handicapStones: number, komi: number): number {
  if (handicapType === '호선') return KOMI_HOSEON;
  if (handicapType === '정선') return KOMI_JEONGSEON;
  return handicapStones === 0 ? -komi : komi;
}

// 대국 기록(matches.handicap)에 저장할 치수 표기 문자열.
export function getHandicapLabel(handicapType: HandicapType, handicapStones: number, komi: number): string {
  if (handicapType === '접바둑') {
    return `접바둑 ${handicapStones}점 (${handicapStones === 0 ? '역덤' : '덤'} ${komi}집)`;
  }
  return `${handicapType}(덤 ${handicapType === '호선' ? KOMI_HOSEON : KOMI_JEONGSEON}집)`;
}
