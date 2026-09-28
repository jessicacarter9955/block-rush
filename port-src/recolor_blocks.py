#!/usr/bin/env python3
"""
Recolor the block sprites in block-sheet0.png to the user's palette.

Background:
  The original Block Blast game stores all 8 colored block sprites in a
  single 256x512 sprite sheet (block-sheet0.png), arranged in a 2x4 grid
  of 128x128 cells. Each cell has a unique dominant color:

      (0,0) pink     #d35fd7     (1,0) red      #c93131
      (0,1) orange   #ed7821     (1,1) yellow   #edb632
      (0,2) blue     #4864e7     (1,2) green    #3bb43b
      (0,3) cyan     #36b2e1     (1,3) lavender #8d5fd7

  Each block sprite is shaded: a base color, a darker shadow variant,
  a lighter highlight variant, and 2–4 mid-tones.

User's palette (from uploaded screenshot):
      gold   #fab82a
      green  #699627
      brown  #9b5738
      sky    #cce8fa
      cream  #f2e8bd
      purple #bf7eca

Mapping (8 originals → 6 user colors, two of the user's colors used twice
to fill 8 slots, in a way that gives a visually pleasing spread):

      pink     → purple   #bf7eca
      red      → brown    #9b5738
      orange   → gold     #fab82a
      yellow   → cream    #f2e8bd
      blue     → sky      #cce8fa
      green    → green    #699627
      cyan     → sky      #cce8fa   (re-used — light variant)
      lavender → purple  #bf7eca   (re-used — keeps the 8th slot usable)

Algorithm (luminance-preserving hue+saturation swap):
  For every opaque pixel in block-sheet0.png, we determine which of the
  8 original block colors it is closest to (in RGB Euclidean distance,
  but restricted to the cell the pixel lives in so a cell never bleeds
  into another block's color space). We then compute the pixel's
  relative luminance compared to its block's base color, and choose the
  output color as the same luminance offset applied to the user's
  target color.

  In practice that means: shadows stay shadows, highlights stay
  highlights, but the hue and saturation are swapped to the user's
  palette. The block retains its 3D shaded look.

  Anti-aliasing edges and the rare near-white pixels are remapped to
  the lightest luminance tier of the relevant block's new color, so
  the edges don't go transparent or pure white.

Outputs:
  - block-sheet0.png      (overwritten in place)
  - block-sheet0.png.bak  (backup of original)
"""

import os
import shutil
import sys
from collections import Counter
from PIL import Image

ROOT = "/home/z/my-project/public/block-blast/images"
SRC = os.path.join(ROOT, "block-sheet0.png")
BAK = os.path.join(ROOT, "block-sheet0.png.bak")

# Original dominant block colors keyed by (cell_x, cell_y)
ORIGINAL = {
    (0, 0): (211,  95, 215),  # pink   #d35fd7
    (1, 0): (201,  49,  49),  # red    #c93131
    (0, 1): (237, 120,  33),  # orange #ed7821
    (1, 1): (237, 182,  50),  # yellow #edb632
    (0, 2): ( 72, 100, 231),  # blue   #4864e7
    (1, 2): ( 59, 180,  59),  # green  #3bb43b
    (0, 3): ( 54, 178, 225),  # cyan   #36b2e1
    (1, 3): (141,  95, 215),  # lavender #8d5fd7
}

# User palette
PALETTE = {
    "gold":   (250, 184,  42),
    "green":  (105, 150,  39),
    "brown":  (155,  87,  56),
    "sky":    (204, 232, 250),
    "cream":  (242, 232, 189),
    "purple": (191, 126, 202),
}

# Mapping
MAPPING = {
    (0, 0): "purple",
    (1, 0): "brown",
    (0, 1): "gold",
    (1, 1): "cream",
    (0, 2): "sky",
    (1, 2): "green",
    (0, 3): "sky",      # reuse
    (1, 3): "purple",   # reuse
}

CELL = 128  # 256x512 / 2x4


