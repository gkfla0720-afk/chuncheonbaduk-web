interface MembershipGuideModalProps {
  onClose: () => void;
}

export default function MembershipGuideModal({ onClose }: MembershipGuideModalProps) {
  return (
    <div className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(22,16,12,0.56)] p-4 backdrop-blur-[2px]">
      <div className="modal-card w-full max-w-lg rounded-[30px] border border-[#d4c3a2] bg-[#f8f4ee] p-6 shadow-[0_18px_45px_rgba(34,27,20,0.28)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[20px] font-bold tracking-[0.18em] text-[#7e5d3d]">회원 등급</p>
            <h3 className="mt-2 text-4xl font-black text-[#2a241d]">정회원 달성 조건</h3>
          </div>
          <button onClick={onClose} className="rounded-full bg-stone-200 px-4 py-2 text-xl font-bold text-stone-700 transition hover:bg-stone-300">닫기</button>
        </div>

        <div className="mt-5 rounded-[24px] border border-[#d9cab0] bg-[#f3ebdf] p-6">
          <p className="text-xl leading-8 text-stone-700">
            정회원은 <span className="font-black text-[#8a5a2b]">기원 방문 10회 이상</span>과 <span className="font-black text-[#8a5a2b]">대국 10회 이상</span>을 충족한 회원에게 자동으로 승격됩니다.
          </p>
          <ul className="mt-5 space-y-4 text-xl text-stone-700">
            <li className="flex items-start gap-3"><span className="mt-2 inline-block h-2.5 w-2.5 rounded-full bg-[#8a5a2b]" /> 방문 기록과 대국 기록이 누적되면 자동으로 정회원으로 인정됩니다.</li>
            <li className="flex items-start gap-3"><span className="mt-2 inline-block h-2.5 w-2.5 rounded-full bg-[#8a5a2b]" /> 승격 조건을 충족한 회원은 등급이 자연스럽게 정회원으로 바뀝니다.</li>
          </ul>
        </div>

        <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-[#2a241d] py-4 text-xl font-bold text-[#f8f3eb] transition hover:bg-[#1f1b18]">
          확인
        </button>
      </div>
    </div>
  );
}
