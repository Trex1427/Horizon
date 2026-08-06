export const cx = (...values) => values.filter(Boolean).join(' ');

export const clampPercent = (value, max = 100) => {
  const numericValue = Number(value) || 0;
  const numericMax = Number(max) || 100;
  return Math.min(100, Math.max(0, (numericValue / numericMax) * 100));
};
