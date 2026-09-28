#!/usr/bin/env python3
"""Block Rush 1:1 reskin for the Flutter port (best-block-blast).

Replaces the sprites IN PLACE (same filenames + sizes, so the rendering
stays pixel-perfect 1:1 — only the art changes):

  synthetic : Bg, Spot, Board, PlaceHolder, Block x8, BlockBelow x8,
              Sprite2 (BLOCK RUSH logo), BtnPlay, BtnPause, BtnClose
  hue-recolor: green wide buttons -> lavender · navy popups -> dark purple ·
               teal round toggles -> lavender · cyan GameOver -> lavender

Block geometry measured from the real Block Rush screenshot:
  block = 92% of cell (gap 8%), corner radius ~9%, 3 vertical bands
  (light 33% = +22% white · base 45% · dark 17% = -23%), no outline.
"""
import os
import colorsys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SPR = '/home/z/my-project/best-block-blast/assets/sprites-named'
FONT_LUCKIEST = '/tmp/fonts/LuckiestGuy.ttf'

BG_PURPLE = (0x4E, 0x07, 0x6D)
CELL = (0x2A, 0x01, 0x39)
PANEL = (0x23, 0x01, 0x31)
LAV1 = (0x9C, 0x6B, 0xE0)
LAV2 = (0x7B, 0x4F, 0xBF)
LAV_FACE = (0x93, 0x70, 0xDB)

# palette.dart frame order: 0 lavender, 1 cyan, 2 green, 3 blue,
#                           4 yellow, 5 orange, 6 red, 7 pink
RUSH_BY_FRAME = [
    ('viola',   (0x88, 0x48, 0xE0)),  # f00
    ('ciano',   (0x00, 0xC0, 0xC0)),  # f01
    ('verde',   (0x01, 0xC5, 0x01)),  # f02
    ('blu',     (0x00, 0x90, 0xF8)),  # f03
    ('giallo',  (0xF8, 0xD0, 0x00)),  # f04
    ('arancio', (0xC8, 0x7D, 0x00)),  # f05
    ('rosso',   (0xC4, 0x0A, 0x0A)),  # f06
    ('magenta', (0xC4, 0x0A, 0xC4)),  # f07
]


def mix(c, w, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c, w))


def darken(c, t):
    return tuple(int(round(a * (1 - t))) for a in c)


def save(im, name):
    im.save(f'{SPR}/{name}')
    print(f'{name:28} {im.size}')


# ----------------------------------------------------------------- flats ---

def make_bg():
    im = Image.new('RGBA', (27, 1920), BG_PURPLE + (255,))
    save(im, 'Bg-f00.png')


def make_spot():
    S = 120
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=10, fill=CELL + (255,))
    save(im, 'Spot-f00.png')


def make_board():
    S = 994
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=44, fill=CELL + (255,))
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=44, outline=PANEL + (255,), width=6)
    save(im, 'Board-f00.png')


def make_placeholder():
    S = 250
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([6, 6, S - 7, S - 7], radius=46, fill=(0x2E, 0x02, 0x44, 150))
    save(im, 'PlaceHolder-f00.png')


# ---------------------------------------------------------------- blocks ---

def block_tile(size, base, inset_frac=0.039, radius_frac=0.085, flat=False):
    """Glossy 3-band Block Rush block on a transparent tile."""
    inset = max(1, int(size * inset_frac))
    B = size - 2 * inset
    R = max(4, int(B * radius_frac))
    light = mix(base, (255, 255, 255), 0.22)
    dark = darken(base, 0.23)
    body = Image.new('RGBA', (B, B), (0, 0, 0, 0))
    px = body.load()
    for y in range(B):
        t = y / (B - 1)
        if flat:
            c = base
        elif t < 0.33:
            c = light
        elif t < 0.39:
            c = mix(light, base, (t - 0.33) / 0.06)
        elif t < 0.82:
            c = base
        elif t < 0.87:
            c = mix(base, dark, (t - 0.82) / 0.05)
        else:
            c = dark
        for x in range(B):
            px[x, y] = c + (255,)
    mask = Image.new('L', (B, B), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, B - 1, B - 1], radius=R, fill=255)
    tile = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    tile.paste(body, (inset, inset), mask)
    return tile


def make_blocks():
    for i, (name, base) in enumerate(RUSH_BY_FRAME):
        save(block_tile(129, base), f'Block-f0{i}.png')
        save(block_tile(129, darken(base, 0.30), flat=True), f'BlockBelow-f0{i}.png')


# ------------------------------------------------------------------ logo ---

