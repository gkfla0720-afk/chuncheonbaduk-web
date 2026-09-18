import { Profile } from '../types';

interface MatchWizardProps {
  matchStep: number;
  setMatchStep: (step: number) => void;
  matchType: string;
  setMatchType: (type: string) => void;
  availableMembers: Profile[];
  blackTeam: Profile[];
  whiteTeam: Profile[];
  setBlackTeam: (team: Profile[]) => void;
  setWhiteTeam: (team: Profile[]) => void;
  selectMemberToTeam: (member: Profile) => void;
  drawMethod: '수동' | '랜덤';
  setDrawMethod: (method: '수동' | '랜덤') => void;
  applyAutoDraw: () => void;
  handicapType: '호선' | '정선' | '접바둑';
  setHandicapType: (type: '호선' | '정선' | '접바둑') => void;
  handicapStones: number;
  setHandicapStones: (updater: (prev: number) => number) => void;
  komi: number;
  setKomi: (updater: (prev: number) => number) => void;
  isHandicapValid: boolean;
  submitMatch: () => void;
  isProcessing: boolean;
  onClose: () => void;
}

const MATCH_TYPES = ['랭킹전', '친선전', '페어전(2:2)', '페어전(3:3)', '페어전(4:4)'];
const HANDICAP_TYPES = ['호선', '정선', '접바둑'] as const;

