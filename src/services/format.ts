/** Shows ISO timestamps as relative Vietnamese time; passes legacy free-text values through unchanged. */
export const formatTime = (value?: string): string => {
  if (!value) return '';
  const t = Date.parse(value);
  if (Number.isNaN(t) || !/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'Vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} ngày trước`;
  return new Date(t).toLocaleDateString('vi-VN');
};
