const ORN_CODE_PATTERN = /^ORN(\d+)$/i;

export function suggestNextOrnCode(codes = []) {
  let max = 0;
  for (const raw of codes) {
    const match = ORN_CODE_PATTERN.exec(String(raw ?? '').trim());
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `ORN${String(max + 1).padStart(4, '0')}`;
}