export default function MatchWizard({
  matchStep,
  setMatchStep,
  matchType,
  setMatchType,
  availableMembers,
  blackTeam,
  whiteTeam,
  setBlackTeam,
  setWhiteTeam,
  selectMemberToTeam,
  drawMethod,
  setDrawMethod,
  applyAutoDraw,
  handicapType,
  setHandicapType,
  handicapStones,
  setHandicapStones,
  komi,
  setKomi,
  isHandicapValid,
  submitMatch,
  isProcessing,
  onClose,
}: MatchWizardProps) {
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-card w-full max-w-3xl bg-[#1f1a16] text-white p-10 rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.28)] border-4 border-[#b88c42]">
        <button onClick={onClose} className="absolute top-6 right-6 text-stone-400 hover:text-white font-extrabold text-2xl">✕</button>
        <div className="flex gap-3 mb-8 justify-center">
          {[1, 2, 3, 4].map(step => (<div key={step} className={`h-2.5 w-16 rounded-full ${matchStep >= step ? 'bg-[#dcb36c]' : 'bg-stone-800'}`} />))}
        </div>

        {matchStep === 1 && (
          <div className="text-center">
            <h2 className="text-3xl font-black text-white mb-8">1. 대국 방식을 선택하세요</h2>
            <div className="grid grid-cols-2 gap-4">
              {MATCH_TYPES.map(type => (
                <button key={type} onClick={() => { setMatchType(type); setMatchStep(2); }} className="py-6 bg-[#120f0d] border-2 border-stone-700 rounded-3xl text-2xl font-black text-stone-200 hover:bg-[#b88c42] hover:text-stone-950 hover:border-[#b88c42] transition-all shadow-md">
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {matchStep === 2 && (
          <div className="text-center">
            <h2 className="text-3xl font-black text-white mb-2">2. 대국자를 선택하세요</h2>
            <p className="text-[#dcb36c] mb-6 text-xl font-bold">아래 목록에서 참가자를 선택하면 자동으로 흑/백 팀에 배치됩니다.</p>
            <div className="flex gap-5 items-start">
              <div className="w-[32%] min-w-[220px] bg-[#120f0d] p-4 rounded-3xl border-2 border-stone-700 shadow-inner">
                <h3 className="text-xl font-black text-white mb-4 border-b border-stone-800 pb-2">참가 인원</h3>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {availableMembers.length === 0 ? (
                    <p className="text-stone-500 pt-8 text-xl">선택 가능한 인원이 없습니다.</p>
                  ) : (
                    availableMembers.map(member => (
                      <button
                        key={member.id}
                        onClick={() => selectMemberToTeam(member)}
                        className="w-full flex items-center justify-between rounded-2xl border border-stone-700 bg-[#1b1714] px-3 py-2 text-left transition hover:border-[#dcb36c] hover:bg-[#2b221d]"
                      >
                        <span className="text-xl font-black text-white">{member.name}</span>
                        <span className="rounded-md bg-[#dcb36c] px-2 py-1 text-xl font-black text-stone-900">{member.rank}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="flex-1 flex gap-4">
                <div className="flex-1 bg-stone-900 p-5 rounded-3xl border-2 border-stone-700 shadow-inner">
                  <h3 className="text-2xl font-black text-white mb-4 border-b border-stone-800 pb-2">⚫ 흑 팀</h3>
                  <div className="space-y-3 min-h-[140px]">
                    {blackTeam.map(m => (
                      <div key={m.id} onClick={() => setBlackTeam(blackTeam.filter(p => p.id !== m.id))} className="bg-black/60 py-3 px-4 rounded-xl font-black text-xl text-white flex justify-between border border-stone-800 cursor-pointer hover:bg-red-900/80 transition-colors group">
                        <span>{m.name}</span>
                        <span className="text-[#dcb36c] group-hover:text-white">{m.rank} <span className="ml-2 text-red-400 group-hover:text-white">✕</span></span>
                      </div>
                    ))}
                    {blackTeam.length === 0 && <p className="text-stone-500 pt-8 text-xl">선수명을 선택해 주세요</p>}
                  </div>
                </div>

                <div className="flex-1 bg-white text-stone-900 p-5 rounded-3xl border-2 border-stone-300 shadow-inner">
                  <h3 className="text-2xl font-black text-stone-900 mb-4 border-b border-stone-200 pb-2">⚪ 백 팀</h3>
                  <div className="space-y-3 min-h-[140px]">
                    {whiteTeam.map(m => (
                      <div key={m.id} onClick={() => setWhiteTeam(whiteTeam.filter(p => p.id !== m.id))} className="bg-stone-50 py-3 px-4 rounded-xl font-black text-xl text-stone-900 flex justify-between border border-stone-300 cursor-pointer hover:bg-red-100 transition-colors group">
                        <span>{m.name}</span>
                        <span className="text-[#8a5a20] group-hover:text-red-500">{m.rank} <span className="ml-2 text-red-500">✕</span></span>
                      </div>
                    ))}
                    {whiteTeam.length === 0 && <p className="text-stone-400 pt-8 text-xl">백 팀도 같은 방식으로 선택</p>}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => setMatchStep(3)} disabled={blackTeam.length === 0 || whiteTeam.length === 0} className="mt-8 w-full py-5 bg-[#b88c42] hover:bg-[#a37934] disabled:bg-stone-800 text-stone-950 font-black text-2xl rounded-2xl transition-all">
              다음 단계로 ➔
            </button>
          </div>
        )}

        {matchStep === 3 && (
          <div className="text-center">
            <h2 className="text-3xl font-black text-white mb-8">3. 돌 가리기 방식을 선택하세요</h2>
            <div className="space-y-4">
              <button onClick={() => { setDrawMethod('수동'); setMatchStep(4); }} className="w-full py-6 bg-[#120f0d] border-2 border-stone-700 rounded-3xl text-2xl font-black text-stone-200 hover:bg-[#b88c42] hover:text-stone-950 hover:border-[#b88c42] transition-all">수동 (선택된 흑/백 순서대로 진행)</button>
              <button onClick={() => { setDrawMethod('랜덤'); setHandicapType('호선'); applyAutoDraw(); }} className="w-full py-6 bg-[#1b1714] border-2 border-[#dcb36c] rounded-3xl text-2xl font-black text-[#f2d8a1] hover:bg-[#2c231d] transition-all">자동 (랜덤 돌 가리기, 호선만 적용)</button>
            </div>
            <button onClick={() => setMatchStep(2)} className="mt-6 text-stone-400 hover:text-white font-bold text-xl">⬅ 이전 단계</button>
          </div>
        )}

        {matchStep === 4 && (
          <div className="text-center">
            <h2 className="text-3xl font-black text-white mb-6">4. 치수를 설정하세요</h2>
            {drawMethod === '랜덤' && (
              <div className="mb-5 rounded-2xl border border-[#dcb36c]/80 bg-[#1d1712]/80 px-4 py-3 text-xl font-bold text-[#f4d9aa]">
                자동 돌 가리기에서는 호선만 허용됩니다. 안전한 대국 배치를 위해 접바둑과 정선은 선택할 수 없습니다.
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {HANDICAP_TYPES.map(type => {
                const isLocked = drawMethod === '랜덤' && type !== '호선';
                return (
                  <button key={type} onClick={() => !isLocked && setHandicapType(type)} disabled={isLocked} className={`py-4 border-2 rounded-2xl font-black text-2xl transition-all ${handicapType === type ? 'bg-white text-stone-900 border-white scale-105 shadow-xl' : 'bg-[#120f0d] text-stone-400 border-stone-700'} ${isLocked ? 'opacity-35 cursor-not-allowed' : ''}`}>
                    {type}
                  </button>
                );
              })}
            </div>
            {handicapType === '접바둑' && (
              <div className="bg-[#120f0d] p-6 rounded-3xl border-2 border-stone-800 mb-6 flex flex-col gap-5">
                <div className="flex justify-between items-center px-2">
                  <span className="text-xl font-black text-stone-300">깔아둘 돌</span>
                  <div className="flex items-center gap-3 bg-stone-900 rounded-full p-1.5 border border-stone-700">
                    <button onClick={() => setHandicapStones(p => p > 2 ? p - 1 : p === 2 ? 0 : 0)} className="w-12 h-12 bg-stone-800 rounded-full text-2xl font-black hover:bg-stone-700 transition-colors">-</button>
                    <span className="text-2xl font-black w-16 text-center text-[#dcb36c]">{handicapStones}점</span>
                    <button onClick={() => setHandicapStones(p => p === 0 ? 2 : p < 9 ? p + 1 : 9)} className="w-12 h-12 bg-stone-800 rounded-full text-2xl font-black hover:bg-stone-700 transition-colors">+</button>
                  </div>
                </div>
                <div className="flex justify-between items-center px-2">
                  <span className="text-xl font-black text-stone-300">{handicapStones === 0 ? '역덤' : '덤'}</span>
                  <div className="flex items-center gap-3 bg-stone-900 rounded-full p-1.5 border border-stone-700">
                    <button onClick={() => setKomi(p => p > 0.5 ? p - 1 : 0.5)} className="w-12 h-12 bg-stone-800 rounded-full text-2xl font-black hover:bg-stone-700 transition-colors">-</button>
                    <span className="text-2xl font-black w-24 text-center text-[#dcb36c]">{komi}집</span>
                    <button onClick={() => setKomi(p => p < 99.5 ? p + 1 : 99.5)} className="w-12 h-12 bg-stone-800 rounded-full text-2xl font-black hover:bg-stone-700 transition-colors">+</button>
                  </div>
                </div>
                {handicapStones === 0 && komi < 15 && (
                  <p className="text-red-400 font-bold text-xl bg-red-950/40 py-2.5 rounded-xl border border-red-500/50">⚠️ 0점 접바둑은 최소 15.5집 이상의 역덤이 필요합니다.</p>
                )}
              </div>
            )}
            <button onClick={submitMatch} disabled={!isHandicapValid || isProcessing} className="w-full py-5 bg-green-700 hover:bg-green-600 disabled:bg-stone-800 text-white text-2xl font-black rounded-2xl disabled:text-stone-600 transition-all shadow-xl">
              {isProcessing ? '처리중' : '✅ 대국 시작하기'}
            </button>
            <button onClick={() => setMatchStep(3)} className="mt-4 text-stone-400 hover:text-white font-bold text-xl">⬅ 이전 단계</button>
          </div>
        )}
      </div>
    </div>
  );
}
