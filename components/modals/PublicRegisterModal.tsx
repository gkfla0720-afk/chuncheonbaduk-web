'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RANKS } from '@/lib/ranks';
import { normalizePhoneDigits, isValidPhoneNumber, toPhoneLast4 } from '@/lib/phone';

interface PublicRegisterModalProps {
  onClose: () => void;
}

export default function PublicRegisterModal({ onClose }: PublicRegisterModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rank, setRank] = useState('10급');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!name.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!isValidPhoneNumber(phone)) { setError('전화번호를 올바르게 입력해주세요.'); return; }
    setError('');
    setIsSubmitting(true);
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{ name: name.trim(), phone, phone_last4: toPhoneLast4(phone), rank, tier: '준회원' }]);
    if (insertError) {
      console.error(insertError);
      setError('가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    setIsDone(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,24,20,0.6)] p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-[28px] border border-[#d4c3a2] bg-[#f8f4ee] p-6 shadow-[0_18px_45px_rgba(34,27,20,0.32)]">
        {isDone ? (
          <div className="text-center">
            <p className="text-3xl">🎉</p>
            <h2 className="mt-3 text-2xl font-black text-[#2a241d]">가입이 완료되었습니다!</h2>
            <p className="mt-2 text-lg text-stone-600">기원에 방문하시면 입장 시 전화번호 뒷자리 4자리로 바로 이용하실 수 있습니다.</p>
            <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-[#b88c42] px-4 py-3 text-lg font-black text-stone-950 hover:bg-[#a37934]">확인</button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-black text-[#2a241d]">📝 신규 회원 가입</h2>
            <p className="mt-1 text-lg text-stone-500">이벤트/대회 안내 연락을 위해 전체 전화번호가 필요합니다.</p>

            <div className="mt-5 space-y-4 text-left">
              <div>
                <label className="mb-1.5 block text-lg font-bold text-stone-700">성함</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full rounded-2xl border-2 border-stone-300 bg-white p-3 text-xl font-bold text-stone-900 outline-none focus:border-[#b88c42]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-lg font-bold text-stone-700">전화번호</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={e => setPhone(normalizePhoneDigits(e.target.value).slice(0, 11))}
                  placeholder="01012345678"
                  className="w-full rounded-2xl border-2 border-stone-300 bg-white p-3 text-xl font-bold text-stone-900 outline-none focus:border-[#b88c42]"
                />
                <p className="mt-1.5 text-sm text-stone-500">입장/귀가 시에는 이 번호의 뒷자리 4자리만 입력하면 됩니다.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-lg font-bold text-stone-700">기력 (급/단)</label>
                <select
                  value={rank}
                  onChange={e => setRank(e.target.value)}
                  className="w-full rounded-2xl border-2 border-stone-300 bg-white p-3 text-xl font-bold text-stone-900 outline-none focus:border-[#b88c42]"
                >
                  {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {error && <p className="mt-3 text-lg font-bold text-red-600">{error}</p>}

            <div className="mt-6 flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-2xl bg-stone-200 px-4 py-3 text-lg font-black text-stone-700 hover:bg-stone-300">취소</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 rounded-2xl bg-[#b88c42] px-4 py-3 text-lg font-black text-stone-950 hover:bg-[#a37934] disabled:opacity-50">
                {isSubmitting ? '가입 처리 중' : '가입하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
