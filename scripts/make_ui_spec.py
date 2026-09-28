#!/usr/bin/env python3
"""Spec sheet dimensioni elementi UI — diagramma HOME + GIOCO in design space
1080×1920 con le bbox reali del codice + tabella upload consigliati.
Genera anche uno sfondo demo 1080×1920 da caricare nello Studio."""
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------- font ----
FB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def f(sz, bold=True): return ImageFont.truetype(FB if bold else FR, sz)

W, H = 1980, 1240
img = Image.new('RGB', (W, H), (17, 18, 24))
d = ImageDraw.Draw(img)
ACC = (236, 176, 32)     # ambra
BLU = (90, 140, 255)
CYA = (60, 200, 210)
GRN = (110, 220, 140)
MAG = (230, 110, 200)
RED = (240, 110, 110)
GRY = (140, 145, 160)

# ------------------------------------------------------ phone diagram ----
def phone(x0, y0, s, title):
    """disegna un telefono 1080×1920 scalato di s, ritorna helper per bbox"""
    w, h = int(1080 * s), int(1920 * s)
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=26, outline=GRY, width=3, fill=(24, 26, 36))
    d.text((x0 + w / 2, y0 - 40), title, font=f(30), fill=(235, 235, 245), anchor='mm')
    def box(cx, cy, bw, bh, color, label, sub='', dashed=False):
        lx, ty = x0 + (cx - bw / 2) * s, y0 + (cy - bh / 2) * s
        rx, by = lx + bw * s, ty + bh * s
        if dashed:
            for i in range(int(lx), int(rx), 14):
                d.line([i, ty, min(i + 7, rx), ty], fill=color, width=2)
                d.line([i, by, min(i + 7, rx), by], fill=color, width=2)
            for j in range(int(ty), int(by), 14):
                d.line([lx, j, lx, min(j + 7, by)], fill=color, width=2)
                d.line([rx, j, rx, min(j + 7, by)], fill=color, width=2)
        else:
            d.rectangle([lx, ty, rx, by], outline=color, width=3)
        txt = label if not sub else f'{label}  {sub}'
        tw = d.textlength(txt, font=f(20))
        d.rectangle([lx + 4, ty - 26, lx + tw + 14, ty - 2], fill=(17, 18, 24))
        d.text((lx + 9, ty - 14), txt, font=f(20), fill=color, anchor='lm')
    return box

S = 0.40  # scala telefono

# ---- HOME ----
box = phone(140, 120, S, 'HOME — design space 1080×1920')
box(540.5, 532, 837, 888, ACC, 'LOGO', '837×888')
box(540, 1295, 625, 216, GRN, 'PLAY', '625×216')
for x, lab in ((175, 'sfx'), (540, 'ranking'), (906, 'music')):
    box(x, 1770, 170, 170, CYA, lab.upper(), '170×170')
d.text((140 + 1080 * S / 2, 120 + 1920 * S + 34),
       'Sfondo: IMMAGINE a tutto schermo → 1080×1920', font=f(24), fill=GRY, anchor='mm')

# ---- GIOCO ----
gx = 140 + int(1080 * S) + 150
box = phone(gx, 120, S, 'GIOCO — design space 1080×1920')
box(540, 211.5, 700, 160, MAG, 'SCORE', '700×160')
box(97, 76, 104, 104, CYA, 'COPPA', '104')
box(974, 88, 100, 100, CYA, 'PAUSA', '100')
box(540, 831, 1000, 1000, BLU, 'TABELLONE 8×8', '1000×1000 · cella 120×120 (pad 20)')
for i, x in enumerate((196.5, 539.5, 883.5)):
    box(x, 1626, 250, 250, GRN, f'VASSOIO {i + 1}', '250×250')
d.text((gx + 1080 * S / 2, 120 + 1920 * S + 34),
       'Popup (pausa/game over): 886×1113 centrato', font=f(24), fill=GRY, anchor='mm')

# ---------------------------------------------------------- tabella ----
tx, ty = gx + int(1080 * S) + 90, 210
d.text((tx, ty), 'COSA CARICHI NELLO STUDIO', font=f(28), fill=(235, 235, 245), anchor='la')
rows = [
    ('Elemento', 'Dove', 'Dimensione upload', None),
    ('Sfondo', 'Scena → Sfondo', '1080×1920 (9:16)', ACC),
    ('Blocchi / tessere', 'Blocchi → Immagine', '256×256 quadrata', BLU),
    ('Cella tabellone', 'Scena → Tabellone', '256×256 quadrata', BLU),
    ('Vassoio pezzi', 'Scena → Vassoio', '256×256 quadrata', GRN),
    ('Logo', 'Testi → Logo', 'testo+font (niente img)', GRY),
    ('PLAY', 'Pulsanti → PLAY', 'colori/forma (niente img)', GRY),
    ('Popup', 'Pulsanti → Popup', 'colore superficie', GRY),
    ('', '', '', None),
    ('REGOLA GENERALE', '', '', None),
    ('Le immagini grandi vengono', '', 'ridotte automaticamente:', None),
    ('sfondo → max 1080×1920', '', 'tessere → 256×256', None),
    ('Formati: PNG (anche con', '', 'trasparenza) o JPG', None),
]
y = ty + 46
for label, dove, dim, col in rows:
    if col is None and label == 'Elemento':
        for xoff, t in ((0, label), (250, dove), (470, dim)):
            d.text((tx + xoff, y), t, font=f(22), fill=GRY)
        d.line([tx, y + 28, tx + 760, y + 28], fill=(60, 62, 74), width=2)
    elif label and dim:
        d.text((tx, y), label, font=f(21), fill=col or (220, 220, 230))
        d.text((tx + 250, y), dove, font=f(19, False), fill=(180, 184, 196))
        d.text((tx + 470, y), dim, font=f(19, False), fill=(220, 220, 230))
    elif label:
        d.text((tx, y), label, font=f(20, False), fill=(200, 204, 216))
    y += 36

# nota posizioni
d.text((tx, y + 16), 'Sistema di coordinate: centro-based.', font=f(19, False), fill=GRY)
d.text((tx, y + 44), 'Ogni elemento ha centro (x,y) e dimensione;', font=f(19, False), fill=GRY)
d.text((tx, y + 72), 'nel layout editor trascini/ridimensioni.', font=f(19, False), fill=GRY)

# ------------------------------------------------------------- save ----
out = '/home/z/my-project/download/skin-studio/spec-elementi-ui.png'
img.save(out)
print('saved', out, img.size)

# ------------------------------------------------ demo bg 1080x1920 ----
bg = Image.new('RGB', (1080, 1920))
bd = ImageDraw.Draw(bg)
c1, c2 = (37, 48, 100), (16, 22, 62)
for y_ in range(1920):
    t = y_ / 1919
    col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    bd.line([(0, y_), (1080, y_)], fill=col)
# vignetta morbida + scritte
for i in range(120):
    a = int(90 * (1 - i / 120))
    bd.rectangle([i, i, 1079 - i, 1919 - i], outline=(10, 14, 40, a))
bd.text((540, 960), 'SFONDO DEMO 1080×1920', font=f(64), fill=(90, 105, 175), anchor='mm')
bd.text((540, 1040), 'caricami nell\u2019elemento Sfondo', font=f(36, False), fill=(80, 92, 150), anchor='mm')
out2 = '/home/z/my-project/download/skin-studio/sfondo-demo.png'
bg.save(out2)
print('saved', out2, bg.size)
