#!/usr/bin/env python3
"""Block Blast ROSSO 1:1 reskin per il port Flutter (best-block-blast).

Sostituisce gli sprite IN PLACE (stessi nomi + dimensioni, quindi il rendering
resta 1:1 — cambia solo l'arte), usando il materiale REALE estratto dallo
screenshot dell'utente:

  - Bg: striscia gradiente ricavata dallo sfondo VERO ripulito (bg-rosso-1-1)
  - Spot: la cella VERA estratta (bevel rosso)
  - Block x8: gli 8 gusti caramella estratti dallo screenshot
  - BlockBelow x8: varianti ghost (stessa arte, scurite)
  - Sprite2: logo "BLOCK BLAST" oro/crema con estrusione (come il riferimento)
  - BtnPlay/BtnPause/BtnClose: pillola rossa lucida + icone con anello oro
  - hue-recolor: bottoni verdi -> rossi · popup navy -> rosso scuro ·
                 toggle teal -> rossi · banner GameOver ciano -> crema/oro
"""
import os
import colorsys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SPR = '/home/z/my-project/best-block-blast/assets/sprites-named'
TEX = '/home/z/my-project/public/textures/candy'
FONT = '/tmp/fonts/LilitaOne.ttf'

# colori tema rosso (campinati dallo screenshot vero)
BG_TOP = (0xB1, 0x15, 0x24)
BG_BOT = (0x7A, 0x0A, 0x12)
CELL = (0x93, 0x0D, 0x17)
PLATE = (0x4A, 0x03, 0x09)
FRAME = (0xC8, 0x12, 0x26)
PLAY1 = (0xE2, 0x31, 0x4E)
PLAY2 = (0xA5, 0x07, 0x1D)
ICON_FACE = (0x8E, 0x0B, 0x16)
GOLD = (0xD4, 0xAF, 0x37)
GOLD_HI = (0xF2, 0xD5, 0xA0)
EXTRUDE = (0x8B, 0x3A, 0x3A)

# mapping frame -> gusto (palette.dart frame order: 0..7)
#   f0 latte, f1 menta, f2 lime, f3 fondente, f4 giallo, f5 arancio, f6 rosso, f7 rosa
FRAME_TO_TILE = [3, 6, 2, 5, 1, 4, 7, 0]  # block-rosso-N: 0 rosa,1 giallo,2 lime,3 latte,4 arancio,5 fondente,6 menta,7 rosso


def mix(c, w, t):
    return tuple(int(round(a + (b - a) * t)) for a, b in zip(c, w))


def darken(c, t):
    return tuple(int(round(a * (1 - t))) for a in c)


def save(im, name):
    im.save(f'{SPR}/{name}')
    print(f'{name:28} {im.size}')


# ------------------------------------------------------------------ flats ---

def make_bg():
    # striscia gradiente dallo sfondo VERO: media per-riga di bg-rosso-1-1.jpg
    bg = Image.open(f'{TEX}/bg-rosso-1-1.jpg').convert('RGB')
    W = 27
    im = Image.new('RGBA', (W, 1920))
    px = im.load()
    for y in range(1920):
        row = bg.crop((0, int(y * bg.height / 1920), bg.width, int(y * bg.height / 1920) + 1))
        vals = row.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
        for x in range(W):
            px[x, y] = vals + (255,)
    save(im, 'Bg-f00.png')


def make_spot():
    # cella VERA (bevel rosso) scalata a 120
    cell = Image.open(f'{TEX}/cell-rosso-1-1.png').convert('RGBA').resize((120, 120), Image.LANCZOS)
    save(cell, 'Spot-f00.png')


def make_board():
    # plate rossa scura con cornice lucida + specular top (come il riferimento)
    S = 994
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=44, fill=PLATE + (255,))
    # cornice glossy
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=44, outline=FRAME + (255,), width=14)
    d.rounded_rectangle([14, 14, S - 15, S - 15], radius=34, outline=darken(PLATE, 0.4) + (255,), width=6)
    # specular highlight lungo il bordo alto (fonte di luce dall'alto, come il ref)
    hl = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    hd.rounded_rectangle([10, 6, S - 11, 26], radius=12, fill=(255, 255, 255, 90))
    im = Image.alpha_composite(im, hl.filter(ImageFilter.GaussianBlur(5)))
    save(im, 'Board-f00.png')


def make_placeholder():
    S = 250
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([6, 6, S - 7, S - 7], radius=46, fill=(0x3E, 0x03, 0x0A, 150))
    save(im, 'PlaceHolder-f00.png')


