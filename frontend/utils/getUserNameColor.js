export function getUserNameColor(key) {
  const k = String(key || '');
  let hash = 0;
  for (let i = 0; i < k.length; i++) {
    hash = (hash << 5) - hash + k.charCodeAt(i);
    hash |= 0;
  }
  const palette = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#06B6D4',
  ];
  const idx = Math.abs(hash) % palette.length;
  return palette[idx];
}
