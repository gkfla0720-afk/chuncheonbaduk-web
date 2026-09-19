// 전화번호 입력값에서 숫자만 추출한다 (하이픈/공백 등 입력 편의 문자는 저장 전에 제거).
export function normalizePhoneDigits(input: string): string {
  return input.replace(/\D/g, '');
}

// 관리자가 이벤트/대회 연락 등에 사용할 수 있는 유효한 전체 전화번호인지 검사한다.
// (지역번호 포함 유선전화까지 아우르도록 9~11자리를 허용한다.)
export function isValidPhoneNumber(digits: string): boolean {
  return /^[0-9]{9,11}$/.test(digits);
}

// 입장/귀가 조회에 사용하는 뒷자리 4자리를 추출한다.
export function toPhoneLast4(digits: string): string {
  return digits.slice(-4);
}
