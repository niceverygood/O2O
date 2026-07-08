export function formatWon(value) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function discountedPrice(originalPrice, discountRate) {
  const base = Number(originalPrice || 0);
  const rate = Number(discountRate || 0);
  return Math.max(0, Math.round(base * (1 - rate / 100)));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
