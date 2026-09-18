// 서버(Node)와 클라이언트(브라우저)의 ICU(국제화) 데이터가 다를 경우
// `toLocaleTimeString('ko-KR', ...)`가 서버에서는 "PM 04:09", 브라우저에서는
// "오후 04:09"처럼 다르게 렌더링되어 하이드레이션 불일치 경고가 발생한다.
// 이를 피하기 위해 로케일에 의존하지 않고 직접 오전/오후 문자열을 만들고,
// 시간대도 'Asia/Seoul'로 고정해 서버와 클라이언트가 항상 동일한 결과를 내도록 한다.
export function formatKoreanTime(date: Date, options: { showSeconds?: boolean } = {}): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour24 = parseInt(get('hour'), 10);
  const minute = get('minute');
  const second = get('second');

  const period = hour24 < 12 ? '오전' : '오후';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return options.showSeconds
    ? `${period} ${hour12}:${minute}:${second}`
    : `${period} ${hour12}:${minute}`;
}