# ----------------------------------------------------------------- blocks ---

def make_blocks():
    for frame, tile_idx in enumerate(FRAME_TO_TILE):
        t = Image.open(f'{TEX}/block-rosso-{tile_idx}.png').convert('RGBA').resize((129, 129), Image.LANCZOS)
        save(t, f'Block-f0{frame}.png')
        # ghost: stessa arte scurita (viene disegnata al 30% di opacita)
        a = t.copy()
        px = a.load()
        for y in range(129):
            for x in range(129):
                r, g, b, al = px[x, y]
                if al:
                    px[x, y] = (int(r * 0.72), int(g * 0.72), int(b * 0.72), al)
        save(a, f'BlockBelow-f0{frame}.png')


# ------------------------------------------------------------------- logo ---

def make_logo():
    W, H = 841, 892
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    stroke = (0x4A, 0x02, 0x0A)

    def fit_font(text, target_w, start):
        size = start
        while size > 20:
            f = ImageFont.truetype(FONT, size)
            bb = d.textbbox((0, 0), text, font=f, stroke_width=int(size * 0.09))
            if bb[2] - bb[0] <= target_w:
                return f
            size -= 4
        return ImageFont.truetype(FONT, 20)

    # ---- BLOCK (crema/oro) ----
    f1 = fit_font('BLOCK', W - 120, 210)
    sw1 = int(f1.size * 0.10)
    bb = d.textbbox((0, 0), 'BLOCK', font=f1, stroke_width=sw1)
    w1, h1 = bb[2] - bb[0], bb[3] - bb[1]
    x1, y1 = (W - w1) // 2 - bb[0], 70 - bb[1]

    # ---- BLAST (piu grande) ----
    f2 = fit_font('BLAST', W - 90, 300)
    sw2 = int(f2.size * 0.09)
    bb2 = d.textbbox((0, 0), 'BLAST', font=f2, stroke_width=sw2)
    w2, h2 = bb2[2] - bb2[0], bb2[3] - bb2[1]
    x2, y2 = (W - w2) // 2 - bb2[0], 70 + h1 + 74 - bb2[1]

    # ombra morbida (estrusione verso il basso-destra)
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.text((x1 + 12, y1 + 16), 'BLOCK', font=f1, fill=EXTRUDE + (215,), stroke_width=sw1, stroke_fill=EXTRUDE + (215,))
    sd.text((x2 + 14, y2 + 18), 'BLAST', font=f2, fill=darken(EXTRUDE, 0.25) + (215,), stroke_width=sw2, stroke_fill=darken(EXTRUDE, 0.25) + (215,))
    sh = sh.filter(ImageFilter.GaussianBlur(5))

    # stroke scuro
    d.text((x1, y1), 'BLOCK', font=f1, fill=stroke + (255,), stroke_width=sw1, stroke_fill=stroke + (255,))
    d.text((x2, y2), 'BLAST', font=f2, fill=stroke + (255,), stroke_width=sw2, stroke_fill=stroke + (255,))

    # riempimento a gradiente oro (crema in alto -> oro in basso), glifo per glifo
    grad = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for yy in range(H):
        t = min(1, max(0, (yy - 60) / (H - 60)))
        c = mix(GOLD_HI, GOLD, t)
        gd.line([(0, yy), (W, yy)], fill=c + (255,))
    mask = Image.new('L', (W, H), 0)
    md = ImageDraw.Draw(mask)
    md.text((x1, y1), 'BLOCK', font=f1, fill=255, stroke_width=max(0, sw1 - 6))
    md.text((x2, y2), 'BLAST', font=f2, fill=255, stroke_width=max(0, sw2 - 6))
    im.paste(grad, (0, 0), mask)

    out = Image.alpha_composite(sh, im)
    save(out, 'Sprite2-f00.png')


# ---------------------------------------------------------------- buttons ---

