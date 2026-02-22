export function iaqCardColors(iaq: number) {
  const hue = 1.2 * iaq; // 0..120
  return {
    bg: `hsl(${hue} 85% 96%)`,
    border: `hsl(${hue} 70% 55%)`,
    accent: `hsl(${hue} 75% 40%)`
  };
}

export function bannerCopy(level: 'SAFE' | 'WARN' | 'DANGER' | '...') {
  if (level === '...')
    return {
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      title: 'Trạng thái: ...',
      desc: 'Loading...'
    };
  if (level === 'SAFE') {
    return {
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      title: 'Trạng thái: Tốt',
      desc: 'Các chỉ số đang trong ngưỡng an toàn.'
    };
  }
  if (level === 'WARN') {
    return {
      cls: 'border-amber-200 bg-amber-50 text-amber-950',
      title: 'CẢNH BÁO',
      desc: 'Chỉ số đang vượt ngưỡng cảnh báo. Nên mở cửa sổ/quạt thông gió hoặc giảm nguồn gây ô nhiễm.'
    };
  }
  return {
    cls: 'border-rose-200 bg-rose-50 text-rose-950 animate-pulse',
    title: 'NGUY HIỂM',
    desc: 'Chất lượng không khí đang rất xấu. Hãy thông gió ngay và tránh ở lâu trong khu vực này.'
  };
}