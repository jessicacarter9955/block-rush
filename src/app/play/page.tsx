'use client';

// /play — Block Blast come app vera: si parte dalla HOME (logo, PLAY, icone),
// si gioca a schermo intero con drag & drop, e c'è il selettore versioni con
// "Block Rush 1:1" al primo posto (LA replica pixel perfect del gioco dalle
// immagini dell'utente — l'unica versione che interessa). Include il BOT
// JavaScript: gioca da solo cercando sempre il punteggio più alto, simula il
// giocatore (prende il pezzo e lo trascina sulla griglia, come il bot Python)
// e ha uno slider per accelerare/rallentare il ritmo. C'è anche il RECORDER:
// registra ESATTAMENTE l'area di gioco (crop pixel-perfect 1080×1920, senza
// pannelli) e scarica il video pronto per YouTube/TikTok.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, ChevronLeft, CircleDot, Download, EyeOff, Film, Gauge,
  ListVideo, Maximize, Play, Trophy, X, Zap,
} from 'lucide-react';
import {
  BackgroundView, IconButtonView, LogoView, PlayButtonView, pos,
} from '@/components/game/Kit';
import { PlayGame } from '@/components/game/PlayGame';
import { useStudio } from '@/lib/store';
import { PRESETS, fontCss } from '@/lib/skin';
import { soundEngine } from '@/lib/audio';
import { BlockBlastBot, DEFAULT_MILESTONES, type BotEvent, type BotStats } from '@/lib/bot';

type View = 'list' | 'app';

const VERSION_KEY = 'bb-play-version';
const RANKING: { name: string; score: number }[] = [
  { name: 'Kara', score: 1720 },
  { name: 'Camila', score: 1586 },
  { name: 'Philip', score: 1520 },
  { name: 'Gianni', score: 1378 },
  { name: 'Lya', score: 1250 },
  { name: 'Ava', score: 1232 },
  { name: 'Royce', score: 650 },
  { name: 'Logan', score: 580 },
  { name: 'Alexis', score: 200 },
];

function waitGameApi(timeoutMs = 5000): Promise<boolean> {
  return new Promise((res) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if ((window as unknown as Record<string, unknown>).__BB__) {
        clearInterval(iv);
        res(true);
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(iv);
        res(false);
      }
    }, 80);
  });
}

