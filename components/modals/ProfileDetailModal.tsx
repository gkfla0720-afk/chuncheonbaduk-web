import { useState } from 'react';
import { Profile } from '../../types';
import { ProfileStats } from '../../lib/profileStats';
import { MatchHistoryEntry } from '../../lib/matchHistory';
import { formatKoreanTime } from '../../lib/formatTime';
import KifuViewerModal from './KifuViewerModal';

interface ProfileDetailModalProps {
  profile: Profile;
  stats: ProfileStats;
  isLoadingStats: boolean;
  matchHistory: MatchHistoryEntry[];
  isLoadingHistory: boolean;
  onClose: () => void;
}

const RESULT_STYLE: Record<MatchHistoryEntry['result'], string> = {
  승: 'bg-blue-600 text-white',
  패: 'bg-red-600 text-white',
  무효: 'bg-stone-600 text-stone-200',
};

export default function ProfileDetailModal({ profile, stats, isLoadingStats, matchHistory, isLoadingHistory, onClose }: ProfileDetailModalProps) {
  const [viewingKifu, setViewingKifu] = useState<MatchHistoryEntry | null>(null);

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]">
      <div className="modal-card w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#1f1a16] text-white p-10 rounded-[30px] shadow-[0_18px_45px_rgba(34,27,20,0.28)] border-4 border-[#b88c42] text-center">
        <h2 className="text-3xl font-black text-[#e8d5b5] mb-1">회원 기력 및 프로필</h2>
        <p className="text-stone-400 font-semibold mb-6">가입일: {stats.joinedAt}</p>
        <div className="bg-[#120f0d] p-8 rounded-3xl mb-6 border border-stone-800 shadow-inner">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h3 className="text-5xl font-black text-white">{profile.name}</h3>
            {profile.current_status === '대국중' && (
              <span className="px-3 py-1 bg-amber-500 text-stone-900 text-xl font-black rounded-lg shadow-md animate-pulse border border-amber-300">
                대국중
              </span>
            )}
          </div>
          <p className="text-2xl font-extrabold text-[#dcb36c] mb-8">{profile.rank} / {profile.tier}</p>
          {isLoadingStats ? (
            <p className="text-stone-400 font-bold py-8 animate-pulse text-xl">전적 데이터를 집계하는 중...</p>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-[#241f1b] p-5 rounded-2xl border border-stone-700">
                <p className="text-stone-400 text-xl font-bold mb-2">대국 통산 전적</p>
                <p className="text-3xl font-black"><span className="text-blue-400">{stats.wins}승</span> <span className="text-red-400">{stats.losses}패</span></p>
                <p className="text-stone-400 text-xl font-bold mt-2">승률 {stats.wins + stats.losses > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%</p>
              </div>
              <div className="bg-[#241f1b] p-5 rounded-2xl border border-stone-700 flex flex-col justify-center items-center">
                <p className="text-stone-400 text-xl font-bold mb-2">최근 30일 출석률</p>
                <p className="text-4xl font-black text-[#dcb36c]">{stats.attendanceRate}%</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#120f0d] p-6 rounded-3xl mb-8 border border-stone-800 shadow-inner text-left">
          <h4 className="text-2xl font-black text-[#e8d5b5] mb-4 text-center">최근 대국 기록</h4>
          {isLoadingHistory ? (
            <p className="text-stone-400 font-bold py-6 animate-pulse text-xl text-center">대국 기록을 불러오는 중...</p>
          ) : matchHistory.length === 0 ? (
            <p className="text-stone-500 font-bold py-6 text-xl text-center">아직 종료된 대국 기록이 없습니다.</p>
          ) : (
            <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {matchHistory.map((h) => (
                <li key={h.id} className="rounded-2xl border border-stone-700 bg-[#241f1b] p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-stone-400">{formatKoreanTime(new Date(h.startedAt))} · {h.matchType} · {h.handicap}</p>
                    <p className="text-xl font-black text-white whitespace-nowrap overflow-hidden text-ellipsis">
                      vs {h.opponentNames.join(', ') || '상대 없음'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-3 py-1 rounded-lg text-lg font-black ${RESULT_STYLE[h.result]}`}>{h.result}</span>
                    {h.kifu.length > 0 && (
                      <button onClick={() => setViewingKifu(h)} className="px-3 py-1.5 rounded-lg text-lg font-bold bg-[#b88c42] text-stone-950 hover:bg-[#a37934] transition-all">기보 보기</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button onClick={onClose} className="w-full py-5 bg-[#b88c42] hover:bg-[#a37934] text-stone-950 text-2xl font-black rounded-2xl shadow-xl transition-all">확인 (닫기)</button>
      </div>

      {viewingKifu && (
        <KifuViewerModal
          title={`vs ${viewingKifu.opponentNames.join(', ') || '상대 없음'} (${viewingKifu.result})`}
          boardSize={viewingKifu.boardSize}
          kifu={viewingKifu.kifu}
          onClose={() => setViewingKifu(null)}
        />
      )}
    </div>
  );
}
