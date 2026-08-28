export const toInteger = (value: unknown, fallback = 0): number => {
  const parsedValue = Number.parseInt(String(value), 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};
