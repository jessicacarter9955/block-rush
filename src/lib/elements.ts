// Element registry — every editable UI element of the game, its category,
// the screens where it appears, original sprite info and editor fields.

import type { FontId } from './skin';

export type ScreenId = 'home' | 'game' | 'popups';

export type Field =
  | { type: 'variant'; label: string; path: string; variants: { id: string; label: string }[] }
  | { type: 'color'; label: string; path: string; original?: string }
  | { type: 'slider'; label: string; path: string; min: number; max: number; step?: number; unit?: string }
  | { type: 'toggle'; label: string; path: string }
  | { type: 'select'; label: string; path: string; options: { value: string; label: string }[] }
  | { type: 'text'; label: string; path: string }
  | { type: 'font'; label: string; path: string }
  | { type: 'image'; label: string; path: string; hint?: string }
  | { type: 'bgimage'; label: string; path: string }
  | { type: 'iconVariants'; label: string; path: string }
  | { type: 'blockColors' }
  | { type: 'blockImages' }
  | { type: 'soundEvents' }
  | { type: 'soundLibrary' };

export interface ElementDef {
  id: string;
  category: CategoryId;
  label: string;
  description: string;
  screens: ScreenId[];
  /** original sprite(s) shown in the info card */
  sprite?: { name: string; drawn?: [number, number]; frames?: number };
  fields: Field[];
}

export type CategoryId =
  | 'blocks' | 'scene' | 'ui' | 'testi' | 'icone' | 'effetti' | 'suoni';

export const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'blocks', label: 'Blocchi', icon: 'grid' },
  { id: 'scene', label: 'Scena', icon: 'layout' },
  { id: 'ui', label: 'Pulsanti & UI', icon: 'mouse' },
  { id: 'testi', label: 'Testi & Font', icon: 'type' },
  { id: 'icone', label: 'Icone', icon: 'star' },
  { id: 'effetti', label: 'Effetti', icon: 'sparkles' },
  { id: 'suoni', label: 'Suoni', icon: 'music' },
];

const fontOptions = (extra: { value: string; label: string }[] = []) => extra;

