#!/usr/bin/env python3
"""Render statico a risoluzione di design (1080x1920) della skin Rosso Glossy,
usando gli STESSI asset del gioco: gradient bg, plate, red-cell.png a 112px,
choco-shot tiles sulla strip come nel mockup, 3 vassoi. Poi confronto col mockup."""
from PIL import Image, ImageDraw, ImageFilter

W, H = 1080, 1920
img = Image.new('RGB', (W, H))
d = ImageDraw.Draw(img)

# --- background: linear 168deg c1 #B11524 -> c2 #7A0A12 (come il preset) ---
c1 = (0xB1, 0x15, 0x24)
c2 = (0x7A, 0x0A, 0x12)
for y in range(H):
    t = y / (H - 1)
    col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    d.line([(0, y), (W, y)], fill=col)

# --- board 1000x1000 centrata (540,831): plate #3A0208 radius 36 ---
BX, BY, BS = 40, 331, 1000  # left,top (540-500, 831-500)
plate = Image.new('RGBA', (BS, BS), (0, 0, 0, 0))
pd = ImageDraw.Draw(plate)
pd.rounded_rectangle([0, 0, BS, BS], radius=36, fill=(0x4A, 0x03, 0x09, 255))
# bordo scuro + ombra (come BoardFrameView 'dark')
img.paste(plate.filter(ImageFilter.GaussianBlur(6)), (BX - 8, BY - 8), plate.filter(ImageFilter.GaussianBlur(6)))
img.paste(plate, (BX, BY), plate)
pd2 = ImageDraw.Draw(img)
pd2.rounded_rectangle([BX, BY, BX + BS, BY + BS], radius=36, outline=(0x22, 0x01, 0x05), width=3)

# --- celle: red-cell.png 112px in ogni cella 120px (pad 4+4) ---
cell_tile = Image.open('/home/z/my-project/public/textures/red-cell.png').convert('RGB').resize((112, 112), Image.LANCZOS)
mask = Image.new('L', (112, 112), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 112, 112], radius=33, fill=255)
for r in range(8):
    for c in range(8):
        img.paste(cell_tile, (BX + c * 120 + 4, BY + r * 120 + 4), mask)

# --- strip caramelle come nel mockup: righe rosa/giallo/lime/marroni/nera/rossa/arancio/marrone/teal su col 3-5 ---
FLAVORS = [0, 1, 2, 3, 5, 7, 4, 6]  # rosa,giallo,lime,latte,fondente,rosso,arancio,menta -> ordine per riga mockup
rowc = [(0, 0xDE, 0x30, 0x59)]  # placeholder
ROWS = [
    ('choco-shot-1.png', None),   # rosa (tile lampone = shot-1? no: shot-0 rosa)
]
# mapping da probe mockup: riga0 rosa->tile rosa, riga1 giallo, riga2 lime, riga3 marrone chiaro, riga4 nero, riga5 rosso, riga6 arancio, riga7 marrone scuro(+teal sotto? no)
TILES = {
    'rosa': 'choco-shot-0.png', 'giallo': 'choco-shot-1.png', 'lime': 'choco-shot-2.png',
    'latte': 'choco-shot-3.png', 'arancio': 'choco-shot-4.png', 'menta': 'choco-shot-5.png',
    'fondente': 'choco-shot-6.png', 'rosso': 'choco-shot-7.png',
}
ORDER = ['rosa', 'giallo', 'lime', 'latte', 'fondente', 'rosso', 'arancio', 'fondente']
bmask = Image.new('L', (112, 112), 0)
ImageDraw.Draw(bmask).rounded_rectangle([3, 3, 109, 109], radius=16, fill=255)
for r, fl in enumerate(ORDER):
    t = Image.open(f'/home/z/my-project/public/textures/{TILES[fl]}').convert('RGB')
    t = t.resize((112, 112), Image.LANCZOS)
    for c in (3, 4, 5):
        img.paste(t, (BX + c * 120 + 4, BY + r * 120 + 4), bmask)

# --- 3 vassoi 250x250 a y 1626 (centri 196.5/539.5/883.5) ---
td = ImageDraw.Draw(img)
for cx in (196.5, 539.5, 883.5):
    x0, y0 = int(cx - 125), int(1626 - 125)
    td.rounded_rectangle([x0, y0, x0 + 250, y0 + 250], radius=36,
                         fill=(0x3E, 0x03, 0x0A), outline=(0x22, 0x01, 0x05), width=3)

img.save('/home/z/my-project/download/skin-studio/render-rosso-full.png')
print('saved render-rosso-full.png', img.size)

# --- confronto: mockup board area vs nostro render board area, stessa altezza ---
mock = Image.open('/home/z/my-project/upload/pasted_image_1789654565369.png').convert('RGB')
mb = mock.crop((90, 600, 1450, 2060))  # board del mockup (approx)
ob = img.crop((20, 300, 1060, 1340))
HH = 900
mb2 = mb.resize((int(mb.width * HH / mb.height), HH), Image.LANCZOS)
ob2 = ob.resize((int(ob.width * HH / ob.height), HH), Image.LANCZOS)
from PIL import ImageFont
cv = Image.new('RGB', (mb2.width + ob2.width + 60, HH + 70), (17, 18, 24))
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
cv.paste(mb2, (20, 60)); cv.paste(ob2, (mb2.width + 40, 60))
ImageDraw.Draw(cv).text((20 + mb2.width // 2, 30), 'MOCKUP (board nativa)', font=f, fill=(240, 130, 130), anchor='mm')
ImageDraw.Draw(cv).text((mb2.width + 40 + ob2.width // 2, 30), 'NOSTRO RENDER (asset reali, res nativa)', font=f, fill=(130, 240, 160), anchor='mm')
cv.save('/home/z/my-project/download/skin-studio/confronto-rosso-nat.png')
print('saved confronto-rosso-nat.png', cv.size)
