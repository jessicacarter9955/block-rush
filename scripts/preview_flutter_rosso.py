#!/usr/bin/env python3
"""Anteprima statica 1080x1920 del look Flutter Block Blast Rosso 1:1:
home (bg gradiente vero + logo + PLAY + icone) e gioco (board + celle + blocchi
+ vassoi), usando GLI STESSI sprite del port."""
from PIL import Image, ImageDraw

SPR = '/home/z/my-project/best-block-blast/assets/sprites-named'
W, H = 1080, 1920

# ---- HOME ----
home = Image.new('RGBA', (W, H))
bg = Image.open(f'{SPR}/Bg-f00.png').convert('RGBA').resize((W, H), Image.LANCZOS)
home.alpha_composite(bg)
logo = Image.open(f'{SPR}/Sprite2-f00.png').convert('RGBA')
home.alpha_composite(logo, (int(540 - logo.width / 2), int(532 - logo.height / 2)))
play = Image.open(f'{SPR}/BtnPlay-f00.png').convert('RGBA')
home.alpha_composite(play, (int(540 - play.width / 2), int(1295 - play.height / 2)))
for x, name in ((175, 'BtnSFX2-f00.png'), (540, 'BtnRanking-f00.png'), (906, 'BtnMusic2-f00.png')):
    ic = Image.open(f'{SPR}/{name}').convert('RGBA')
    home.alpha_composite(ic, (int(x - ic.width / 2), int(1770 - ic.height / 2)))
home.convert('RGB').save('/home/z/my-project/download/rosso-11/flutter-home-preview.png')
print('home ok')

# ---- GIOCO ----
game = Image.new('RGBA', (W, H))
game.alpha_composite(bg)
d = ImageDraw.Draw(game)
board = Image.open(f'{SPR}/Board-f00.png').convert('RGBA')
game.alpha_composite(board, (int(540 - board.width / 2), int(831 - board.height / 2)))
spot = Image.open(f'{SPR}/Spot-f00.png').convert('RGBA')
# griglia originale: board 1000x1000 a (540,831), pad 20, celle 120
bx, by = 540 - 500, 831 - 500
for r in range(8):
    for c in range(8):
        game.alpha_composite(spot, (bx + 20 + c * 120, by + 20 + r * 120))
# blocchi caramella come nel riferimento (strip 3 colonne: rosa,giallo,lime,latte,arancio,fondente,menta,rosso)
order = [7, 4, 2, 0, 6, 5, 1, 3]  # rosa(f7), giallo(f4), lime(f2), latte(f0), rosso(f6), arancio(f5), menta(f1), fondente(f3)
for r, frame in enumerate(order):
    blk = Image.open(f'{SPR}/Block-f0{frame}.png').convert('RGBA').resize((120, 120), Image.LANCZOS)
    for c in (3, 4, 5):
        game.alpha_composite(blk, (bx + 20 + c * 120, by + 20 + r * 120))
# vassoi
ph = Image.open(f'{SPR}/PlaceHolder-f00.png').convert('RGBA')
for cx in (196.5, 539.5, 883.5):
    game.alpha_composite(ph, (int(cx - 125), int(1626 - 125)))
# pezzo nel vassoio centrale
blk = Image.open(f'{SPR}/Block-f00.png').convert('RGBA').resize((120, 120), Image.LANCZOS)
game.alpha_composite(blk, (int(539.5 - 125 + 65), int(1626 - 125 + 65)))
game.convert('RGB').save('/home/z/my-project/download/rosso-11/flutter-game-preview.png')
print('game ok')