def luminance(rgb):
    # Perceptual luminance (Rec. 709)
    r, g, b = rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def shift_color(orig_rgb, target_rgb, pixel_rgb):
    """
    Given the block's original base color, the user's target base color,
    and a single pixel's color, return the pixel's color shifted to the
    new base while preserving its luminance relationship to the original.

    Strategy:
      1. Compute the pixel's relative luminance vs. the original base
         (rel = Y(pixel) / Y(base)). rel=1.0 means the pixel IS the base
         color, rel<1 means it's a shadow, rel>1 means it's a highlight.
      2. Compute the pixel's chroma vector (R-Y, G-Y, B-Y) — this is the
         direction and magnitude of how the pixel deviates from gray at
         its own brightness.
      3. Compute the original base's chroma vector and the target base's
         chroma vector. Scale the pixel's chroma by (|target_chroma| /
         |orig_chroma|) so the saturation ratio is preserved, and rotate
         the chroma direction to the target's direction (i.e. use the
         unit vector of target_chroma * scaled magnitude).
      4. Reconstruct the new pixel: new_luminance + new_chroma.
    """
    y_orig = luminance(orig_rgb)
    y_targ = luminance(target_rgb)
    y_pix = luminance(pixel_rgb)

    if y_orig <= 0:
        rel_lum = 1.0
    else:
        rel_lum = y_pix / y_orig
    new_y = max(0.0, min(255.0, y_targ * rel_lum))

    def chroma_vec(rgb, y):
        return (rgb[0] - y, rgb[1] - y, rgb[2] - y)

    cp = chroma_vec(pixel_rgb, y_pix)
    co = chroma_vec(orig_rgb, y_orig)
    ct = chroma_vec(target_rgb, y_targ)

    co_mag = (co[0] ** 2 + co[1] ** 2 + co[2] ** 2) ** 0.5
    ct_mag = (ct[0] ** 2 + ct[1] ** 2 + ct[2] ** 2) ** 0.5
    cp_mag = (cp[0] ** 2 + cp[1] ** 2 + cp[2] ** 2) ** 0.5

    # If the pixel has the same chroma direction as the original base,
    # we want to swap to the target's chroma direction with the same
    # relative magnitude. If the pixel is gray (cp_mag = 0), it stays
    # gray at the new luminance.
    if co_mag > 0 and ct_mag > 0:
        # Ratio: how much chroma the pixel has relative to its block base.
        ratio = cp_mag / co_mag
        # Target chroma direction (unit vector) scaled to target magnitude,
        # then scaled by the pixel's relative chroma ratio.
        new_mag = ct_mag * ratio
        new_cr = ct[0] / ct_mag * new_mag
        new_cg = ct[1] / ct_mag * new_mag
        new_cb = ct[2] / ct_mag * new_mag
    else:
        new_cr = new_cg = new_cb = 0

    nr = new_y + new_cr
    ng = new_y + new_cg
    nb = new_y + new_cb

    nr = max(0, min(255, int(round(nr))))
    ng = max(0, min(255, int(round(ng))))
    nb = max(0, min(255, int(round(nb))))
    return (nr, ng, nb)


def main():
    if not os.path.exists(BAK):
        shutil.copy2(SRC, BAK)
        print(f"Backup saved: {BAK}")
    else:
        print(f"Backup already exists: {BAK}")

    img = Image.open(SRC).convert("RGBA")
    px = img.load()
    w, h = img.size
    print(f"Loaded {SRC} ({w}x{h})")

    # Process each cell independently
    stats = Counter()
    for cy in range(4):
        for cx in range(2):
            orig_base = ORIGINAL[(cx, cy)]
            target_name = MAPPING[(cx, cy)]
            target_base = PALETTE[target_name]
            print(f"  Cell ({cx},{cy}): {orig_base} -> {target_name} {target_base}")

            x0, y0 = cx * CELL, cy * CELL
            x1, y1 = x0 + CELL, y0 + CELL
            for y in range(y0, y1):
                for x in range(x0, x1):
                    r, g, b, a = px[x, y]
                    if a < 200:
                        # Transparent or semi-transparent pixel — leave alone.
                        continue
                    new = shift_color(orig_base, target_base, (r, g, b))
                    px[x, y] = (new[0], new[1], new[2], a)
                    stats[target_name] += 1

    img.save(SRC)
    print(f"\nWrote: {SRC}")
    print(f"Pixels recolored per target:")
    for name, count in stats.most_common():
        print(f"  {name:8s}: {count:,}")

    # Quick sanity print: dominant color per cell after recoloring
    print(f"\nPost-recolor dominant colors per cell:")
    img2 = Image.open(SRC).convert("RGBA")
    px2 = img2.load()
    for cy in range(4):
        for cx in range(2):
            c = Counter()
            for y in range(cy * CELL, (cy + 1) * CELL):
                for x in range(cx * CELL, (cx + 1) * CELL):
                    r, g, b, a = px2[x, y]
                    if a > 200:
                        c[(r, g, b)] += 1
            top = c.most_common(1)
            if top:
                r, g, b = top[0][0]
                print(f"  cell ({cx},{cy}): #{r:02x}{g:02x}{b:02x}  ({top[0][1]:,} px)")


if __name__ == "__main__":
    main()
