// Playgama Bridge — un solo SDK per pubblicare il gioco su 20+ piattaforme
// web (YouTube Playables, CrazyGames, Poki, Telegram, TikTok, ...).
//
// Il bridge viene caricato dalla CDN ufficiale (scarica SOLO l'adattatore
// della piattaforma corrente) e inizializzato col config in
// public/playgama-bridge-config.json. Fuori dalle piattaforme (preview su
// GitHub Pages, dev locale) ogni chiamata degrada in modo sicuro: nessun
// annuncio, il gioco continua a funzionare.

'use client';

import { BP } from './bp';
import { soundEngine } from './audio';

/** Esito di un annuncio rewarded, allineato a lib/hint-reward.ts. */
export type AdOutcome = 'completed' | 'cancelled' | 'unavailable';

/** Stati interni del modulo advertisement (specchio di REWARDED_STATE). */
const REWARDED = {
  LOADING: 'loading', OPENED: 'opened', CLOSED: 'closed',
  FAILED: 'failed', REWARDED: 'rewarded',
} as const;

const INTERSTITIAL = {
  LOADING: 'loading', OPENED: 'opened', CLOSED: 'closed', FAILED: 'failed',
} as const;

const CDN_SRC = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';
const CONFIG_PATH = `${BP}/playgama-bridge-config.json`;

// -- tipi minimi del bridge (il pacchetto completo è @playgama/bridge) -----
interface BridgeAdvertisement {
  isRewardedSupported: boolean;
  isInterstitialSupported: boolean;
  rewardedState: string;
  interstitialState: string;
  preloadRewarded(placement?: string | null): void;
  showRewarded(placement?: string | null): void;
  preloadInterstitial(placement?: string | null): void;
  showInterstitial(placement?: string | null): void;
  on(event: string, cb: (...args: unknown[]) => void): void;
  off(event: string, cb?: (...args: unknown[]) => void): void;
}

interface PlaygamaBridgeLike {
  isInitialized: boolean;
  platform: { id: string };
  advertisement: BridgeAdvertisement;
  initialize(options?: { configFilePath?: string }): Promise<void>;
}

declare global {
  interface Window { bridge?: PlaygamaBridgeLike }
}

// -- caricamento + inizializzazione (una sola volta per pagina) -----------

let scriptPromise: Promise<void> | null = null;
let initPromise: Promise<PlaygamaBridgeLike | null> | null = null;

function loadBridgeScript(): Promise<void> {
  if (window.bridge) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CDN_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Playgama bridge CDN non raggiungibile'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Inizializza il bridge; risolve null se la CDN/config non è raggiungibile. */
export function initPlaygama(): Promise<PlaygamaBridgeLike | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await loadBridgeScript();
      const bridge = window.bridge;
      if (!bridge) return null;
      if (!bridge.isInitialized) {
        await bridge.initialize({ configFilePath: CONFIG_PATH });
      }
      return bridge;
    } catch (err) {
      // Silenzioso: fuori rete o con estensioni che bloccano la CDN il gioco
      // resta giocabile al 100% senza annunci.
      console.warn('[playgama] init saltata:', err);
      return null;
    }
  })();
  return initPromise;
}

/** True se siamo dentro una piattaforma della rete Playgama (non standalone). */
export function isPlaygamaPlatform(): boolean {
  const id = window.bridge?.platform?.id;
  return !!id && id !== 'standalone' && id !== 'mock';
}

/** True se un rewarded è pronto all'uso (piattaforma supporta + non occupato). */
export function isRewardedReady(): boolean {
  const ad = window.bridge?.advertisement;
  if (!ad || !ad.isRewardedSupported) return false;
  return ad.rewardedState !== REWARDED.LOADING && ad.rewardedState !== REWARDED.OPENED;
}

// -- audio durante gli annunci ---------------------------------------------

let musicWasPlaying = false;

function duckAudioOn(): void {
  // La musica di gioco deve tacere mentre l'annuncio è a schermo.
  try {
    musicWasPlaying = soundEngine.isMusicPlaying();
    if (musicWasPlaying) soundEngine.stopMusic();
  } catch { /* audio non ancora avviato */ }
}

function duckAudioOff(): void {
  try {
    if (musicWasPlaying) soundEngine.resumeMusicIfEnabled();
  } catch { /* noop */ }
}

// -- rewarded ---------------------------------------------------------------

/**
 * Mostra un annuncio rewarded e risolve quando è finito.
 * - 'completed': annuncio visto intero → dai la ricompensa
 * - 'cancelled' : chiuso prima della fine o fallito → niente ricompensa
 * - 'unavailable': piattaforma senza rewarded / bridge assente
 */
export async function showRewardedAd(placement = 'hint'): Promise<AdOutcome> {
  const bridge = await initPlaygama();
  const ad = bridge?.advertisement;
  if (!bridge || !ad || !ad.isRewardedSupported) return 'unavailable';
  if (ad.rewardedState === REWARDED.LOADING || ad.rewardedState === REWARDED.OPENED) return 'unavailable';

  return new Promise<AdOutcome>((resolve) => {
    let rewarded = false;
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const finish = (outcome: AdOutcome) => {
      if (settled) return;
      settled = true;
      if (watchdog) clearTimeout(watchdog);
      ad.off('rewarded_state_changed', onState);
      duckAudioOff();
      resolve(outcome);
    };
    const onState = (...args: unknown[]) => {
      const state = String(args[0] ?? ad.rewardedState);
      if (state === REWARDED.REWARDED) rewarded = true;
      else if (state === REWARDED.OPENED) duckAudioOn();
      else if (state === REWARDED.CLOSED) finish(rewarded ? 'completed' : 'cancelled');
      else if (state === REWARDED.FAILED) finish(rewarded ? 'completed' : 'cancelled');
    };
    ad.on('rewarded_state_changed', onState);
    // Rete lenta: se dopo 30s non è successo nulla, scongella il gioco.
    watchdog = setTimeout(() => finish('unavailable'), 30_000);
    ad.showRewarded(placement);
  });
}

// -- interstitial -----------------------------------------------------------

/**
 * Mostra un interstitial (fuori dal gameplay, p.es. tra una run e l'altra).
 * L'SDK applica da solo il minimumDelayBetweenInterstitial del config.
 * Risolve true se l'annuncio è stato mostrato e chiuso.
 */
export async function showInterstitialAd(placement = 'game_over'): Promise<boolean> {
  const bridge = await initPlaygama();
  const ad = bridge?.advertisement;
  if (!bridge || !ad || !ad.isInterstitialSupported) return false;
  if (ad.interstitialState === INTERSTITIAL.LOADING || ad.interstitialState === INTERSTITIAL.OPENED) return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      if (watchdog) clearTimeout(watchdog);
      ad.off('interstitial_state_changed', onState);
      duckAudioOff();
      resolve(shown);
    };
    const onState = (...args: unknown[]) => {
      const state = String(args[0] ?? ad.interstitialState);
      if (state === INTERSTITIAL.OPENED) duckAudioOn();
      else if (state === INTERSTITIAL.CLOSED) finish(true);
      else if (state === INTERSTITIAL.FAILED) finish(false);
    };
    ad.on('interstitial_state_changed', onState);
    watchdog = setTimeout(() => finish(false), 30_000);
    ad.showInterstitial(placement);
  });
}
