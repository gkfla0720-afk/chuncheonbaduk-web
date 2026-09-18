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
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]">
      <div className="modal-card w-full max-w-xl bg-[#1f1a16] text-white p-10 rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.28)] border-4 border-[#b88c42] text-center">
        <h2 className="text-3xl font-black text-[#e8d5b5] mb-6">📝 신규 회원 등록</h2>
        <div className="space-y-5 text-left">
          <div>
            <label className="text-stone-300 text-sm font-bold mb-1.5 block">회원 성함</label>
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
            <label className="text-stone-300 text-sm font-bold mb-1.5 block">전화번호 뒷자리 4개 (출석용)</label>
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
            <label className="text-stone-300 text-sm font-bold mb-1.5 block">기력 (급/단)</label>
            <div className="flex justify-between items-center bg-[#120f0d] p-3 rounded-2xl border-2 border-stone-700">
              <button onClick={() => handleRankChange(-1)} className="w-14 h-14 bg-stone-800 rounded-full text-3xl font-black text-white hover:bg-stone-700 transition-colors">-</button>
              <span className="text-3xl font-black w-28 text-center text-[#dcb36c]">{regRank}</span>
              <button onClick={() => handleRankChange(1)} className="w-14 h-14 bg-stone-800 rounded-full text-3xl font-black text-white hover:bg-stone-700 transition-colors">+</button>
            </div>
          </div>

          <OnScreenKeyboard
            mode={activeField === 'name' ? 'korean' : 'numeric'}
            onKey={handleKey}
            onBackspace={handleBackspace}
            shift={shift}
            onToggleShift={() => setShift(s => !s)}
          />
        </div>
        <div className="flex gap-4 mt-8">
          <button onClick={onCancel} className="flex-1 py-4 bg-stone-800 text-stone-300 text-xl font-black rounded-2xl hover:bg-stone-700">취소</button>
          <button onClick={onSubmit} disabled={isProcessing} className="flex-1 py-4 bg-[#b88c42] hover:bg-[#a37934] text-stone-950 text-xl font-black rounded-2xl disabled:opacity-50 transition-all">
            {isProcessing ? '등록중' : '등록 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}
