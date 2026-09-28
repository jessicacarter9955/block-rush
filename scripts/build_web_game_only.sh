#!/bin/bash
# Assembla il tree del repo web "solo gioco" (Block Rush 1:1)
# → /home/z/my-project/web-game-only/
set -e
SRC=/home/z/my-project
DST=/home/z/my-project/web-game-only

rm -rf "$DST"
mkdir -p "$DST"/{src/app/play,src/components/game,src/components/blocks,src/lib,.github/workflows}

# ---- sorgenti ----
cp "$SRC/src/components/game/Kit.tsx"        "$DST/src/components/game/"
cp "$SRC/src/components/game/PlayGame.tsx"   "$DST/src/components/game/"
cp "$SRC/src/components/blocks/BlockTile.tsx" "$DST/src/components/blocks/"
for f in skin.ts store.ts game.ts bot.ts audio.ts color.ts assets-data.ts utils.ts; do
  cp "$SRC/src/lib/$f" "$DST/src/lib/"
done
cp "$SRC/src/app/globals.css" "$DST/src/app/"
cp "$SRC/src/app/play/page.tsx" "$DST/src/app/play/"

# ---- public (solo asset del gioco) ----
mkdir -p "$DST/public"
cp -r "$SRC/public/sprites"        "$DST/public/sprites"
cp -r "$SRC/public/textures/rush"  "$DST/public/textures-rush-tmp"
mkdir -p "$DST/public/textures"
mv "$DST/public/textures-rush-tmp" "$DST/public/textures/rush"
cp -r "$SRC/public/audio"          "$DST/public/audio"
mkdir -p "$DST/public/fonts"
for f in riffic-bold.woff2 luckiestguy-400.woff2 lilitaone-400.woff2 baloo2-800.woff2 \
         fredoka-600.woff2 fredoka-700.woff2 bangers-400.woff2 pressstart2p-400.woff2 \
         carlito-bold.ttf carlito-regular.ttf; do
  cp "$SRC/public/fonts/$f" "$DST/public/fonts/" 2>/dev/null || echo "WARN manca $f"
done
cp "$SRC/public/robots.txt" "$DST/public/" 2>/dev/null || true

# ---- config ----
cp "$SRC/tsconfig.json" "$DST/"
cp "$SRC/postcss.config.mjs" "$DST/" 2>/dev/null || cp "$SRC/postcss.config.js" "$DST/"

echo "tree base pronto in $DST"
