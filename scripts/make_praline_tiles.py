#!/usr/bin/env python3
"""Turn raw AI-generated candy images (plain white bg) into clean 256x256
transparent game tiles for the Skin Studio 'Immagine' block style.

Pipeline per tile:
  1. bg-like mask = pixels close to white (R,G,B > BG_MIN)
  2. border-connected flood fill on that mask (keeps enclosed white
     specular highlights inside the candy intact)
  3. alpha = 255 - background; erode (fringe removal) + slight feather
  4. crop to content bbox + margin, pad to square, resample to 256x256

Usage:
  python3 make_praline_tiles.py process  <in.png> <out.png> [--size 256] [--bgmin 190] [--erode 5]
  python3 make_praline_tiles.py preview  <tile.png> <out.png>   # composite over dark navy
  python3 make_praline_tiles.py plain    <in.png> <out.png>     # full-bleed resize only
"""

import sys
from PIL import Image, ImageDraw, ImageFilter

BG_MIN = 190          # R,G,B all above this => candidate background
MARKER = (255, 0, 255)


def border_connected_bg(im: Image.Image, bg_min: int) -> Image.Image:
    """Binary image: white where pixels are border-connected background.

    Background candidates: near-white pixels OR bright low-saturation pixels
    (soft grey shadows the generator sometimes casts). Saturated candy colors
    are never candidates; enclosed white highlights survive thanks to
    border-connected flood fill.
    """
    w, h = im.size
    rgb = im.convert('RGB')
    mask = Image.new('L', (w, h), 0)
    px = rgb.load()
    mpx = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            mx, mn = max(r, g, b), min(r, g, b)
            near_white = r > bg_min and g > bg_min and b > bg_min
            grey_shadow = mx > 140 and (mx - mn) < 36
            dark_penumbra = 60 < mx < 160 and (mx - mn) < 30
            if near_white or grey_shadow or dark_penumbra:
                mpx[x, y] = 255
    # flood fill from border seeds through the mask (exact match on binary)
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for s in seeds:
        if mpx[s] == 255:
            ImageDraw.floodfill(mask, s, 128, thresh=0)
    # 128 = connected bg; demote remaining 255 (enclosed highlights) to 0
    out = Image.new('L', (w, h), 0)
    opx = out.load()
    for y in range(h):
        for x in range(w):
            if mpx[x, y] == 128:
                opx[x, y] = 255
    return out


def peel_halo(alpha: 'Image.Image', rgb: Image.Image, max_iter: int = 14,
              sat_max: int = 85, bright_min: int = 150) -> 'Image.Image':
    """Iteratively erode low-saturation bright pixels that touch the
    transparent region. This removes the soft colored glow/blends the
    generator paints around the subject, while saturated candy pixels and
    enclosed interior highlights are never touched."""
    import numpy as np
    a = np.array(alpha).copy()
    r = np.asarray(rgb, dtype=np.int16)
    mx = r.max(axis=2)
    mn = r.min(axis=2)
    sat = mx - mn
    halo = (sat < sat_max) & (mx > bright_min)
    for _ in range(max_iter):
        t = a == 0
        nb = t.copy()
        nb[1:, :] |= t[:-1, :]
        nb[:-1, :] |= t[1:, :]
        nb[:, 1:] |= t[:, :-1]
        nb[:, :-1] |= t[:, 1:]
        peel = nb & (a == 255) & halo
        if not peel.any():
            break
        a[peel] = 0
    return Image.fromarray(a)


def process(in_path: str, out_path: str, size: int = 256, bg_min: int = BG_MIN,
            erode: int = 5) -> None:
    im = Image.open(in_path).convert('RGBA')
    w, h = im.size
    bg = border_connected_bg(im, bg_min)

    alpha = Image.new('L', (w, h), 255)
    alpha.paste(0, (0, 0), bg)          # 0 where background
    alpha = peel_halo(alpha, im.convert('RGB'))
    alpha = alpha.filter(ImageFilter.MinFilter(erode))   # strip fringe
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.0))  # soft edge

    im.putalpha(alpha)

    # crop to content + 3% margin, pad to square
    bbox = alpha.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        mx, my = int((x1 - x0) * 0.03), int((y1 - y0) * 0.03)
        im = im.crop((max(0, x0 - mx), max(0, y0 - my),
                      min(w, x1 + mx), min(h, y1 + my)))
    cw, ch = im.size
    side = max(cw, ch)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - cw) // 2, (side - ch) // 2), im)
    canvas = canvas.resize((size, size), Image.LANCZOS)
    canvas.save(out_path)
    covered = sum(1 for p in canvas.getchannel('A').getdata() if p > 16)
    print(f"OK {out_path}  {size}x{size}  opaque={covered * 100 // (size * size)}%")


def preview(tile_path: str, out_path: str, bg=(16, 26, 76)) -> None:
    tile = Image.open(tile_path).convert('RGBA')
    S = 512
    canvas = Image.new('RGB', (S, S), bg)
    t = tile.resize((int(S * 0.9), int(S * 0.9)), Image.LANCZOS)
    canvas.paste(t, ((S - t.width) // 2, (S - t.height) // 2), t)
    canvas.save(out_path)
    print(f"OK {out_path}")


def plain(in_path: str, out_path: str, size: int = 256) -> None:
    """Full-bleed texture: no keying, just square-crop + resize."""
    im = Image.open(in_path).convert('RGB')
    w, h = im.size
    side = min(w, h)
    im = im.crop(((w - side) // 2, (h - side) // 2,
                  (w + side) // 2, (h + side) // 2))
    im = im.resize((size, size), Image.LANCZOS)
    im.save(out_path)
    print(f"OK {out_path}  {size}x{size}")


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'process':
        process(sys.argv[2], sys.argv[3])
    elif cmd == 'preview':
        preview(sys.argv[2], sys.argv[3])
    elif cmd == 'plain':
        plain(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
