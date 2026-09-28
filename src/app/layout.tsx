import type { Metadata, Viewport } from "next";
import "./globals.css";

// Prefisso del sotto-percorso di deploy (GitHub Pages). I @font-face vivono
// qui (non in globals.css) perché il CSS statico non può leggere env: il
// valore viene inlinato al build.
const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const FONT_FACES = `
@font-face { font-family: 'Riffic'; src: url('${BP}/fonts/riffic-bold.woff2') format('woff2'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Fredoka'; src: url('${BP}/fonts/fredoka-600.woff2') format('woff2'); font-weight: 600; font-display: swap; }
@font-face { font-family: 'Fredoka'; src: url('${BP}/fonts/fredoka-700.woff2') format('woff2'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Baloo 2'; src: url('${BP}/fonts/baloo2-800.woff2') format('woff2'); font-weight: 800; font-display: swap; }
@font-face { font-family: 'Lilita One'; src: url('${BP}/fonts/lilitaone-400.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Luckiest Guy'; src: url('${BP}/fonts/luckiestguy-400.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Bangers'; src: url('${BP}/fonts/bangers-400.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Press Start 2P'; src: url('${BP}/fonts/pressstart2p-400.woff2') format('woff2'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Carlito'; src: url('${BP}/fonts/carlito-regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Carlito'; src: url('${BP}/fonts/carlito-bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
`;

export const metadata: Metadata = {
  title: "Block Rush 1:1",
  description:
    "Block Rush — il puzzle block 1:1 pixel perfect: trascina i blocchi sulla griglia 8×8, completa righe e colonne, insegue le combo. Include bot giocatore e recorder video per YouTube/TikTok.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: FONT_FACES }} />
      </head>
      <body className="antialiased bg-black">{children}</body>
    </html>
  );
}
