export function cropCoordinates(rect, viewport, source) {
  if ([rect.width, rect.height, viewport.width, viewport.height, source.width, source.height].some(v => !Number.isFinite(v) || v <= 0)) {
    throw new Error('Dimensioni di acquisizione non valide.');
  }
  if (rect.left < -0.5 || rect.top < -0.5 || rect.left + rect.width > viewport.width + 0.5 || rect.top + rect.height > viewport.height + 0.5) {
    throw new Error('Mantieni tutta l’anteprima visibile sullo schermo. Riduci lo zoom della pagina se necessario.');
  }
  return { x: Math.max(0, rect.left) * source.width / viewport.width,
    y: Math.max(0, rect.top) * source.height / viewport.height,
    width: rect.width * source.width / viewport.width, height: rect.height * source.height / viewport.height };
}

export function recordingMime(isSupported) {
  return ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(type => isSupported(type));
}

const RESOLUTIONS = Object.freeze({
  'instagram-reels':{width:1080,height:1920,layout:'portrait'},
  'youtube-shorts':{width:1080,height:1920,layout:'portrait'},
  tiktok:{width:1080,height:1920,layout:'portrait'},
  snapchat:{width:1080,height:1920,layout:'portrait'},
  douyin:{width:1080,height:1920,layout:'portrait'},
  'instagram-feed':{width:1080,height:1350,layout:'portrait'},
  square:{width:1080,height:1080,layout:'square'},
  'youtube-landscape':{width:1920,height:1080,layout:'landscape'},
  bilibili:{width:1920,height:1080,layout:'landscape'},
  'gameplay-portrait-fhd':{width:1080,height:1920,layout:'portrait'},
  'gameplay-portrait-4k':{width:2160,height:3840,layout:'portrait'},
  'gameplay-landscape-fhd':{width:1920,height:1080,layout:'landscape'},
  'gameplay-landscape-4k':{width:3840,height:2160,layout:'landscape'},
  'gameplay-ultrawide':{width:3440,height:1440,layout:'landscape'},
  'gameplay-square':{width:2048,height:2048,layout:'square'},
});

export function resolutionForQuality(id) {
  return Object.hasOwn(RESOLUTIONS, id) ? RESOLUTIONS[id] : RESOLUTIONS['gameplay-portrait-fhd'];
}