def make_logo():
    W, H = 841, 892
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    stroke = (0x1F, 0x01, 0x30)

    def fit_font(text, target_w, start):
        size = start
        while size > 20:
            f = ImageFont.truetype(FONT_LUCKIEST, size)
            bb = d.textbbox((0, 0), text, font=f, stroke_width=int(size * 0.09))
            if bb[2] - bb[0] <= target_w:
                return f
            size -= 4
        return ImageFont.truetype(FONT_LUCKIEST, 20)

    # drop shadow layer
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)

    # ---- BLOCK (colorful letters)
    block_colors = [
        (0xF8, 0xD0, 0x00), (0x01, 0xC5, 0x01), (0x00, 0xC0, 0xC0),
        (0xC4, 0x0A, 0xC4), (0xC8, 0x7D, 0x00),
    ]
    f1 = fit_font('BLOCK', W - 120, 210)
    sw1 = int(f1.size * 0.10)
    bb = d.textbbox((0, 0), 'BLOCK', font=f1, stroke_width=sw1)
    w1, h1 = bb[2] - bb[0], bb[3] - bb[1]
    x1, y1 = (W - w1) // 2 - bb[0], 60 - bb[1]
    # letter-by-letter with per-letter color, white stroke + dark outer stroke
    cx = x1
    for ch, col in zip('BLOCK', block_colors):
        sd.text((cx + 10, y1 + 12), ch, font=f1, fill=(0x12, 0x00, 0x1E, 200), stroke_width=sw1, stroke_fill=(0x12, 0x00, 0x1E, 200))
        cx += d.textbbox((0, 0), ch, font=f1, stroke_width=sw1)[2] - d.textbbox((0, 0), ch, font=f1, stroke_width=sw1)[0] + int(f1.size * 0.02)
    cx = x1
    for ch, col in zip('BLOCK', block_colors):
        d.text((cx, y1), ch, font=f1, fill=col + (255,), stroke_width=sw1, stroke_fill=stroke + (255,))
        # glossy top: lighter overlay on the top half of the glyph
        cx += d.textbbox((0, 0), ch, font=f1, stroke_width=sw1)[2] - d.textbbox((0, 0), ch, font=f1, stroke_width=sw1)[0] + int(f1.size * 0.02)

    # ---- RUSH (white → gold gradient, bigger)
    f2 = fit_font('RUSH', W - 90, 300)
    sw2 = int(f2.size * 0.09)
    bb2 = d.textbbox((0, 0), 'RUSH', font=f2, stroke_width=sw2)
    w2, h2 = bb2[2] - bb2[0], bb2[3] - bb2[1]
    x2, y2 = (W - w2) // 2 - bb2[0], 60 + h1 + 78 - bb2[1]

    sd.text((x2 + 12, y2 + 14), 'RUSH', font=f2, fill=(0x12, 0x00, 0x1E, 200), stroke_width=sw2, stroke_fill=(0x12, 0x00, 0x1E, 200))

    # gradient fill via mask
    grad = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for yy in range(H):
        t = min(1, max(0, (yy - y2) / max(1, h2)))
        c = mix((0xFF, 0xFF, 0xFF), (0xFF, 0xD7, 0x00), t)
        gd.line([(0, yy), (W, yy)], fill=c + (255,))
    mask = Image.new('L', (W, H), 0)
    md = ImageDraw.Draw(mask)
    md.text((x2, y2), 'RUSH', font=f2, fill=255, stroke_width=sw2, stroke_fill=255)
    # dark stroke first, then gradient fill clipped
    d.text((x2, y2), 'RUSH', font=f2, fill=stroke + (255,), stroke_width=sw2, stroke_fill=stroke + (255,))
    im.paste(grad, (0, 0), mask)

    out = Image.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)), im)
    save(out, 'Sprite2-f00.png')


# --------------------------------------------------------------- buttons ---

def lav_button(size, radius=None):
    R = radius if radius is not None else int(size * 0.30)
    S = size
    btn = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(btn)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=R, fill=LAV1 + (255,))
    # vertical gloss: lighter top
    for yy in range(int(S * 0.35)):
        t = 1 - yy / (S * 0.35)
        c = mix(LAV1, (255, 255, 255), 0.22 * t)
        d.line([(4, yy), (S - 5, yy)], fill=c + (255,))
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=R, outline=darken(LAV2, 0.25) + (255,), width=max(3, S // 26))
    # soft shadow under
    sh = Image.new('RGBA', (S, S + 8), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle([1, 4, S - 2, S + 3], radius=R, fill=(0x1A, 0x01, 0x2B, 160))
    sh = sh.filter(ImageFilter.GaussianBlur(3))
    base = Image.new('RGBA', (S, S + 8), (0, 0, 0, 0))
    base.alpha_composite(sh)
    base.alpha_composite(btn, (0, 0))
    return base


def make_pause():
    S = 104
    btn = lav_button(S)
    d = ImageDraw.Draw(btn)
    bw, bh, gap = 16, 44, 14
    x0 = (S - (bw * 2 + gap)) // 2
    y0 = (S - bh) // 2
    d.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], radius=7, fill=(255, 255, 255, 255))
    d.rounded_rectangle([x0 + bw + gap, y0, x0 + bw * 2 + gap, y0 + bh], radius=7, fill=(255, 255, 255, 255))
    save(btn.crop((0, 0, S, S)), 'BtnPause-f00.png')


