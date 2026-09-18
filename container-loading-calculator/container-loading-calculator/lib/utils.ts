export function cbmFromMm(lengthMm: number, widthMm: number, heightMm: number): number {
  if (!lengthMm || !widthMm || !heightMm) return 0;
  return (lengthMm * widthMm * heightMm) / 1_000_000_000;
}

export function formatNumber(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
