export const previewColor = (token: string, fallback: string): string => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return value || fallback;
};