def make_close():
    S = 84
    btn = lav_button(S)
    d = ImageDraw.Draw(btn)
    cx, cy, L, w = S // 2, S // 2, 22, 13
    for sgn in (1, -1):
        d.line([(cx - sgn * L, cy - L), (cx + sgn * L, cy + L)], fill=(255, 255, 255, 255), width=w)
    save(btn.crop((0, 0, S, S)), 'BtnClose-f00.png')


def make_play():
    W, H = 336, 119
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # pill
    d.rounded_rectangle([2, 2, W - 3, H - 1], radius=H // 2, fill=LAV1 + (255,))
    for yy in range(int(H * 0.38)):
        t = 1 - yy / (H * 0.38)
        c = mix(LAV1, (255, 255, 255), 0.25 * t)
        d.line([(10, 2 + yy), (W - 11, 2 + yy)], fill=c + (255,))
    d.rounded_rectangle([2, 2, W - 3, H - 1], radius=H // 2, outline=darken(LAV2, 0.28) + (255,), width=5)
    # play triangle + PLAY text
    f = ImageFont.truetype(FONT_LUCKIEST, 62)
    txt = 'PLAY'
    bb = d.textbbox((0, 0), txt, font=f)
    tw = bb[2] - bb[0]
    tx = (W - tw) // 2 + 26
    ty = (H - (bb[3] - bb[1])) // 2 - bb[1] + 4
    # triangle
    ax = tx - 52
    d.polygon([(ax, 36), (ax, H - 37), (ax + 44, H // 2 + 1)], fill=(255, 255, 255, 255))
    d.text((tx, ty), txt, font=f, fill=(255, 255, 255, 255), stroke_width=6, stroke_fill=(0x2A, 0x01, 0x4A, 255))
    save(im, 'BtnPlay-f00.png')


# ----------------------------------------------------------- hue recolor ---

def shift_hue(src_name, dst_name, mapping, brighten=0.0, keep_alpha=True):
    """mapping: list of (h_lo, h_hi, target_hue_deg, sat_boost) applied when
    the pixel hue falls inside the range and it is reasonably saturated."""
    im = Image.open(f'{SPR}/{src_name}').convert('RGBA')
    W, H = im.size
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sp, op = im.load(), out.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = sp[x, y]
            if a == 0:
                continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if s > 0.14 and 0.06 < l < 0.96:
                hd = h * 360
                for lo, hi, tgt, sb in mapping:
                    if lo <= hd < hi:
                        ns = min(1.0, s * sb)
                        nl = min(0.95, l * (1 - brighten) + brighten * 0.63) if brighten else l
                        nr, ng, nb = colorsys.hls_to_rgb(tgt / 360, nl, ns)
                        r, g, b = int(nr * 255), int(ng * 255), int(nb * 255)
                        break
            op[x, y] = (r, g, b, a if keep_alpha else 255)
    save(out, dst_name)


GREENS = [(55, 155, 262, 1.05)]            # green buttons -> lavender
TEALS = [(150, 205, 262, 1.0)]             # teal round toggles -> lavender
NAVY = [(195, 265, 279, 1.0)]              # navy panels -> dark purple
CYAN = [(165, 210, 265, 0.85)]             # cyan GameOver -> soft lavender


def main():
    make_bg()
    make_spot()
    make_board()
    make_placeholder()
    make_blocks()
    make_logo()
    make_play()
    make_pause()
    make_close()

    # green wide buttons -> lavender (text stays white)
    for n in ['BtnHome-f00', 'BtnReset-f00', 'BtnRevive-f00', 'BtnGOReset-f00', 'BtnShowRanking-f00']:
        shift_hue(f'{n}.png', f'{n}.png', GREENS, brighten=0.5)
    # wide toggles: ON (green) -> lavender bright
    for n in ['BtnMusic-f00', 'BtnSFX-f00']:
        shift_hue(f'{n}.png', f'{n}.png', GREENS, brighten=0.5)
    # wide toggles: OFF (blue) -> muted purple
    for n in ['BtnMusic-f01', 'BtnSFX-f01']:
        shift_hue(f'{n}.png', f'{n}.png', [(195, 265, 275, 0.55)])
    # round home toggles (teal) -> lavender, both frames
    for n in ['BtnMusic2-f00', 'BtnMusic2-f01', 'BtnSFX2-f00', 'BtnSFX2-f01', 'BtnRanking-f00']:
        shift_hue(f'{n}.png', f'{n}.png', TEALS + NAVY)
    # navy popups -> dark purple
    for n in ['PausePopup-f00', 'LeaderboardPopup2-f00']:
        shift_hue(f'{n}.png', f'{n}.png', NAVY)
    # cyan GameOver banner -> soft lavender
    shift_hue('GameOver-f00.png', 'GameOver-f00.png', CYAN)
    print('DONE')


if __name__ == '__main__':
    main()
