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

export function reelFilename(platform, mime, now = new Date()) {
  if (!['instagram-reels', 'youtube-shorts', 'tiktok'].includes(platform)) throw new Error('Destinazione non valida');
  return `blockrush-${platform}-${now.toISOString().replace(/[:.]/g, '-')}.${mime.includes('mp4') ? 'mp4' : 'webm'}`;
}

function init() {
  const $ = id => document.getElementById(id);
  const game = $('game'), preview = $('preview'), record = $('record'), stop = $('stop'), restart = $('restart');
  const platform = $('platform'), seconds = $('seconds'), speed = $('speed');
  const status = $('status'), result = $('result'), resultVideo = $('resultVideo'), download = $('download');
  let ready = false, capturing = false, session = null, resultUrl = null;

  const say = (message, state = 'idle') => { status.textContent = message; status.dataset.state = state; };
  const ui = () => {
    record.disabled = !ready || capturing;
    stop.disabled = !capturing;
    restart.disabled = capturing;
    speed.disabled = capturing;
    platform.disabled = capturing;
    seconds.disabled = capturing;
  };
  const resetGame = () => {
    if (capturing) return;
    ready = false; ui(); say('Riavvio del bot…');
    const params = new URLSearchParams({ bot: '1', speed: speed.value, clean: '1', restart: '1' });
    game.src = `../play/?${params}`;
  };
  const gameLoaded = () => { ready = true; ui(); say('Bot pronto. Premi «Genera video» per registrare.'); };
  game.addEventListener('load', gameLoaded);
  game.addEventListener('error', () => { ready = false; ui(); say('Impossibile caricare il gioco. Ricarica la pagina.', 'error'); });
  if (game.contentDocument?.readyState === 'complete') gameLoaded();
  restart.addEventListener('click', resetGame);
  speed.addEventListener('change', resetGame);

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
      const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Registrazione Canvas non disponibile.');
      const draw = () => {
        if (session !== current) return;
        try {
          const rect = cropCoordinates(preview.getBoundingClientRect(), { width: innerWidth, height: innerHeight }, { width: source.videoWidth, height: source.videoHeight });
          ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, 1080, 1920);
          current.raf = requestAnimationFrame(draw);
        } catch (error) { current.failed = true; say(error.message, 'error'); finish(); }
      };
      draw();
      const canvasStream = canvas.captureStream(30); current.canvasStream = canvasStream;
      const mime = recordingMime(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('Il browser non supporta la registrazione video.');
      const media = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
      current.recorder = media;
      const chunks = [], started = performance.now(), duration = Number(seconds.value);
      media.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      media.onerror = () => { current.failed = true; say('Errore nella codifica video. Riprova.', 'error'); finish(); };
      media.onstop = () => {
        cleanup(current);
        if (current.failed) return;
        if (!chunks.length) { say('Il video registrato è vuoto. Riprova.', 'error'); return; }
        const blob = new Blob(chunks, { type: media.mimeType });
        const filename = reelFilename(platform.value, media.mimeType);
        resultUrl = URL.createObjectURL(blob);
        resultVideo.src = resultUrl; download.href = resultUrl; download.download = filename;
        $('fileInfo').textContent = `${Math.round(blob.size / 1024)} KB · ${filename.endsWith('.mp4') ? 'MP4' : 'WebM'}`;
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