export const ELEMENTS: ElementDef[] = [
  // ------------------------------------------------------------- BLOCCHI ---
  {
    id: 'blocks',
    category: 'blocks',
    label: 'Blocchi',
    description:
      'I blocchi del gioco: stile globale e colore RGB di ognuno degli 8 colori originali. Clicca un blocco sul tabellone per selezionarne il colore.',
    screens: ['game'],
    sprite: { name: 'Block', drawn: [120, 120], frames: 8 },
    fields: [
      {
        type: 'variant',
        label: 'Stile',
        path: 'blocks.style',
        variants: [
          { id: 'original', label: 'Originale' },
          { id: 'relief', label: 'Classico' },
          { id: 'flat', label: 'Piatto' },
          { id: 'gradient', label: 'Gradiente' },
          { id: 'glossy', label: 'Caramella' },
          { id: 'neon', label: 'Neon' },
          { id: 'pixel', label: 'Pixel' },
          { id: 'glass', label: 'Vetro' },
          { id: 'outline', label: 'Contorno' },
          { id: 'choco', label: 'Cioccolato' },
          { id: 'praline', label: 'Cioccolatino' },
          { id: 'image', label: 'Immagine (upload)' },
        ],
      },
      { type: 'blockImages' },
      { type: 'blockColors' },
      { type: 'slider', label: 'Angoli arrotondati', path: 'blocks.radius', min: 0, max: 30, unit: '%' },
      { type: 'slider', label: 'Spazio tra blocchi', path: 'blocks.gap', min: 0, max: 16, unit: 'px' },
      { type: 'slider', label: 'Spessore bordo', path: 'blocks.border', min: 0, max: 12, unit: 'px' },
    ],
  },
  {
    id: 'ghost',
    category: 'blocks',
    label: 'Anteprima piazzamento',
    description:
      'Il fantasma che mostra dove cadrebbe il pezzo durante il trascinamento (BlockBelow + ombra nell\'originale).',
    screens: ['game'],
    sprite: { name: 'BlockBelow', drawn: [120, 120], frames: 8 },
    fields: [
      {
        type: 'variant',
        label: 'Stile',
        path: 'ghost.style',
        variants: [
          { id: 'original', label: 'Originale' },
          { id: 'tint', label: 'Tinta unita' },
          { id: 'outline', label: 'Contorno' },
        ],
      },
      { type: 'slider', label: 'Opacità', path: 'ghost.opacity', min: 10, max: 100, unit: '%' },
    ],
  },

  // --------------------------------------------------------------- SCENA ---
  {
    id: 'background',
    category: 'scene',
    label: 'Sfondo',
    description:
      'Lo sfondo delle schermate. Nell\'originale è una striscia sfumata 27×1920 stirata a tutto schermo.',
    screens: ['home', 'game'],
    sprite: { name: 'Bg', drawn: [1080, 1920] },
    fields: [
      {
        type: 'variant',
        label: 'Stile',
        path: 'background.style',
        variants: [
          { id: 'original', label: 'Originale' },
          { id: 'solid', label: 'Tinta unita' },
          { id: 'gradient', label: 'Gradiente' },
          { id: 'radial', label: 'Radiale' },
          { id: 'night', label: 'Notte' },
        ],
      },
      { type: 'color', label: 'Colore alto / base', path: 'background.c1', original: '#4259A5' },
      { type: 'color', label: 'Colore basso / bordo', path: 'background.c2', original: '#334D8E' },
      { type: 'slider', label: 'Vignettatura', path: 'background.vignette', min: 0, max: 100, unit: '%' },
      {
        type: 'select',
        label: 'Decorazione animata',
        path: 'background.decor',
        options: [
          { value: 'none', label: 'Nessuna' },
          { value: 'stars', label: 'Stelle scintillanti' },
          { value: 'bubbles', label: 'Bolle che salgono' },
          { value: 'grid', label: 'Griglia retrò' },
        ],
      },
      { type: 'bgimage', label: 'Immagine sfondo (gioco)', path: 'background.img' },
      { type: 'bgimage', label: 'Immagine sfondo home', path: 'background.imgHome' },
      {
        type: 'select',
        label: 'Adattamento immagine',
        path: 'background.imgFit',
        options: [
          { value: 'cover', label: 'Riempi (cover)' },
          { value: 'contain', label: 'Contieni (contain)' },
          { value: 'fill', label: 'Stira (fill)' },
        ],
      },
      { type: 'slider', label: 'Scurisci immagine', path: 'background.imgDim', min: 0, max: 100, unit: '%' },
    ],
  },
  {
    id: 'board',
    category: 'scene',
    label: 'Tabellone',
    description:
      'La cornice 8×8 con le celle vuote. Nell\'originale è un unico sprite 994×994 disegnato a 1000×1000.',
    screens: ['game'],
    sprite: { name: 'Board', drawn: [1000, 1000] },
    fields: [
      {
        type: 'variant',
        label: 'Stile',
        path: 'board.style',
        variants: [
          { id: 'original', label: 'Originale' },
          { id: 'image', label: 'Immagine 1:1' },
          { id: 'dark', label: 'Scuro' },
          { id: 'glass', label: 'Vetro' },
          { id: 'neon', label: 'Neon' },
          { id: 'outline', label: 'Contorno' },
          { id: 'gold', label: 'Oro' },
        ],
      },
      { type: 'image', label: 'Immagine cornice 1:1', path: 'board.img', hint: 'PNG 1086×1086 con trasparenza: bordo neon con glow, area celle allineata alla griglia' },
      { type: 'color', label: 'Colore cornice', path: 'board.frameColor', original: '#0D1533' },
      { type: 'color', label: 'Colore celle vuote', path: 'board.cellColor', original: '#18244A' },
      { type: 'color', label: 'Colore linee', path: 'board.lineColor', original: '#0D1533' },
      { type: 'slider', label: 'Angoli', path: 'board.radius', min: 0, max: 48, unit: 'px' },
      {
        type: 'image',
        label: 'Immagine cella (opzionale)',
        path: 'board.cellImg',
        hint: 'una tessera quadrata ripetuta su tutte le 64 celle',
      },
    ],
  },
  {
    id: 'tray',
    category: 'scene',
    label: 'Vassoio dei pezzi',
    description:
      'I tre riquadri (PlaceHolder 250×250) che contengono i pezzi in attesa.',
    screens: ['game'],
    sprite: { name: 'PlaceHolder', drawn: [250, 250], frames: 2 },
    fields: [
      {
        type: 'variant',
        label: 'Stile',
        path: 'tray.style',
        variants: [
          { id: 'original', label: 'Originale' },
          { id: 'glass', label: 'Vetro' },
          { id: 'dark', label: 'Scuro' },
          { id: 'none', label: 'Nessuno' },
        ],
      },
      { type: 'color', label: 'Colore', path: 'tray.color', original: '#101B3E' },
      { type: 'slider', label: 'Opacità', path: 'tray.opacity', min: 10, max: 100, unit: '%' },
      { type: 'image', label: 'Immagine vassoio', path: 'tray.img', hint: 'Un quadratino PNG 256×256 (cornice + interno) applicato a tutti e 3 i vassoi' },
    ],
  },

  // ------------------------------------------------------------------ UI ---
  {
    id: 'playBtn',
    category: 'ui',
    label: 'Bottone PLAY',
    description:
      'Il grande bottone della home. Sprite originale 336×119 disegnato a 625×216.',
    screens: ['home'],
    sprite: { name: 'BtnPlay', drawn: [625, 216] },
    fields: [
      {
        type: 'variant',
        label: 'Stile',
        path: 'playBtn.style',
        variants: [
          { id: 'original', label: 'Originale' },
          { id: 'pill', label: 'Pillola' },
          { id: 'rounded', label: 'Arrotondato' },
          { id: 'neon', label: 'Neon' },
          { id: 'pixel', label: 'Pixel' },
        ],
      },
      { type: 'image', label: 'Immagine bottone 1:1', path: 'playBtn.img', hint: 'PNG con trasparenza dallo screenshot — sostituisce lo stile CSS (glifo incluso)' },
      { type: 'slider', label: 'Dimensione bottone', path: 'playBtn.size', min: 60, max: 140, unit: '%' },
      { type: 'slider', label: 'Posizione Y (home)', path: 'playBtn.y', min: 1150, max: 1450, unit: 'px' },
      { type: 'color', label: 'Colore 1', path: 'playBtn.c1', original: '#F0AE34' },
      { type: 'color', label: 'Colore 2', path: 'playBtn.c2', original: '#DD950F' },
      { type: 'color', label: 'Colore testo', path: 'playBtn.textColor', original: '#FFFFFF' },
      { type: 'text', label: 'Testo', path: 'playBtn.text' },
      { type: 'slider', label: 'Bagliore', path: 'playBtn.glow', min: 0, max: 100, unit: '%' },
    ],
  },
  {
    id: 'iconBtn',
    category: 'ui',
    label: 'Bottoni icona',
    description:
      'Musica, effetti, pausa, ranking, home, reset, chiudi: tutti i bottoncini quadrati del gioco.',
    screens: ['home', 'game', 'popups'],
    sprite: { name: 'BtnMusic2', drawn: [170, 170], frames: 2 },
    fields: [
      {
        type: 'variant',
        label: 'Stile',
        path: 'iconBtn.style',
        variants: [
          { id: 'original', label: 'Originale' },
          { id: 'circle', label: 'Cerchio' },
          { id: 'rounded', label: 'Arrotondato' },
          { id: 'pixel', label: 'Pixel' },
          { id: 'outline', label: 'Contorno' },
        ],
      },
      { type: 'color', label: 'Colore sfondo', path: 'iconBtn.bg', original: '#1C2A55' },
      { type: 'color', label: 'Colore icona', path: 'iconBtn.iconColor', original: '#FFFFFF' },
      { type: 'iconVariants', label: 'Varianti premium', path: 'iconBtn.variants' },
      { type: 'image', label: 'Immagine bottone base', path: 'iconBtn.img', hint: 'guscio generico (senza glifo): usato per i tipi senza immagine dedicata' },
      { type: 'image', label: 'Bottone musica 1:1', path: 'iconBtn.imgs.music', hint: 'PNG con glifo incluso, estratto dallo screenshot' },
      { type: 'image', label: 'Bottone audio 1:1', path: 'iconBtn.imgs.sfx', hint: 'PNG con glifo incluso' },
      { type: 'image', label: 'Bottone ranking 1:1', path: 'iconBtn.imgs.ranking', hint: 'PNG con glifo incluso' },
      { type: 'image', label: 'Bottone pausa 1:1', path: 'iconBtn.imgs.pause', hint: 'PNG con glifo incluso' },
      { type: 'slider', label: 'Dimensione bottoni home', path: 'iconBtn.size', min: 100, max: 220, unit: 'px' },
      { type: 'slider', label: 'Riga bottoni Y (home)', path: 'iconBtn.rowY', min: 1500, max: 1870, unit: 'px' },
    ],
  },
  {
    id: 'popup',
    category: 'ui',
    label: 'Popup e banner',
    description:
      'Le finestre di pausa, game over, classifica e i banner (NoSpaceLeft, Cheerful).',
    screens: ['popups'],
    sprite: { name: 'PausePopup', drawn: [886, 1113] },
    fields: [
      {
        type: 'variant',
        label: 'Stile',
        path: 'popup.style',
        variants: [
          { id: 'original', label: 'Originale' },
          { id: 'dark', label: 'Scuro' },
          { id: 'light', label: 'Chiaro' },
          { id: 'neon', label: 'Neon' },
        ],
      },
      { type: 'color', label: 'Colore accento', path: 'popup.c1', original: '#4259B5' },
    ],
  },

  // --------------------------------------------------------------- TESTI ---
  {
    id: 'logo',
    category: 'testi',
    label: 'Logo',
    description:
      'Il logo in home. Puoi usare l\'arte originale (Sprite2 841×892) o ricrearlo con testo, font, gradiente e bordo.',
    screens: ['home'],
    sprite: { name: 'Sprite2', drawn: [837, 888] },
    fields: [
      {
        type: 'variant',
        label: 'Modalità',
        path: 'logo.style',
        variants: [
          { id: 'original', label: 'Arte originale' },
          { id: 'text', label: 'Testo personalizzato' },
        ],
      },
      { type: 'image', label: 'Immagine logo 1:1', path: 'logo.img', hint: 'PNG con trasparenza dallo screenshot — sostituisce testo e arte originale' },
      { type: 'text', label: 'Testo', path: 'logo.text' },
      { type: 'font', label: 'Font', path: 'logo.font' },
      { type: 'toggle', label: 'Gradiente', path: 'logo.gradient' },
      { type: 'color', label: 'Colore 1', path: 'logo.c1' },
      { type: 'color', label: 'Colore 2', path: 'logo.c2' },
      { type: 'color', label: 'Colore bordo', path: 'logo.stroke' },
      { type: 'slider', label: 'Spessore bordo', path: 'logo.strokeWidth', min: 0, max: 30, unit: 'px' },
      { type: 'slider', label: 'Ombra', path: 'logo.shadow', min: 0, max: 100, unit: '%' },
      { type: 'slider', label: 'Dimensione', path: 'logo.size', min: 40, max: 140, unit: '%' },
    ],
  },
  {
    id: 'score',
    category: 'testi',
    label: 'Punteggio',
    description:
      'Il punteggio in alto. Originale: cifre bitmap 92×128 (font sprite del gioco).',
    screens: ['game'],
    sprite: { name: 'txtScore', drawn: [120, 128] },
    fields: [
      {
        type: 'variant',
        label: 'Modalità',
        path: 'score.style',
        variants: [
          { id: 'bitmap', label: 'Cifre originali' },
          { id: 'css', label: 'Testo + font' },
        ],
      },
      { type: 'font', label: 'Font', path: 'score.font' },
      { type: 'color', label: 'Colore', path: 'score.color', original: '#FFFFFF' },
      { type: 'toggle', label: 'Gradiente', path: 'score.gradient' },
      { type: 'color', label: 'Colore 2 gradiente', path: 'score.c2' },
      { type: 'color', label: 'Colore bordo', path: 'score.stroke' },
      { type: 'slider', label: 'Spessore bordo', path: 'score.strokeWidth', min: 0, max: 24, unit: 'px' },
      { type: 'slider', label: 'Dimensione', path: 'score.size', min: 50, max: 150, unit: '%' },
    ],
  },
  {
    id: 'best',
    category: 'testi',
    label: 'Record',
    description: 'Il testo del record in alto a sinistra, accanto alla coppa.',
    screens: ['game'],
    sprite: { name: 'txtBestScore', drawn: [300, 60] },
    fields: [
      { type: 'font', label: 'Font', path: 'best.font' },
      { type: 'color', label: 'Colore', path: 'best.color', original: '#BFC9EE' },
      { type: 'slider', label: 'Dimensione', path: 'best.size', min: 50, max: 150, unit: '%' },
      { type: 'image', label: 'Icona 1:1 (corona)', path: 'best.iconImg', hint: 'PNG con trasparenza — sostituisce la coppa originale' },
    ],
  },
  {
    id: 'plus100',
    category: 'testi',
    label: '+100 guadagno',
    description:
      'Il popup dei punti guadagnati ad ogni riga completata (txtEarnedScore + glow nell\'originale).',
    screens: ['game'],
    sprite: { name: 'txtEarnedScore', drawn: [180, 128] },
    fields: [
      {
        type: 'variant',
        label: 'Stile',
        path: 'plus100.style',
        variants: [
          { id: 'bitmap', label: 'Cifre originali' },
          { id: 'classic', label: 'Classico' },
          { id: 'neon', label: 'Neon' },
          { id: 'candy', label: 'Caramella' },
          { id: 'pixel', label: 'Pixel' },
        ],
      },
      { type: 'color', label: 'Colore', path: 'plus100.color', original: '#FFFFFF' },
      { type: 'color', label: 'Colore bagliore', path: 'plus100.glow', original: '#FFE066' },
      { type: 'slider', label: 'Dimensione', path: 'plus100.size', min: 50, max: 200, unit: '%' },
    ],
  },
  {
    id: 'combo',
    category: 'testi',
    label: 'Combo',
    description:
      'Il contatore combo (txtComboNum 700×400, 2 righe da 5 cifre) con il suo bagliore.',
    screens: ['game'],
    sprite: { name: 'txtComboNum', drawn: [280, 160] },
    fields: [
      { type: 'font', label: 'Font', path: 'combo.font' },
      { type: 'color', label: 'Colore', path: 'combo.color', original: '#FFFFFF' },
      { type: 'color', label: 'Colore bagliore', path: 'combo.glow', original: '#FF9F1C' },
      { type: 'slider', label: 'Dimensione', path: 'combo.size', min: 50, max: 200, unit: '%' },
    ],
  },

  // --------------------------------------------------------------- ICONE ---
  {
    id: 'cupIcon',
    category: 'icone',
    label: 'Coppa',
    description: 'La coppa del record accanto al punteggio migliore.',
    screens: ['game', 'popups'],
    sprite: { name: 'CupIcon', drawn: [104, 104] },
    fields: [],
  },
  {
    id: 'heartIcon',
    category: 'icone',
    label: 'Cuore combo',
    description:
      'Il cuore che pulsa dietro il punteggio quando la combo è attiva ( Heart 304×304, disegnato 240×240).',
    screens: ['game'],
    sprite: { name: 'Heart', drawn: [240, 240] },
    fields: [],
  },
  {
    id: 'handIcon',
    category: 'icone',
    label: 'Mano tutorial',
    description: 'La mano che guida il tutorial nei primi passi di gioco.',
    screens: [],
    sprite: { name: 'Hand', drawn: [228, 186] },
    fields: [],
  },
  {
    id: 'spotIcon',
    category: 'icone',
    label: 'Cella evidenziata',
    description:
      'Lo spot che illumina le celle durante il tutorial (Spot 120×120).',
    screens: [],
    sprite: { name: 'Spot', drawn: [120, 120] },
    fields: [],
  },

  // ------------------------------------------------------------- EFFETTI ---
  {
    id: 'effects',
    category: 'effetti',
    label: 'Effetti righe & combo',
    description:
      'Lampeggio delle righe completate, particelle, scossa dello schermo e bagliore combo.',
    screens: ['game'],
    sprite: { name: 'Particles', drawn: [80, 80] },
    fields: [
      { type: 'color', label: 'Colore lampo', path: 'effects.flashColor', original: '#FFFFFF' },
      {
        type: 'variant',
        label: 'Particelle',
        path: 'effects.particles',
        variants: [
          { id: 'original', label: 'Originali' },
          { id: 'confetti', label: 'Confetti' },
          { id: 'rings', label: 'Anelli' },
          { id: 'none', label: 'Nessuna' },
        ],
      },
      { type: 'slider', label: 'Scossa schermo', path: 'effects.shake', min: 0, max: 100, unit: '%' },
      { type: 'color', label: 'Bagliore combo', path: 'effects.comboGlow', original: '#FFC94D' },
    ],
  },

  // --------------------------------------------------------------- SUONI ---
  {
    id: 'sounds',
    category: 'suoni',
    label: 'Suoni & musica',
    description:
      'Assegna un file audio (o un effetto sintetizzato) a ogni evento di gioco, con pitch e volume. Volumi originali: musica 56%, cheer 32%.',
    screens: ['home', 'game', 'popups'],
    fields: [
      { type: 'soundEvents' },
      { type: 'slider', label: 'Volume effetti', path: 'sounds.sfxVol', min: 0, max: 100, unit: '%' },
      { type: 'slider', label: 'Volume musica', path: 'sounds.musicVol', min: 0, max: 100, unit: '%' },
      { type: 'soundLibrary' },
    ],
  },
];

export function elementById(id: string | null): ElementDef | undefined {
  if (!id) return undefined;
  return ELEMENTS.find((e) => e.id === id);
}

export function elementsOfCategory(cat: CategoryId): ElementDef[] {
  return ELEMENTS.filter((e) => e.category === cat);
}

export { fontOptions };
