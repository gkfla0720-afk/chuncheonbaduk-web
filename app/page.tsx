'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  name: string;
  phone_last4: string;
  rank: string;
  tier: string;
}

export default function KioskPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null); // 확인 대기 중인 회원
  const [lastAttendanceId, setLastAttendanceId] = useState<number | null>(null); // 방금 출석한 기록 ID
  const [message, setMessage] = useState('전화번호 뒷자리 4자리를 눌러주세요.');
  const [isSuccess, setIsSuccess] = useState(false);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 전체 초기화
  const handleReset = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setPhoneNumber('');
    setCandidates([]);
    setConfirmUser(null);
    setLastAttendanceId(null);
    setMessage('전화번호 뒷자리 4자리를 눌러주세요.');
    setIsSuccess(false);
  };

  // 번호 키패드 클릭
  const handleNumberClick = (num: string) => {
    if (phoneNumber.length < 4) {
      setPhoneNumber((prev) => prev + num);
    }
  };

  // 지움 버튼
  const handleDelete = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  // 1. 번호 입력 후 검색
  const handleSearchUser = async () => {
    if (phoneNumber.length !== 4) {
      setMessage('뒷자리 4자리를 모두 입력해주세요.');
      return;
    }

    setMessage('회원 정보 확인 중...');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone_last4', phoneNumber);

    if (error || !data || data.length === 0) {
      setMessage('등록되지 않은 번호입니다. 카운터에 문의해주세요.');
      return;
    }

    if (data.length > 1) {
      // 번호가 겹치는 사람이 여러 명인 경우 선택창 표시
      setCandidates(data);
      setMessage('동일한 번호의 회원이 있습니다. 본인 이름을 선택해주세요.');
    } else {
      // 1명인 경우 바로 확인 창 띄우기
      setConfirmUser(data[0]);
    }
  };

  // 2. 최종 출석 확정 및 DB 저장
  const handleConfirmAttendance = async () => {
    if (!confirmUser) return;

    // 출석 데이터 저장 후 방금 생성된 id를 반환받음 (.select('id'))
    const { data, error } = await supabase
      .from('attendance')
      .insert([{ user_id: confirmUser.id, status: '출석중' }])
      .select('id')
      .single();

    if (error || !data) {
      setMessage('출석 등록에 실패했습니다. 관리자에게 문의하세요.');
      return;
    }

    // 방금 저장된 출석 기록 번호(ID) 보관
    setLastAttendanceId(data.id);
    setIsSuccess(true);
    setMessage(`환영합니다! ${confirmUser.name}님 (${confirmUser.rank} / ${confirmUser.tier})`);
    setConfirmUser(null);
    setCandidates([]);

    // 5초 뒤에 자동으로 초기 화면으로 복귀
    resetTimerRef.current = setTimeout(() => {
      handleReset();
    }, 5000);
  };

  // 3. [출석 취소] 방금 등록된 출석 삭제하기
  const handleCancelAttendance = async () => {
    if (!lastAttendanceId) return;

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    // Supabase에서 방금 등록된 출석 기록 삭제 (DELETE)
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', lastAttendanceId);

    if (error) {
      alert('출석 취소 중 오류가 발생했습니다.');
    } else {
      alert('출석이 정상적으로 취소되었습니다.');
    }

    handleReset();
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 select-none">
      {/* 상단 타이틀 */}
      <div className="text-center mb-6">
        <span className="bg-amber-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          Chuncheon Baduk Club
        </span>
        <h1 className="text-4xl font-extrabold mt-2 text-amber-400">춘천기원 출석체크</h1>
        <p className={`mt-3 text-lg font-medium ${isSuccess ? 'text-green-400 text-2xl font-bold' : 'text-slate-300'}`}>
          {message}
        </p>
      </div>

      {/* 1. 출석 완료 화면 (실수 시 취소할 수 있는 버튼 제공) */}
      {isSuccess ? (
        <div className="w-full max-w-sm bg-slate-800 p-6 rounded-3xl border border-green-500/50 shadow-2xl text-center space-y-6">
          <div className="text-6xl animate-bounce">🎉</div>
          <p className="text-slate-300 text-sm">
            5초 후 자동으로 첫 화면으로 돌아갑니다.
          </p>
          <button
            onClick={handleCancelAttendance}
            className="w-full py-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold rounded-xl transition text-lg shadow-lg"
          >
            앗, 잘못 눌렀어요! (출석 취소)
          </button>
          <button
            onClick={handleReset}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold rounded-xl transition text-sm"
          >
            바로 다음 분 출석하기
          </button>
        </div>
      ) : confirmUser ? (
        /* 2. 본인 확인 단계 (실수 방지 모달) */
        <div className="w-full max-w-sm bg-slate-800 p-6 rounded-3xl border border-amber-500/50 shadow-2xl text-center space-y-5">
          <p className="text-slate-400 text-sm">출석 정보를 확인해주세요</p>
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700">
            <h2 className="text-3xl font-extrabold text-amber-400">{confirmUser.name}</h2>
            <p className="text-slate-300 text-lg mt-1">
              급수: <span className="font-bold text-white">{confirmUser.rank}</span> / 등급: <span className="text-amber-300">{confirmUser.tier}</span>
            </p>
          </div>
          <p className="text-xl font-bold text-white">본인이 맞으십니까?</p>
          
          <button
            onClick={handleConfirmAttendance}
            className="w-full py-4 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-extrabold rounded-xl text-2xl transition shadow-lg"
          >
            예, 맞습니다 (출석)
          </button>
          <button
            onClick={handleReset}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition"
          >
            아닙니다 (취소)
          </button>
        </div>
      ) : candidates.length > 0 ? (
        /* 3. 번호 중복자 선택 단계 */
        <div className="w-full max-w-sm bg-slate-800 p-6 rounded-3xl border border-slate-700 space-y-4">
          <p className="text-center text-amber-300 font-semibold mb-2">본인의 이름을 선택해주세요</p>
          {candidates.map((cand) => (
            <button
              key={cand.id}
              onClick={() => {
                setConfirmUser(cand);
                setCandidates([]);
              }}
              className="w-full py-4 bg-amber-600 hover:bg-amber-500 rounded-xl text-xl font-bold transition flex justify-between px-6 items-center shadow-lg"
            >
              <span>{cand.name}</span>
              <span className="text-base bg-amber-800 px-3 py-1 rounded-lg">{cand.rank}</span>
            </button>
          ))}
          <button
            onClick={handleReset}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-slate-300 transition mt-4"
          >
            다시 입력하기
          </button>
        </div>
      ) : (
        /* 4. 기본 키패드 입력 화면 */
        <div className="w-full max-w-sm bg-slate-800/90 border border-slate-700 p-6 rounded-3xl shadow-2xl">
          {/* 번호 표시창 */}
          <div className="bg-slate-950 border-2 border-slate-700 rounded-2xl h-20 flex items-center justify-center mb-6">
            <span className="text-5xl font-mono tracking-widest text-amber-400 font-bold">
              {phoneNumber.padEnd(4, '—')}
            </span>
          </div>

          {/* 숫자 키패드 3x4 */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className="h-16 text-3xl font-bold bg-slate-700/60 active:bg-amber-600 hover:bg-slate-600 rounded-xl transition flex items-center justify-center shadow"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleDelete}
              className="h-16 text-lg font-bold bg-rose-900/60 active:bg-rose-700 hover:bg-rose-800 rounded-xl transition flex items-center justify-center text-rose-200"
            >
              지움
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              className="h-16 text-3xl font-bold bg-slate-700/60 active:bg-amber-600 hover:bg-slate-600 rounded-xl transition flex items-center justify-center shadow"
            >
              0
            </button>
            <button
              onClick={handleReset}
              className="h-16 text-lg font-bold bg-slate-600/60 active:bg-slate-500 hover:bg-slate-600 rounded-xl transition flex items-center justify-center text-slate-300"
            >
              취소
            </button>
          </div>

          {/* 확인 버튼 */}
          <button
            onClick={handleSearchUser}
            className="w-full h-16 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-2xl font-extrabold rounded-xl shadow-lg transition"
          >
            확인
          </button>
        </div>
      )}
    </main>
  );
}