'use client';

import { useState } from 'react';
import OnScreenKeyboard, { appendJamo } from '../OnScreenKeyboard';

interface RegisterModalProps {
  regName: string;
  setRegName: (name: string | ((prev: string) => string)) => void;
  regPhone: string;
  setRegPhone: (phone: string | ((prev: string) => string)) => void;
  regRank: string;
  handleRankChange: (delta: number) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isProcessing: boolean;
}

export default function RegisterModal({
  regName,
  setRegName,
  regPhone,
  setRegPhone,
  regRank,
  handleRankChange,
  onCancel,
  onSubmit,
  isProcessing,
}: RegisterModalProps) {
  // 키오스크(터치스크린) 환경에서는 물리 키보드가 없을 수 있으므로 화면 키보드로 입력받는다.
  const [activeField, setActiveField] = useState<'name' | 'phone'>('name');
  const [shift, setShift] = useState(false);

  // 짧은 시간에 연속으로 눌러도 유실 없이 조합되도록 함수형 업데이트를 사용한다.
  const handleKey = (value: string) => {
    if (activeField === 'name') {
      setRegName(prev => appendJamo(prev, value));
      setShift(false);
    } else {
      setRegPhone(prev => (prev.length < 4 ? prev + value : prev));
    }
  };

  const handleBackspace = () => {
    if (activeField === 'name') setRegName(prev => prev.slice(0, -1));
    else setRegPhone(prev => prev.slice(0, -1));
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-3 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* 화면 전반을 넓게 활용해 좌측(입력 필드)과 우측(큰 키보드)을 나란히 배치, 세로 넘침을 막는다 */}
      <div className="modal-card w-full h-full max-h-[96vh] max-w-6xl bg-[#1f1a16] text-white p-6 xl:p-8 rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.28)] border-4 border-[#b88c42] flex flex-col">
        <h2 className="text-3xl font-black text-[#e8d5b5] mb-4 text-center shrink-0">📝 신규 회원 등록</h2>
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
          {/* 좌측: 입력 필드 - 우측 키보드가 세로 중앙 정렬되어 있으므로 높이/중심을 맞춘다 */}
          <div className="space-y-4 text-left lg:w-[360px] shrink-0 lg:flex lg:flex-col lg:justify-center">
            <div>
              <label className="text-stone-300 text-xl font-bold mb-1.5 block">회원 성함</label>
              <input
                type="text"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                onFocus={() => setActiveField('name')}
                className={`w-full p-4 text-2xl font-bold bg-[#120f0d] text-white rounded-2xl border-2 outline-none transition-colors ${activeField === 'name' ? 'border-[#dcb36c]' : 'border-stone-700'}`}
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="text-stone-300 text-xl font-bold mb-1.5 block">전화번호 뒷자리 4개 (출석용)</label>
              <input
                type="text"
                inputMode="none"
                value={regPhone}
                onChange={e => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onFocus={() => setActiveField('phone')}
                className={`w-full p-4 text-2xl font-bold bg-[#120f0d] text-white rounded-2xl border-2 outline-none transition-colors ${activeField === 'phone' ? 'border-[#dcb36c]' : 'border-stone-700'}`}
                placeholder="1234"
              />
            </div>
            <div>
              <label className="text-stone-300 text-xl font-bold mb-1.5 block">기력 (급/단)</label>
              <div className="flex justify-between items-center bg-[#120f0d] p-3 rounded-2xl border-2 border-stone-700">
                <button onClick={() => handleRankChange(-1)} className="w-14 h-14 bg-stone-800 rounded-full text-3xl font-black text-white hover:bg-stone-700 transition-colors">-</button>
                <span className="text-3xl font-black w-28 text-center text-[#dcb36c]">{regRank}</span>
                <button onClick={() => handleRankChange(1)} className="w-14 h-14 bg-stone-800 rounded-full text-3xl font-black text-white hover:bg-stone-700 transition-colors">+</button>
              </div>
            </div>

            <div className="hidden lg:flex gap-4 pt-4">
              <button onClick={onCancel} className="flex-1 py-4 bg-stone-800 text-stone-300 text-xl font-black rounded-2xl hover:bg-stone-700">취소</button>
              <button onClick={onSubmit} disabled={isProcessing} className="flex-1 py-4 bg-[#b88c42] hover:bg-[#a37934] text-stone-950 text-xl font-black rounded-2xl disabled:opacity-50 transition-all">
                {isProcessing ? '등록중' : '등록 완료'}
              </button>
            </div>
          </div>

          {/* 우측: 여유롭게 크게 키운 화면 키보드 */}
          <div className="flex-1 min-h-0 flex items-center">
            <OnScreenKeyboard
              mode={activeField === 'name' ? 'korean' : 'numeric'}
              onKey={handleKey}
              onBackspace={handleBackspace}
              shift={shift}
              onToggleShift={() => setShift(s => !s)}
              size="large"
            />
          </div>
        </div>

        <div className="flex lg:hidden gap-4 mt-6 shrink-0">
          <button onClick={onCancel} className="flex-1 py-4 bg-stone-800 text-stone-300 text-xl font-black rounded-2xl hover:bg-stone-700">취소</button>
          <button onClick={onSubmit} disabled={isProcessing} className="flex-1 py-4 bg-[#b88c42] hover:bg-[#a37934] text-stone-950 text-xl font-black rounded-2xl disabled:opacity-50 transition-all">
            {isProcessing ? '등록중' : '등록 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}
