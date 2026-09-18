import { KifuMove } from '../../types';
import GoBoard from '../GoBoard';

interface KifuViewerModalProps {
  title: string;
  boardSize: number;
  kifu: KifuMove[];
  onClose: () => void;
}

// 과거에 종료된 대국의 저장된 기보를 다시 볼 때 쓰는 가벼운 뷰어 팝업.
export default function KifuViewerModal({ title, boardSize, kifu, onClose }: KifuViewerModalProps) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-[rgba(22,16,12,0.65)] p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="w-full max-w-[520px] bg-[#1f1a16] text-white p-6 rounded-[28px] shadow-2xl border-4 border-[#b88c42] text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-black text-[#e8d5b5] mb-1">{title}</h2>
        <p className="text-xl font-bold text-stone-400 mb-4">{kifu.length}수 종료 시점 기보</p>
        <div className="w-full aspect-square rounded-2xl overflow-hidden border-2 border-[#b88c42] shadow-lg mx-auto">
          <GoBoard size={boardSize} moves={kifu} />
        </div>
        <button onClick={onClose} className="w-full mt-5 py-4 bg-stone-800 hover:bg-stone-700 text-white text-xl font-black rounded-2xl transition-all">닫기</button>
      </div>
    </div>
  );
}
