#!/usr/bin/env python3
"""Spec sheet PNG — how to make the single block tile for the Skin Studio
'Immagine' style. Output: download/skin-studio/spec-tessera-blocchetti.png
"""

from PIL import Image, ImageDraw, ImageFont

W, H = 1480, 1040
BG = (24, 24, 32)
PANEL = (32, 32, 42)
INK = (235, 235, 240)
MUTED = (150, 150, 162)
AMBER = (245, 158, 11)
NAVY = (16, 26, 76)
GOLD = (212, 175, 55)

FB = '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'
FR = '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'

def f(path, size):
    return ImageFont.truetype(path, size)

F_TITLE = f(FB, 40)
F_SUB = f(FR, 19)
F_H = f(FB, 21)
F_B = f(FR, 16)
F_BB = f(FB, 16)
F_S = f(FR, 14)
F_SS = f(FR, 13)

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)

def checker(x, y, size, cell=16):
    for yy in range(0, size, cell):
        for xx in range(0, size, cell):
            c = (52, 52, 62) if (xx // cell + yy // cell) % 2 == 0 else (38, 38, 47)
            d.rectangle([x + xx, y + yy, x + xx + cell - 1, y + yy + cell - 1], fill=c)

def rounded(xy, rad, **kw):
    d.rounded_rectangle(xy, radius=rad, **kw)

# ------------------------------------------------------------------ title --
d.text((60, 34), 'Tessera blocchetto — specifiche PNG', font=F_TITLE, fill=INK)
d.text((60, 88), 'Una tessera = UN blocchetto. Lo Skin Studio la replica automaticamente su ogni cella: '
                 'tabellone 8×8, pezzi nel vassoio, pezzo trascinato e anteprima di piazzamento.',
       font=F_SUB, fill=MUTED)

# ------------------------------------------------------------- left panel --
LX, LY, LW = 60, 150, 420
rounded([LX, LY, LX + LW, LY + 560], 18, fill=PANEL, outline=(60, 60, 72), width=2)
d.text((LX + 24, LY + 20), 'ESEMPIO (generata AI)', font=F_H, fill=AMBER)

EX = LX + (LW - 300) // 2
checker(EX, LY + 62, 300, 20)
tile = Image.open('public/textures/praline-0-lampone.png').convert('RGBA')
tile = tile.resize((280, 280), Image.LANCZOS)
img.paste(tile, (EX + 10, LY + 72), tile)
d = ImageDraw.Draw(img)
d.rectangle([EX, LY + 62, EX + 300, LY + 362], outline=(90, 90, 100), width=2)

d.text((LX + 24, LY + 385), '256 × 256 px · PNG · sfondo trasparente', font=F_BB, fill=INK)
d.text((LX + 24, LY + 415), ' dimensioni consigliate 256×256 (min 128, max 512)', font=F_S, fill=MUTED)
d.text((LX + 24, LY + 440), ' la trasparenza degli angoli crea il distacco tra', font=F_S, fill=MUTED)
d.text((LX + 24, LY + 462), '  cioccolatini adiacenti dentro lo stesso pezzo', font=F_S, fill=MUTED)
d.text((LX + 24, LY + 495), ' alternativa: tessera a tutto campo (senza', font=F_S, fill=MUTED)
d.text((LX + 24, LY + 517), '  trasparenza) = effetto barretta continua,', font=F_S, fill=MUTED)
d.text((LX + 24, LY + 539), '  poi regola gli angoli arrotondati nello studio', font=F_S, fill=MUTED)

# ------------------------------------------------------------ right panel --
RX, RY, RW = 520, 150, 900
rounded([RX, RY, RX + RW, RY + 560], 18, fill=PANEL, outline=(60, 60, 72), width=2)
d.text((RX + 24, RY + 20), 'ANATOMIA DELLA TESSERA', font=F_H, fill=AMBER)

# anatomy diagram
AX, AY, AS = RX + 40, RY + 70, 300
d.setfont = None
# cell boundary (dashed)
for i in range(0, AS, 18):
    d.line([AX + i, AY, AX + min(i + 10, AS), AY], fill=(120, 120, 132), width=2)
    d.line([AX + i, AY + AS, AX + min(i + 10, AS), AY + AS], fill=(120, 120, 132), width=2)
    d.line([AX, AY + i, AX, AY + min(i + 10, AS)], fill=(120, 120, 132), width=2)
    d.line([AX + AS, AY + i, AX + AS, AY + min(i + 10, AS)], fill=(120, 120, 132), width=2)
# the tile itself (rounded square)
inset = 18
rounded([AX + inset, AY + inset, AX + AS - inset, AY + AS - inset], 56,
        fill=(212, 45, 91), outline=(150, 25, 62), width=3)
# quilted pattern hint
for off in (70, 150, 230):
    d.line([AX + inset + 8, AY + off, AX + AS - inset - 8, AY + off], fill=(232, 92, 130), width=2)
d.ellipse([AX + 46, AY + 42, AX + 118, AY + 84], fill=(255, 205, 220))
d.text((AX + 12, AY + AS + 14), 'limite cella (dashed) · blocchetto ~90% · angoli ~20%', font=F_SS, fill=MUTED)

# light arrow (annotation column, right of the diagram)
CX = RX + 400
d.polygon([(CX + 24, RY + 88), (CX + 84, RY + 88), (CX + 84, RY + 80), (CX + 108, RY + 96),
           (CX + 84, RY + 112), (CX + 84, RY + 104), (CX + 24, RY + 104)], fill=(255, 235, 190))
d.text((CX + 24, RY + 126), 'LUCE da sopra-sinistra', font=F_BB, fill=(255, 235, 190))
d.text((CX + 24, RY + 150), '(coerente su tutti i gusti!)', font=F_S, fill=MUTED)

# no external shadow icon
SX2, SY2 = CX + 24, RY + 200
rounded([SX2, SY2, SX2 + 84, SY2 + 62], 14, fill=(70, 52, 44))
d.line([(SX2 + 96, SY2 + 8), (SX2 + 140, SY2 + 54)], fill=(239, 68, 68), width=3)
d.line([(SX2 + 140, SY2 + 8), (SX2 + 96, SY2 + 54)], fill=(239, 68, 68), width=3)
d.text((CX + 110, SY2 + 6), 'NO ombra esterna nel PNG', font=F_BB, fill=INK)
d.text((CX + 110, SY2 + 30), 'la aggiunge lo studio (slider "Ombra sotto', font=F_S, fill=MUTED)
d.text((CX + 110, SY2 + 50), 'il blocchetto") e non si sovrappone tra celle', font=F_S, fill=MUTED)

# single piece rule
SX3, SY3 = CX + 24, RY + 290
rounded([SX3, SY3, SX3 + 62, SY3 + 62], 12, outline=(90, 200, 120), width=3)
d.text((SX3 + 24, SY3 + 18), '1', font=f(FB, 26), fill=(90, 200, 120))
d.text((CX + 110, SY3 + 6), 'UN solo blocchetto per file', font=F_BB, fill=INK)
d.text((CX + 110, SY3 + 30), 'i pezzi hanno 36 forme diverse: L, T, S, 1×1…', font=F_S, fill=MUTED)
d.text((CX + 110, SY3 + 50), 'il gioco compone le forme ripetendo la tessera', font=F_S, fill=MUTED)

# view rule — two supported views
SX4, SY4 = CX + 24, RY + 380
flat_t = Image.open('public/textures/praline-3-latte.png').convert('RGBA').resize((58, 58), Image.LANCZOS)
iso_t = Image.open('public/textures/praline-iso-3-latte.png').convert('RGBA').resize((58, 58), Image.LANCZOS)
img.paste(flat_t, (SX4 + 2, SY4 + 2), flat_t)
img.paste(iso_t, (SX4 + 70, SY4 + 2), iso_t)
d = ImageDraw.Draw(img)
d.text((CX + 160, SY4 - 2), 'VISTA: 2 opzioni (coerenti nel set!)', font=F_BB, fill=INK)
d.text((CX + 160, SY4 + 22), 'dall\u2019alto (flat) — silhouette quadrata, oppure', font=F_S, fill=MUTED)
d.text((CX + 160, SY4 + 42), 'isometrica 3/4 con spessore — mai mischiate', font=F_S, fill=MUTED)
d.text((SX4 + 2, SY4 + 64), 'flat', font=F_SS, fill=(90, 200, 120))
d.text((SX4 + 70, SY4 + 64), 'iso', font=F_SS, fill=(90, 200, 120))

# flavors
FY = RY + 480
d.text((RX + 24, FY), 'GUSTI (8 colori del gioco) — fai una tessera per gusto, o 1 neutra + tinta automatica',
       font=F_BB, fill=INK)
flavors = [
    ('Lampone', '#D42D5B'), ('Limone', '#E8B830'), ('Lime', '#8CB832'), ('Latte', '#6B3E26'),
    ('Arancio', '#E87D30'), ('Menta', '#2DB892'), ('Fondente', '#4E342E'), ('Caramello', '#C98A4B'),
]
for i, (name, hexc) in enumerate(flavors):
    r, c = divmod(i, 4)
    x = RX + 24 + c * 220
    y = FY + 34 + r * 44
    rgb = tuple(int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    d.rounded_rectangle([x, y, x + 30, y + 30], 8, fill=rgb, outline=(255, 255, 255, 60), width=1)
    d.text((x + 40, y + 1), name, font=F_B, fill=INK)
    d.text((x + 40, y + 21), f'RGB {rgb[0]}·{rgb[1]}·{rgb[2]}   {hexc}', font=F_SS, fill=MUTED)

# ------------------------------------------------------------- bottom bar --
BY = 740
rounded([60, BY, W - 60, BY + 240], 18, fill=PANEL, outline=(60, 60, 72), width=2)
d.text((84, BY + 18), 'COME SI CARICA NELLO SKIN STUDIO', font=F_H, fill=AMBER)
steps = [
    ('1', 'Seleziona l\u2019elemento BLOCCHI nell\u2019anteprima (o nella lista a sinistra)'),
    ('2', 'Stile \u2192 "Immagine (upload)"  ·  poi scegli la modalit\u00e0: unica tessera o una per colore'),
    ('3', 'Trascina il PNG nel riquadro (o clicca per sceglierlo): diventa subito il blocchetto'),
    ('4', 'oppure usa i SET DEMO pronti: \u201cDall\u2019alto\u201d e \u201cIsometrica\u201d (cioccolatini AI)'),
    ('5', 'Regola ombra, angoli, spaziatura \u2192 poi GIOCA in alto per provarla dal vivo'),
]
for i, (n, t) in enumerate(steps):
    y = BY + 52 + i * 36
    d.ellipse([84, y, 108, y + 24], fill=NAVY, outline=GOLD, width=2)
    d.text((93 if n != '1' else 95, y + 2), n, font=F_BB, fill=GOLD)
    d.text((124, y + 2), t, font=F_B, fill=INK)

out = 'download/skin-studio/spec-tessera-blocchetti.png'
img.save(out)
print('OK', out)
