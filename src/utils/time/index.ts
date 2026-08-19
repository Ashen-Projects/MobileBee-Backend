export const nowTimestamp = (): number => Date.now();

export const toIsoDate = (value: Date | number | string): string =>
  new Date(value).toISOString();
