import formats from '../src/lib/social-formats.json' with { type: 'json' };

export { formats };
export function socialFormat(id, framing = 'safe') {
  const format = formats.find(format => format.id === id);
  if (!format) throw new Error('Choose a supported social format');
  if (!['fit', 'safe'].includes(framing)) throw new Error('Choose full frame or protected gameplay');
  return format;
}

export function exportLayout(id, framing = 'safe') {
  const format = socialFormat(id, framing);
  const margins = framing === 'safe' ? format.safe : { top: 0, right: 0, bottom: 0, left: 0 };
  const even = value => Math.floor(value / 2) * 2;
  const x = even(format.width * margins.left / 100), y = even(format.height * margins.top / 100);
  const width = even(format.width * (100 - margins.left - margins.right) / 100);
  const height = even(format.height * (100 - margins.top - margins.bottom) / 100);
  return { ...format, key: `${id}-${framing}`, x, y, contentWidth: width, contentHeight: height,
    filter: `scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,pad=${format.width}:${format.height}:${x}+(${width}-iw)/2:${y}+(${height}-ih)/2:color=0x080d16` };
}