def red_button(size, radius=None):
    """icona rossa con anello oro, come il riferimento."""
    R = radius if radius is not None else int(size * 0.30)
    S = size
    btn = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(btn)
    # anello oro metallico
    d.ellipse([0, 0, S - 1, S - 1], fill=GOLD + (255,))
    d.ellipse([3, 3, S - 4, S - 4], fill=darken(GOLD, 0.35) + (255,))
    # faccia rossa
    d.ellipse([7, 7, S - 8, S - 8], fill=ICON_FACE + (255,))
    # gloss: mezzaluna chiara in alto
    gloss = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    gd.ellipse([int(S * 0.14), int(S * 0.08), S - int(S * 0.14), int(S * 0.52)], fill=(255, 255, 255, 36))
    gloss = gloss.filter(ImageFilter.GaussianBlur(S // 14))
    base = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    base.alpha_composite(btn)
    base.alpha_composite(gloss)
    return base


def make_pause():
    S = 104
    btn = red_button(S)
    d = ImageDraw.Draw(btn)
    bw, bh, gap = 15, 42, 13
    x0 = (S - (bw * 2 + gap)) // 2
    y0 = (S - bh) // 2
    d.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], radius=7, fill=(255, 255, 255, 255))
    d.rounded_rectangle([x0 + bw + gap, y0, x0 + bw * 2 + gap, y0 + bh], radius=7, fill=(255, 255, 255, 255))
    save(btn, 'BtnPause-f00.png')


def make_close():
    S = 84
    btn = red_button(S)
    d = ImageDraw.Draw(btn)
    cx, cy, L, w = S // 2, S // 2, 20, 12
    for sgn in (1, -1):
        d.line([(cx - sgn * L, cy - L), (cx + sgn * L, cy + L)], fill=(255, 255, 255, 255), width=w)
    save(btn, 'BtnClose-f00.png')


def make_play():
    W, H = 336, 119
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # pillola rossa lucida (come il PLAY del tema caramella rosso)
    d.rounded_rectangle([2, 2, W - 3, H - 1], radius=H // 2, fill=PLAY1 + (255,))
    # ombra interna in basso
    sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle([2, int(H * 0.55), W - 3, H - 1], radius=H // 2, fill=PLAY2 + (255,))
    im = Image.alpha_composite(im, sh)
    d = ImageDraw.Draw(im)
    # gloss in alto
    gl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    gd.rounded_rectangle([8, 6, W - 9, int(H * 0.42)], radius=H // 2, fill=(255, 255, 255, 46))
    im = Image.alpha_composite(im, gl.filter(ImageFilter.GaussianBlur(4)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([2, 2, W - 3, H - 1], radius=H // 2, outline=darken(PLAY2, 0.3) + (255,), width=5)
    # testo PLAY + triangolo
    f = ImageFont.truetype(FONT, 60)
    txt = 'PLAY'
    bb = d.textbbox((0, 0), txt, font=f)
    tw = bb[2] - bb[0]
    tx = (W - tw) // 2 + 26
    ty = (H - (bb[3] - bb[1])) // 2 - bb[1] + 4
    ax = tx - 50
    d.polygon([(ax, 38), (ax, H - 39), (ax + 42, H // 2 + 1)], fill=(255, 255, 255, 255))
    d.text((tx, ty), txt, font=f, fill=(255, 255, 255, 255), stroke_width=6, stroke_fill=(0x4A, 0x02, 0x0A, 255))
    save(im, 'BtnPlay-f00.png')


# ------------------------------------------------------------ hue recolor ---

def shift_hue(src_name, dst_name, mapping, brighten=0.0, keep_alpha=True):
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


# verdi -> rosso · teal -> rosso · navy -> rosso scuro · ciano -> crema/oro
GREENS = [(55, 155, 352, 1.05)]
TEALS = [(150, 205, 352, 1.0)]
NAVY = [(195, 265, 354, 0.9)]
CYAN = [(165, 210, 40, 0.55)]


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

    for n in ['BtnHome-f00', 'BtnReset-f00', 'BtnRevive-f00', 'BtnGOReset-f00', 'BtnShowRanking-f00']:
        shift_hue(f'{n}.png', f'{n}.png', GREENS, brighten=0.42)
    for n in ['BtnMusic-f00', 'BtnSFX-f00']:
        shift_hue(f'{n}.png', f'{n}.png', GREENS, brighten=0.42)
    for n in ['BtnMusic-f01', 'BtnSFX-f01']:
        shift_hue(f'{n}.png', f'{n}.png', [(195, 265, 356, 0.5)])
    for n in ['BtnMusic2-f00', 'BtnMusic2-f01', 'BtnSFX2-f00', 'BtnSFX2-f01', 'BtnRanking-f00']:
        shift_hue(f'{n}.png', f'{n}.png', TEALS + NAVY)
    for n in ['PausePopup-f00', 'LeaderboardPopup2-f00']:
        shift_hue(f'{n}.png', f'{n}.png', NAVY)
    shift_hue('GameOver-f00.png', 'GameOver-f00.png', CYAN)
    print('DONE')


if __name__ == '__main__':
    main()