export function reelFilename(platform, mime, now = new Date(), quality = 'gameplay-portrait-fhd') {
  if (!['instagram-reels', 'youtube-shorts', 'tiktok', 'snapchat', 'douyin', 'instagram-feed', 'square', 'youtube-landscape', 'bilibili'].includes(platform)) throw new Error('Destinazione non valida');
  const suffix = quality === 'gameplay-portrait-fhd' || quality === platform ? '' : `-${quality.replace(/[^a-z0-9-]/g, '')}`;
  return `blockrush-${platform}${suffix}-${now.toISOString().replace(/[:.]/g, '-')}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
}

function init() {
  const $ = id => document.getElementById(id);
  const game = $('game'), preview = $('preview'), record = $('record'), stop = $('stop'), restart = $('restart');
  const platform = $('platform'), seconds = $('seconds'), speed = $('speed'), quality = $('quality');
  const status = $('status'), result = $('result'), resultVideo = $('resultVideo'), download = $('download');
  let ready = false, capturing = false, session = null, resultUrl = null, gameOverSince = 0;

  const say = (message, state = 'idle') => { status.textContent = message; status.dataset.state = state; };
  const ui = () => {
    record.disabled = !ready || capturing;
    stop.disabled = !capturing;
    restart.disabled = capturing;
    speed.disabled = capturing;
    platform.disabled = capturing;
    quality.disabled = capturing;
    seconds.disabled = capturing;
  };
  const requestedQuality = new URLSearchParams(location.search).get('quality');
  quality.value = requestedQuality && Object.hasOwn(RESOLUTIONS, requestedQuality) ? requestedQuality : platform.value;
  const applyQuality = () => {
    const selected = resolutionForQuality(quality.value);
    preview.dataset.layout = selected.layout;
    preview.style.aspectRatio = `${selected.width}/${selected.height}`;
    $('aspectLabel').textContent = `${selected.width}×${selected.height} · ${selected.layout === 'landscape' ? 'gameplay wide' : 'gameplay completo'}`;
  };
  const reloadGame = () => {
    gameOverSince = 0;
    ready = false; ui();
    if (!capturing) say('Riavvio del bot…');
    const params = new URLSearchParams({ bot: '1', speed: speed.value, clean: '1', restart: '1' });
    if (resolutionForQuality(quality.value).layout === 'landscape') params.set('layout', 'landscape');
    params.set('run', String(Date.now()));
    game.src = `../play/?${params}`;
  };
  const resetGame = () => { if (!capturing) reloadGame(); };
  const gameLoaded = () => { ready = true; ui(); say('Bot pronto. Premi «Genera video» per registrare.'); };
  game.addEventListener('load', gameLoaded);
  game.addEventListener('error', () => { ready = false; ui(); say('Impossibile caricare il gioco. Ricarica la pagina.', 'error'); });
  if (game.contentDocument?.readyState === 'complete') gameLoaded();
  restart.addEventListener('click', resetGame);
  speed.addEventListener('change', resetGame);
  platform.addEventListener('change', () => { if (!capturing) { quality.value=platform.value; applyQuality(); reloadGame(); } });
  quality.addEventListener('change', () => { if (!capturing) { applyQuality(); reloadGame(); } });
  applyQuality();
  // Deep-links to a widescreen preset must reload the initial portrait iframe
  // immediately; selecting a preset from the control does this as well.
  if (resolutionForQuality(quality.value).layout === 'landscape') reloadGame();
  // A game-over overlay can persist when the embedded bot exits unexpectedly.
  // Recover automatically even during a long recording, without needing the
  // hidden in-game controls or a click inside the iframe.
  const watchdog = setInterval(() => {
    try {
      const api = game.contentWindow?.__BB__;
      if (!api?.isGameOver?.()) { gameOverSince = 0; return; }
      if (!gameOverSince) gameOverSince = Date.now();
      if (Date.now() - gameOverSince > 3000) reloadGame();
    } catch { gameOverSince = 0; }
  }, 1000);

  const disposeResult = () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null; resultVideo.removeAttribute('src'); resultVideo.load();
    download.removeAttribute('href'); result.classList.remove('visible');
  };
  const cleanup = current => {
    clearTimeout(current.timeout); clearInterval(current.progress); cancelAnimationFrame(current.raf);
    current.display.getTracks().forEach(track => track.stop());
    current.canvasStream?.getTracks().forEach(track => track.stop());
    current.source?.pause();
    if (current.source) current.source.srcObject = null;
    if (session === current) session = null;
    capturing = false; ui();
  };
  const finish = () => {
    if (!session) return;
    clearTimeout(session.timeout);
    if (session.recorder?.state === 'recording') session.recorder.stop();
    else if (session.recorder?.state !== 'inactive') cleanup(session);
  };
  stop.addEventListener('click', finish);
  window.addEventListener('pagehide', () => {
    clearInterval(watchdog);
    if (session) cleanup(session);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  });

  record.addEventListener('click', async () => {
    if (capturing || !ready) return;
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      say('Per registrare usa Chrome o Edge desktop con HTTPS.', 'error'); return;
    }
    // Keep the entire game inside the captured tab even when the form button
    // is lower on the page. This is synchronous, so it preserves click activation.
    preview.scrollIntoView({ block: 'center', behavior: 'auto' });
    try {
      cropCoordinates(preview.getBoundingClientRect(), { width: innerWidth, height: innerHeight }, { width: innerWidth, height: innerHeight });
    } catch (error) { say(error.message, 'error'); return; }
    disposeResult();
    say('Seleziona «Questa scheda» nella finestra di condivisione…');
    // This must happen directly inside the click's user activation; no awaits before it.
    let display;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false,
        preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' });
    } catch (error) {
      say(error.name === 'NotAllowedError' ? 'Condivisione annullata. Riprova scegliendo «Questa scheda».' : `Condivisione non disponibile: ${error.message}`, 'error');
      return;
    }
    const current = { display, timeout: 0, progress: 0, raf: 0, canvasStream: null, source: null, recorder: null, failed: false };
    session = current; capturing = true; ui();
    try {
      const track = display.getVideoTracks()[0];
      if (!track || (track.getSettings().displaySurface && track.getSettings().displaySurface !== 'browser')) {
        throw new Error('Seleziona una scheda del browser, non una finestra o lo schermo.');
      }
      const source = document.createElement('video');
      source.srcObject = new MediaStream([track]); source.playsInline = true; source.muted = true; current.source = source;
      let startTimer;
      try {
        await Promise.race([source.play(), new Promise((_, reject) => { startTimer = setTimeout(() => reject(new Error('La scheda non ha avviato la condivisione.')), 10000); })]);
      } finally { clearTimeout(startTimer); }
      if (!source.videoWidth || !source.videoHeight) throw new Error('Il video della scheda non è ancora disponibile. Riprova.');
      const dimensions = resolutionForQuality(quality.value);
      const canvas = document.createElement('canvas'); canvas.width = dimensions.width; canvas.height = dimensions.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Registrazione Canvas non disponibile.');
      const draw = () => {
        if (session !== current) return;
        try {
          const rect = cropCoordinates(preview.getBoundingClientRect(), { width: innerWidth, height: innerHeight }, { width: source.videoWidth, height: source.videoHeight });
          ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, dimensions.width, dimensions.height);
          current.raf = requestAnimationFrame(draw);
        } catch (error) { current.failed = true; say(error.message, 'error'); finish(); }
      };
      draw();
      const canvasStream = canvas.captureStream(30); current.canvasStream = canvasStream;
      const mime = recordingMime(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('Il browser non supporta la registrazione video.');
      const media = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: dimensions.width * dimensions.height >= 3840 * 2160 ? 20_000_000 : 10_000_000 });
      current.recorder = media;
      const chunks = [], started = performance.now(), duration = Number(seconds.value);
      media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      media.onerror = () => { current.failed = true; say('Errore nella codifica video. Riprova.', 'error'); finish(); };
      media.onstop = () => {
        cleanup(current);
        if (current.failed) return;
        if (!chunks.length) { say('Il video registrato è vuoto. Riprova.', 'error'); return; }
        const blob = new Blob(chunks, { type: media.mimeType });
        const filename = reelFilename(platform.value, media.mimeType, new Date(), quality.value);
        resultUrl = URL.createObjectURL(blob);
        resultVideo.src = resultUrl; download.href = resultUrl; download.download = filename;
        $('fileInfo').textContent = `${dimensions.width}×${dimensions.height} · ${Math.round(blob.size / 1024)} KB · ${filename.endsWith('.mp4') ? 'MP4' : 'WebM'}`;
        result.classList.add('visible');
        say(filename.endsWith('.mp4') ? 'Video MP4 pronto! Premi «Scarica video».' : 'Video WebM pronto. Per MP4 garantito usa la modalità cloud.', 'ready');
      };
      track.addEventListener('ended', finish, { once: true });
      media.start(500);
      current.progress = setInterval(() => {
        const elapsed = Math.min(duration, (performance.now() - started) / 1000);
        say(`● Registrazione in corso · ${elapsed.toFixed(1)} / ${duration}s`, 'recording');
      }, 200);
      current.timeout = setTimeout(finish, duration * 1000);
      say('● Registrazione in corso…', 'recording');
    } catch (error) { cleanup(current); say(error.message || String(error), 'error'); }
  });
  ui();
}

if (typeof document !== 'undefined') init();
