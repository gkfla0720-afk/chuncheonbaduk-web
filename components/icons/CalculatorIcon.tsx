// 계산기(전자 계산기) 아이콘. 🖩(U+1F5A9) 이모지는 대부분의 안드로이드/iOS 기기에서
// 컬러 이모지로 지원되지 않아 빈 사각형으로 보이는 경우가 많아, 어떤 기기에서도
// 동일하게 보이도록 인라인 SVG로 직접 그린다.
export default function CalculatorIcon({ className = 'h-[1em] w-[1em] inline-block align-[-0.15em]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2.5" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.6" />
      <rect x="6.5" y="4.5" width="11" height="4" rx="1" fill="currentColor" />
      <circle cx="7.2" cy="12.2" r="1.15" fill="currentColor" />
      <circle cx="12" cy="12.2" r="1.15" fill="currentColor" />
      <circle cx="16.8" cy="12.2" r="1.15" fill="currentColor" />
      <circle cx="7.2" cy="16.2" r="1.15" fill="currentColor" />
      <circle cx="12" cy="16.2" r="1.15" fill="currentColor" />
      <circle cx="16.8" cy="16.2" r="1.15" fill="currentColor" />
      <circle cx="7.2" cy="20.2" r="1.15" fill="currentColor" />
      <circle cx="12" cy="20.2" r="1.15" fill="currentColor" />
      <circle cx="16.8" cy="20.2" r="1.15" fill="currentColor" />
    </svg>
  );
}
