'use client';

// 키오스크 환경(터치스크린)에서 물리 키보드 없이도 한글 이름/숫자를 입력할 수 있도록 하는
// 화면 키보드입니다. 2벌식 자판 배열을 기준으로 자음/모음을 조합해 완성형 한글 음절을 만듭니다.

const CHO_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG_LIST = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG_LIST = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

const VOWEL_COMBOS: Record<string, Record<string, string>> = {
  'ㅗ': { 'ㅏ': 'ㅘ', 'ㅐ': 'ㅙ', 'ㅣ': 'ㅚ' },
  'ㅜ': { 'ㅓ': 'ㅝ', 'ㅔ': 'ㅞ', 'ㅣ': 'ㅟ' },
  'ㅡ': { 'ㅣ': 'ㅢ' },
};

const JONG_COMBOS: Record<string, Record<string, string>> = {
  'ㄱ': { 'ㅅ': 'ㄳ' },
  'ㄴ': { 'ㅈ': 'ㄵ', 'ㅎ': 'ㄶ' },
  'ㄹ': { 'ㄱ': 'ㄺ', 'ㅁ': 'ㄻ', 'ㅂ': 'ㄼ', 'ㅅ': 'ㄽ', 'ㅌ': 'ㄾ', 'ㅍ': 'ㄿ', 'ㅎ': 'ㅀ' },
  'ㅂ': { 'ㅅ': 'ㅄ' },
};

const JONG_SPLIT: Record<string, [string, string]> = {
  'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'],
  'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'],
};

const isVowel = (ch: string) => JUNG_LIST.includes(ch);
const isCho = (ch: string) => CHO_LIST.includes(ch);

function composeSyllable(choIdx: number, jungIdx: number, jongIdx: number) {
  return String.fromCharCode(0xac00 + choIdx * 21 * 28 + jungIdx * 28 + jongIdx);
}

function decompose(syllable: string) {
  const code = syllable.charCodeAt(0) - 0xac00;
  return {
    choIdx: Math.floor(code / (21 * 28)),
    jungIdx: Math.floor((code % (21 * 28)) / 28),
    jongIdx: code % 28,
  };
}

function isSyllable(ch: string) {
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3;
}

// 문자열 끝에 자모 하나를 조합해 붙인다 (2벌식 자모 조합 알고리즘)
function appendJamo(str: string, ch: string): string {
  if (str.length === 0) return ch;
  const last = str[str.length - 1];

  if (isSyllable(last)) {
    const { choIdx, jungIdx, jongIdx } = decompose(last);
    if (isVowel(ch)) {
      if (jongIdx === 0) {
        const combo = VOWEL_COMBOS[JUNG_LIST[jungIdx]]?.[ch];
        if (combo) return str.slice(0, -1) + composeSyllable(choIdx, JUNG_LIST.indexOf(combo), 0);
        return str + ch;
      }
      const jongChar = JONG_LIST[jongIdx];
      const split = JONG_SPLIT[jongChar];
      if (split) {
        const [stay, move] = split;
        const fixed = str.slice(0, -1) + composeSyllable(choIdx, jungIdx, JONG_LIST.indexOf(stay));
        return fixed + composeSyllable(CHO_LIST.indexOf(move), JUNG_LIST.indexOf(ch), 0);
      }
      const fixed = str.slice(0, -1) + composeSyllable(choIdx, jungIdx, 0);
      return fixed + composeSyllable(CHO_LIST.indexOf(jongChar), JUNG_LIST.indexOf(ch), 0);
    }
    // 자음 입력
    if (jongIdx === 0) {
      const newJongIdx = JONG_LIST.indexOf(ch);
      if (newJongIdx > 0) return str.slice(0, -1) + composeSyllable(choIdx, jungIdx, newJongIdx);
      return str + ch;
    }
    const combo = JONG_COMBOS[JONG_LIST[jongIdx]]?.[ch];
    if (combo) return str.slice(0, -1) + composeSyllable(choIdx, jungIdx, JONG_LIST.indexOf(combo));
    return str + ch;
  }

  if (isCho(last) && isVowel(ch)) {
    return str.slice(0, -1) + composeSyllable(CHO_LIST.indexOf(last), JUNG_LIST.indexOf(ch), 0);
  }
  return str + ch;
}

const HANGUL_ROWS: [string, string | null][][] = [
  [['ㅂ', 'ㅃ'], ['ㅈ', 'ㅉ'], ['ㄷ', 'ㄸ'], ['ㄱ', 'ㄲ'], ['ㅅ', 'ㅆ'], ['ㅛ', null], ['ㅕ', null], ['ㅑ', null], ['ㅐ', null], ['ㅔ', null]],
  [['ㅁ', null], ['ㄴ', null], ['ㅇ', null], ['ㄹ', null], ['ㅎ', null], ['ㅗ', null], ['ㅓ', null], ['ㅏ', null], ['ㅣ', null]],
  [['ㅋ', null], ['ㅌ', null], ['ㅊ', null], ['ㅍ', null], ['ㅠ', null], ['ㅜ', null], ['ㅡ', null]],
];

interface OnScreenKeyboardProps {
  mode: 'korean' | 'numeric';
  onKey: (value: string) => void;
  onBackspace: () => void;
  shift: boolean;
  onToggleShift: () => void;
}

export default function OnScreenKeyboard({ mode, onKey, onBackspace, shift, onToggleShift }: OnScreenKeyboardProps) {
  const keyClass = 'flex-1 h-11 xl:h-12 min-w-0 rounded-xl bg-stone-800 text-white text-xl font-black shadow-[0_3px_0_#0a0908] active:translate-y-0.5 active:shadow-none flex items-center justify-center transition-all hover:bg-stone-700';

  if (mode === 'numeric') {
    return (
      <div className="grid grid-cols-3 gap-2 bg-[#120f0d] p-3 rounded-2xl border-2 border-stone-700">
        {['1','2','3','4','5','6','7','8','9'].map(n => (
          <button key={n} type="button" onClick={() => onKey(n)} className={keyClass}>{n}</button>
        ))}
        <button type="button" onClick={onBackspace} className={`${keyClass} bg-[#7a4b2b]`}>지움</button>
        <button type="button" onClick={() => onKey('0')} className={keyClass}>0</button>
        <div />
      </div>
    );
  }

  return (
    <div className="space-y-2 bg-[#120f0d] p-3 rounded-2xl border-2 border-stone-700">
      {HANGUL_ROWS.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          {row.map(([normal, shifted]) => (
            <button
              key={normal}
              type="button"
              onClick={() => onKey(shift && shifted ? shifted : normal)}
              className={keyClass}
            >
              {shift && shifted ? shifted : normal}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-1.5">
        <button type="button" onClick={onToggleShift} className={`${keyClass} flex-[1.4] ${shift ? 'bg-[#dcb36c] text-stone-900' : ''}`}>쌍자음</button>
        <button type="button" onClick={() => onKey(' ')} className={`${keyClass} flex-[3]`}>스페이스</button>
        <button type="button" onClick={onBackspace} className={`${keyClass} flex-[1.4] bg-[#7a4b2b]`}>지움</button>
      </div>
    </div>
  );
}

export { appendJamo };