export default function PlayPage() {
  const skin = useStudio((s) => s.skin);
  const playing = useStudio((s) => s.playing);
  const setPlaying = useStudio((s) => s.setPlaying);
  const applyPreset = useStudio((s) => s.applyPreset);

  const areaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>('app');
  const [versionId, setVersionId] = useState<string>('rush');
  const [scale, setScale] = useState(0.3);
  const [tall, setTall] = useState(true);

  // bot ui state
  const botRef = useRef<BlockBlastBot | null>(null);
  const [botOn, setBotOn] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [reached, setReached] = useState<number[]>([]);
  const [panelHidden, setPanelHidden] = useState(false);
  const [clean, setClean] = useState(false);
  const [autoRestart, setAutoRestart] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);

  // recorder state (video marketing: crop 1080×1920 dell'area di gioco)
  const wrapRef = useRef<HTMLDivElement>(null);
  const [recOn, setRecOn] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [recInfo, setRecInfo] = useState<{ url: string; name: string; size: number; dur: number; mime: string } | null>(null);
  const [recErr, setRecErr] = useState<string | null>(null);
  const [recAudio, setRecAudio] = useState(true);
  const recStopRef = useRef<(() => void) | null>(null);

  const pushLog = useCallback((s: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString('it-IT', { hour12: false })} · ${s}`, ...l].slice(0, 30));
  }, []);

  // ------------------------------------------------------- init & params --
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('clean') === '1') setClean(true);
    if (q.get('list') === '1') setView('list');
    const vq = q.get('version');
    const saved = localStorage.getItem(VERSION_KEY);
    const v = vq && PRESETS.some((p) => p.id === vq)
      ? vq
      : saved && PRESETS.some((p) => p.id === saved) ? saved : 'rush';
    setVersionId(v);
    applyPreset(v, 'all');
    const sp = q.get('speed');
    if (sp) setSpeed(Math.max(0.25, Math.min(16, parseFloat(sp) || 1)));
  }, []);

  // fit the 1080×1920 design to the viewport
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth, h = window.innerHeight;
      setScale(Math.min(w / 1080, h / 1920));
      setTall(h / w > 1.45);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ------------------------------------------------------------ bot init --
  useEffect(() => {
    const bot = new BlockBlastBot({
      speed,
      milestones: DEFAULT_MILESTONES,
      autoRestart,
      onEvent: (e: BotEvent) => {
        if (e.type === 'start') {
          pushLog('bot avviato');
        } else if (e.type === 'stop') {
          pushLog(`bot fermo (${e.reason}) · record ${e.stats.best}`);
        } else if (e.type === 'move') {
          setStats(e.stats);
        } else if (e.type === 'milestone') {
          pushLog(`MILESTONE ${e.value.toLocaleString('it-IT')} superato!`);
          setReached((r) => (r.includes(e.value) ? r : [...r, e.value]));
        } else if (e.type === 'info') {
          pushLog(e.message);
        }
      },
    });
    botRef.current = bot;
    return () => bot.stop();
  }, []);

  useEffect(() => { botRef.current?.setSpeed(speed); }, [speed]);
  useEffect(() => {
    const b = botRef.current;
    if (b) (b as unknown as { autoRestart: boolean }).autoRestart = autoRestart;
  }, [autoRestart]);

  // auto-start via ?bot=1 (used for clean recordings)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('bot') !== '1' || playing) return;
    const t = setTimeout(async () => {
      setPlaying(true);
      if (await waitGameApi()) {
        await new Promise((r) => setTimeout(r, 400));
        const b = botRef.current;
        if (b && !b.isRunning()) {
          setBotOn(true);
          void b.start();
        }
      }
    }, 600);
    return () => clearTimeout(t);
  }, [playing]);

  // stop the bot when leaving the game screen
  useEffect(() => {
    if (!playing && botRef.current?.isRunning()) {
      botRef.current.stop();
      setBotOn(false);
    }
  }, [playing]);

  // ------------------------------------------------------------- actions --
  const pickVersion = (id: string) => {
    setVersionId(id);
    localStorage.setItem(VERSION_KEY, id);
    applyPreset(id, 'all');
    setView('app');
    pushLog(`versione: ${PRESETS.find((p) => p.id === id)?.name ?? id}`);
  };

  const toggleBot = async () => {
    const b = botRef.current;
    if (!b) return;
    if (b.isRunning()) {
      b.stop();
      setBotOn(false);
    } else {
      if (!playing) {
        setPlaying(true);
        await waitGameApi();
        await new Promise((r) => setTimeout(r, 350));
      }
      setBotOn(true);
      void b.start();
    }
  };

  // -------------------------------------------------------- recorder ------
  // Registra ESATTAMENTE l'area di gioco (crop pixel-perfect dell'elemento
  // 1080×1920) ricampionando la condivisione scheda su un canvas: il video
  // scaricato è già 9:16 pronto per YouTube Shorts / TikTok, senza pannelli.
  const startRec = useCallback(async () => {
    setRecErr(null);
    setRecInfo(null);
    setRecTime(0);
    try {
      const md = navigator.mediaDevices;
      if (!md || !md.getDisplayMedia) {
        throw new Error('Il browser non supporta la registrazione dello schermo: usa Chrome o Edge su desktop.');
      }
      const opts = {
        video: { frameRate: 30 },
        audio: recAudio,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
        systemAudio: 'exclude',
      } as unknown as MediaStreamConstraints;
      const disp = await md.getDisplayMedia(opts);

      const designEl = areaRef.current;
      if (!designEl) throw new Error('Area di gioco non trovata.');

      // superficie condivisa → <video> nascosto
      const video = document.createElement('video');
      video.srcObject = new MediaStream(disp.getVideoTracks());
      video.muted = true;
      video.playsInline = true;
      await video.play();
      if (!video.videoWidth) {
        await new Promise<void>((res) => {
          const on = () => { video.removeEventListener('loadedmetadata', on); res(); };
          if (video.readyState >= 1) { video.removeEventListener('loadedmetadata', on); res(); }
          else video.addEventListener('loadedmetadata', on);
        });
      }

      // canvas 1080×1920: ricampiona solo il rettangolo del gioco
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D non disponibile.');
      const draw = () => {
        const rect = designEl.getBoundingClientRect();
        const k = (video.videoWidth || 1) / Math.max(1, window.innerWidth);
        ctx.drawImage(video, rect.left * k, rect.top * k, rect.width * k, rect.height * k, 0, 0, 1080, 1920);
      };
      draw();
      let pumpOn = true;
      const pump = () => {
        if (!pumpOn) return;
        draw();
        const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
        if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(pump);
        else requestAnimationFrame(pump);
      };
      pump();

      // stream misto: video dal canvas + audio della scheda (se concesso)
      const mixed = canvas.captureStream(30);
      for (const t of disp.getAudioTracks()) mixed.addTrack(t);
      const mimeCandidates = [
        'video/mp4;codecs="avc1.640028,mp4a.40.2"',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(mixed, mime ? { mimeType: mime, videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 128_000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

      const t0 = performance.now();
      const timer = window.setInterval(() => setRecTime((performance.now() - t0) / 1000), 250);
      const stamp = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const ext = mime?.includes('mp4') ? 'mp4' : 'webm';
      const name = `block-rush-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.${ext}`;

      rec.onstop = () => {
        pumpOn = false;
        window.clearInterval(timer);
        const dur = (performance.now() - t0) / 1000;
        const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecInfo({ url, name, size: blob.size, dur, mime: rec.mimeType || mime || 'video/webm' });
        setRecOn(false);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        disp.getTracks().forEach((t) => t.stop());
        pushLog(`video registrato: ${name} (${(blob.size / 1048576).toFixed(1)} MB)`);
      };
      // "Interrompi condivisione" del browser → chiude anche la registrazione
      disp.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (rec.state !== 'inactive') rec.stop();
      });

      rec.start(1000);
      setRecOn(true);
      recStopRef.current = () => { if (rec.state !== 'inactive') rec.stop(); };
      pushLog('registrazione avviata · 1080×1920 · 30fps');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/permission|denied|abort|cancel|notallowed/i.test(msg)) {
        setRecErr('Permesso negato: scegli «Questa scheda» nella finestra di condivisione e premi Condividi.');
      } else {
        setRecErr(msg);
      }
      setRecOn(false);
    }
  }, [recAudio, pushLog]);

  const stopRec = useCallback(() => { recStopRef.current?.(); }, []);

  // scorciatoia R = registra / ferma (utile a schermo intero, quando il pannello non si vede)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (recOn) stopRec();
        else void startRec();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recOn, startRec, stopRec]);

  // ferma la registrazione se si lascia la pagina
  useEffect(() => () => { recStopRef.current?.(); }, []);

  const version = useMemo(() => PRESETS.find((p) => p.id === versionId), [versionId]);

  // slider (0..100) ↔ speed (0.25..16, log2)
  const sliderToSpeed = (v: number) => Math.round(0.25 * Math.pow(2, (v / 100) * 6) * 100) / 100;
  const speedToSlider = (s: number) => Math.round((Math.log2(s / 0.25) / 6) * 100);

  const startGame = () => {
    soundEngine.playEvent(skin.sounds.button);
    setPlaying(true);
  };

  // ---------------------------------------------------------------- view --
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      {/* design space 1080×1920 */}
      <div
        ref={wrapRef}
        style={{
          width: 1080 * scale, height: 1920 * scale,
          borderRadius: tall ? 0 : Math.min(36, 36 * scale * 2),
          overflow: 'hidden', position: 'relative',
          boxShadow: tall ? undefined : '0 30px 90px rgba(0,0,0,0.7)',
        }}
      >
        <div
          ref={areaRef}
          data-bb-design="1"
          style={{
            width: 1080, height: 1920,
            transform: `scale(${scale})`, transformOrigin: 'top left',
            position: 'absolute', top: 0, left: 0, background: '#101528',
            overflow: 'hidden',
          }}
        >
          {view === 'list' ? (
            <VersionList current={versionId} onPick={pickVersion} onBack={() => setView('app')} />
          ) : playing ? (
            <PlayGame areaRef={areaRef} />
          ) : (
            <HomeScreen
              onPlay={startGame}
              musicOn={musicOn}
              sfxOn={sfxOn}
              onMusic={() => {
                const next = !musicOn;
                setMusicOn(next);
                if (next) void soundEngine.startMusic(skin.sounds.music);
                else soundEngine.stopMusic();
                soundEngine.playEvent(skin.sounds.button);
              }}
              onSfx={() => {
                const next = !sfxOn;
                setSfxOn(next);
                soundEngine.setVolumes(next ? skin.sounds.sfxVol : 0, musicOn ? skin.sounds.musicVol : 0);
              }}
              onRanking={() => { setRankOpen(true); soundEngine.playEvent(skin.sounds.button); }}
              rankOpen={rankOpen}
              closeRanking={() => setRankOpen(false)}
            />
          )}
        </div>
      </div>

      {/* floating chrome (hidden with ?clean=1) */}
      {!clean && (
        <>
          {/* top-left: back to list + fullscreen */}
          <div className="absolute left-3 top-3 z-40 flex gap-1.5">
            {view === 'app' && (
              <button
                onClick={() => setView('list')}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[12px] font-bold text-white/85 backdrop-blur transition hover:bg-black/75"
              >
                <ListVideo size={14} />
                <span className="hidden sm:inline">Versioni</span>
              </button>
            )}
            <button
              onClick={() => {
                const el = wrapRef.current;
                if (!el) return;
                if (document.fullscreenElement) void document.exitFullscreen();
                else void el.requestFullscreen?.();
              }}
              title="Schermo intero (per registrare a tutto schermo)"
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[12px] font-bold text-white/85 backdrop-blur transition hover:bg-black/75"
            >
              <Maximize size={14} />
              <span className="hidden sm:inline">Schermo intero</span>
            </button>
          </div>

          {/* bot panel */}
          <div className="absolute right-3 top-3 z-40 w-[264px]">
            {panelHidden ? (
              <button
                onClick={() => setPanelHidden(false)}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[12px] font-bold text-white/85 backdrop-blur"
              >
                <Bot size={14} className="text-amber-400" /> Bot
              </button>
            ) : (
              <div className="rounded-2xl border border-white/12 bg-zinc-950/85 p-3 text-white shadow-2xl backdrop-blur-md">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${botOn ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                  <span className="flex-1 text-[12px] font-bold tracking-wide">
                    BOT · {version?.name ?? 'Block Rush 1:1'}
                  </span>
                  <button onClick={() => setPanelHidden(true)} className="text-white/40 hover:text-white">
                    <EyeOff size={14} />
                  </button>
                </div>

                <button
                  onClick={() => void toggleBot()}
                  className={`mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-extrabold transition ${
                    botOn
                      ? 'bg-red-500/90 text-white hover:bg-red-500'
                      : 'bg-emerald-500/90 text-zinc-950 hover:bg-emerald-400'
                  }`}
                >
                  {botOn ? <Square14 /> : <Play size={14} />}
                  {botOn ? 'FERMA IL BOT' : 'FALLO GIOCARE'}
                </button>

                <div className="mb-1 flex items-center gap-2 text-[11px] text-white/60">
                  <Gauge size={12} />
                  <span className="flex-1">Velocità del posizionamento</span>
                  <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 font-bold text-amber-300">
                    {speed < 1 ? speed.toFixed(2) : speed.toFixed(speed % 1 ? 1 : 0)}×
                  </span>
                </div>
                <input
                  type="range" min={0} max={100} step={1}
                  value={speedToSlider(speed)}
                  onChange={(e) => setSpeed(sliderToSpeed(parseInt(e.target.value, 10)))}
                  className="mb-2 w-full accent-amber-400"
                />
                <div className="mb-3 flex justify-between text-[10px] text-white/35">
                  <span>0.25× lento</span><span>1× umano</span><span>16× turbo</span>
                </div>

                {/* RECORDER — video pronti per YouTube / TikTok */}
                <div className="mb-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-2.5">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-white/70">
                    <Film size={12} className="text-rose-400" />
                    <span className="flex-1">RECORDER · 1080×1920 · 30fps</span>
                    {recOn && (
                      <span className="flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-300">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
                        {fmtTime(recTime)}
                      </span>
                    )}
                  </div>

                  {!recOn ? (
                    <>
                      <button
                        onClick={() => void startRec()}
                        className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500/90 py-2.5 text-[13px] font-extrabold text-white transition hover:bg-rose-500"
                      >
                        <CircleDot size={14} />
                        REGISTRA IL GIOCO
                      </button>
                      <label className="mb-1.5 flex cursor-pointer items-center gap-2 text-[10.5px] text-white/60">
                        <input
                          type="checkbox" checked={recAudio}
                          onChange={(e) => setRecAudio(e.target.checked)}
                          className="accent-rose-400"
                        />
                        Includi l&apos;audio del gioco
                      </label>
                      <p className="text-[9.5px] leading-relaxed text-white/40">
                        Alla richiesta del browser scegli <b className="text-white/60">«Questa scheda»</b>:
                        il video viene ritagliato sull&apos;area di gioco (senza pannelli) e scaricato
                        automaticamente in 9:16. Scorciatoia <b className="text-white/60">R</b> = start/stop
                        (funziona anche a schermo intero). Con <b className="text-white/60">?clean=1</b> l&apos;interfaccia è già pulita.
                      </p>
                    </>
                  ) : (
                    <button
                      onClick={stopRec}
                      className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-[13px] font-extrabold text-zinc-900 transition hover:bg-white"
                    >
                      <Square14 />
                      FERMA REGISTRAZIONE
                    </button>
                  )}

                  {recInfo && (
                    <div className="mt-1 rounded-lg bg-black/40 p-2">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] text-emerald-300">
                        <Download size={11} />
                        <span className="flex-1 truncate font-bold">{recInfo.name}</span>
                        <button
                          onClick={() => setRecInfo(null)}
                          className="text-white/35 hover:text-white"
                          title="Chiudi"
                        >
                          <X size={11} />
                        </button>
                      </div>
                      <video src={recInfo.url} controls className="mb-1.5 w-full rounded-md" style={{ maxHeight: 220 }} />
                      <div className="text-[9.5px] text-white/45">
                        {fmtTime(recInfo.dur)} · {fmtBytes(recInfo.size)} · {recInfo.mime.split(';')[0]} · già scaricato nella cartella Download
                      </div>
                    </div>
                  )}
                  {recErr && <p className="mt-1 text-[10px] leading-relaxed text-rose-300">{recErr}</p>}
                </div>

                {stats && (
                  <div className="mb-2 grid grid-cols-4 gap-1 text-center">
                    {([
                      ['MOSSE', stats.moves],
                      ['PUNTI', stats.score],
                      ['RIGHE', stats.totalLines],
                      ['RECORD', stats.best],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-white/5 py-1.5">
                        <div className="text-[9px] text-white/45">{label}</div>
                        <div className="text-[13px] font-extrabold tabular-nums">{value}</div>
                      </div>
                    ))}
                  </div>
                )}
                {stats?.lastMove && (
                  <div className="mb-2 truncate rounded-lg bg-white/5 px-2 py-1 text-[10.5px] text-white/70">
                    {stats.lastMove}
                  </div>
                )}

                <div className="mb-2 flex flex-wrap gap-1">
                  {DEFAULT_MILESTONES.map((m) => (
                    <span
                      key={m}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        reached.includes(m) ? 'bg-amber-400/90 text-zinc-950' : 'bg-white/10 text-white/40'
                      }`}
                    >
                      {m.toLocaleString('it-IT')}
                    </span>
                  ))}
                </div>

                <label className="mb-2 flex cursor-pointer items-center gap-2 text-[11px] text-white/60">
                  <input
                    type="checkbox" checked={autoRestart}
                    onChange={(e) => setAutoRestart(e.target.checked)}
                    className="accent-amber-400"
                  />
                  Rigioca automaticamente al game over
                </label>

                <div className="bb-scroll max-h-24 overflow-y-auto rounded-lg bg-black/40 p-1.5 font-mono text-[9.5px] leading-relaxed text-white/50">
                  {log.length === 0 ? (
                    <span className="text-white/30">
                      Il bot prende il pezzo dal vassoio e lo trascina sulla griglia, come un
                      giocatore in carne e ossa. Regola la velocità con lo slider.
                    </span>
                  ) : log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Square14() {
  return <span className="block h-3 w-3 rounded-[3px] bg-white" />;
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtBytes(b: number) {
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

// ------------------------------------------------------------- subviews --

function HomeScreen({
  onPlay, musicOn, sfxOn, onMusic, onSfx, onRanking, rankOpen, closeRanking,
}: {
  onPlay: () => void;
  musicOn: boolean; sfxOn: boolean;
  onMusic: () => void; onSfx: () => void; onRanking: () => void;
  rankOpen: boolean; closeRanking: () => void;
}) {
  const skin = useStudio((s) => s.skin);
  const iconSize = skin.iconBtn.size ?? 170;
  const logoY = skin.logo.y ?? 532;
  const playY = skin.playBtn.y ?? 1295;
  const rowY = skin.iconBtn.rowY ?? 1770;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <BackgroundView skin={skin} variant="home" />

      {/* logo */}
      <div style={pos(540.5, logoY, 837, 888)}>
        <LogoView skin={skin} />
      </div>

      {/* play */}
      <div style={pos(540, playY, 625, 216)}>
        <PlayButtonView skin={skin} onClick={onPlay} />
      </div>

      {/* bottom icon row (original geometry: sfx 175 · ranking 540 · music 906 @1770) */}
      <div style={{ position: 'absolute', left: 0, top: rowY - 85, width: 1080, height: 170 }}>
        <div style={{ ...pos(175, 85, 170, 170) }}>
          <IconButtonView skin={skin} kind="sfx" size={iconSize} group="home" on={sfxOn} onClick={onSfx} />
        </div>
        <div style={{ ...pos(540, 85, 170, 170) }}>
          <IconButtonView skin={skin} kind="ranking" size={iconSize} group="home" onClick={onRanking} />
        </div>
        <div style={{ ...pos(906, 85, 170, 170) }}>
          <IconButtonView skin={skin} kind="music" size={iconSize} group="home" on={musicOn} onClick={onMusic} />
        </div>
      </div>

      {rankOpen && <RankingPopup onClose={closeRanking} />}
    </div>
  );
}

function RankingPopup({ onClose }: { onClose: () => void }) {
  const skin = useStudio((s) => s.skin);
  const rows: { name: string; score: number; you?: boolean }[] = [
    ...RANKING.slice(0, 8),
    { name: 'Tu', score: 0, you: true },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,5,16,0.62)', zIndex: 50 }}>
      <div style={pos(540, 960, 920, 1214)}>
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: 40,
            background: `linear-gradient(180deg, ${skin.popup.c1}, rgba(10,4,22,0.97))`,
            border: '5px solid rgba(255,255,255,0.18)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          }}
        />
        <div style={{ ...pos(899, 424, 80, 80) }}>
          <IconButtonView skin={skin} kind="close" size={80} group="game" onClick={onClose} />
        </div>
        <div
          style={{
            ...pos(540, 520, 800, 120), ...fontCss('riffic', 72),
            color: '#FFFFFF', textAlign: 'center', letterSpacing: '0.08em',
            textShadow: '0 0 24px rgba(255,215,0,0.5)',
          }}
        >
          CLASSIFICA
        </div>
        <div style={{ position: 'absolute', left: 90, right: 90, top: 640, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {rows.map((r, i) => (
            <div
              key={r.name}
              style={{
                display: 'flex', alignItems: 'center', gap: 28,
                padding: '18px 34px', borderRadius: 26,
                background: r.you ? 'rgba(255,201,77,0.16)' : 'rgba(255,255,255,0.06)',
                border: r.you ? '4px solid rgba(255,201,77,0.65)' : '3px solid rgba(255,255,255,0.10)',
              }}
            >
              <span style={{ ...fontCss('riffic', 46), color: i < 3 ? '#FFD700' : 'rgba(255,255,255,0.55)', width: 80 }}>
                {i + 1}
              </span>
              <span style={{ ...fontCss('riffic', 46), color: '#FFFFFF', flex: 1 }}>{r.name}</span>
              <span style={{ ...fontCss('riffic', 46), color: '#FFD700' }}>{r.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VersionList({
  current, onPick, onBack,
}: {
  current: string;
  onPick: (id: string) => void;
  onBack: () => void;
}) {
  const skin = useStudio((s) => s.skin);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <BackgroundView skin={skin} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,2,14,0.72)' }} />

      <div style={{ position: 'absolute', left: 60, right: 60, top: 100, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          onClick={onBack}
          style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ChevronLeft size={52} color="#FFF" />
        </div>
        <span style={{ ...fontCss('riffic', 64), color: '#FFFFFF', letterSpacing: '0.06em' }}>
          SCEGLI LA VERSIONE
        </span>
      </div>

      <div
        className="bb-scroll"
        style={{ position: 'absolute', left: 60, right: 60, top: 260, bottom: 80, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 26, paddingRight: 12 }}
      >
        {PRESETS.map((p) => {
          const active = p.id === current;
          const is1to1 = p.id === 'rush';
          return (
            <div
              key={p.id}
              onClick={() => onPick(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 30, padding: '26px 34px',
                borderRadius: 32, cursor: 'pointer',
                background: active ? 'rgba(255,201,77,0.14)' : 'rgba(255,255,255,0.055)',
                border: active ? '5px solid rgba(255,201,77,0.7)' : '4px solid rgba(255,255,255,0.10)',
              }}
            >
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {p.swatch.map((c) => (
                  <div key={c} style={{ width: 34, height: 92, borderRadius: 10, background: c, border: '2px solid rgba(255,255,255,0.25)' }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ ...fontCss('riffic', 44), color: '#FFFFFF' }}>{p.name}</span>
                  {is1to1 && (
                    <span
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 18px', borderRadius: 999,
                        background: 'linear-gradient(90deg, #FFD700, #FFA000)',
                      }}
                    >
                      <span style={{ ...fontCss('riffic', 24), color: '#3A2400', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={22} color="#3A2400" />
                        1:1 PIXEL PERFECT
                      </span>
                    </span>
                  )}
                </div>
                <span style={{ ...fontCss('carlito', 26), color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>
                  {p.desc}
                </span>
              </div>
              {active && <Trophy size={48} color="#FFD700" style={{ flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
