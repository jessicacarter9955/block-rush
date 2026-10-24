import { createServer } from 'node:http';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, rename, stat, unlink } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { spawn, spawnSync } from 'node:child_process';
import { WebSocketServer } from 'ws';
import { PublisherQueue } from './core.mjs';
import { ParallelRecorder } from './parallel.mjs';
import { exportLayout } from './formats.mjs';

export function trustedRequest(request, origin) {
  return request.headers.host === new URL(origin).host &&
    (!request.headers.origin || request.headers.origin === origin) &&
    !['cross-site', 'same-site'].includes(request.headers['sec-fetch-site']);
}

export async function createPublisher({ directory, config = {}, key, root, port = 8765, convert } = {}) {
  const origin = `http://127.0.0.1:${port}`;
  const token = randomBytes(32).toString('hex');
  const queue = new PublisherQueue(directory, config, { key, convert });
  await queue.init();
  const parallel = new ParallelRecorder(queue, origin);
  let encoder = null, liveSocket = null, liveState = 'idle';
  let liveStartedAt = null, liveBytes = 0, lastChunkAt = null, telemetry = null;
  const startedAt = Date.now();
  const streamUrl = process.env.PUBLISHER_RTMP_URL;
  if (streamUrl && !['rtmp:', 'rtmps:'].includes(new URL(streamUrl).protocol)) throw new Error('PUBLISHER_RTMP_URL must use RTMP or RTMPS');
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const ffmpegReady = spawnSync(ffmpeg, ['-version'], { windowsHide: true, stdio: 'ignore' }).status === 0;
  let accepting = true;
  const json = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  };
  const server = createServer(async (req, res) => {
    if (!trustedRequest(req, origin)) return json(res, 403, { error: 'Open the publisher on its loopback address.' });
    try {
      const url = new URL(req.url, origin);
      if (url.pathname === '/api/publisher/status' && req.method === 'GET') {
        const filter = url.searchParams.get('filter') || 'all';
        const search = (url.searchParams.get('q') || '').toLowerCase();
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 50));
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
        const filtered = queue.jobs.filter(j => (filter === 'all' || (filter === 'held' ? j.held : j.state === filter)) && `${j.title} ${j.id}`.toLowerCase().includes(search)).reverse();
        return json(res, 200, {
          token, mode: queue.config.mode, ffmpeg: ffmpegReady, postiz: Boolean(queue.key),
          channels: queue.config.channels.map(c => {
            const remote = queue.remote.channels.find(remote => remote.id === c.id);
            return { id: c.id, provider: c.settings.__type, visibility: c.settings.type, format: c.format, framing: c.framing || 'safe', verified: Boolean(remote), ...remote };
          }),
          liveConfigured: Boolean(streamUrl), liveState,
          live: { startedAt: liveStartedAt, bytes: liveBytes, lastChunkAt },
          worker: { paused: queue.paused, running: queue.running, startedAt, now: Date.now() },
          telemetry, stats: queue.summary(), remote: { checkedAt: queue.remote.checkedAt, error: queue.remote.error, syncing: queue.syncing },
          intervalMinutes: queue.config.intervalMinutes, matched: filtered.length,
          parallel: parallel.info,
          jobs: filtered.slice(offset, offset + limit).map(({ id, title, state, held, recordingFailed, error, createdAt, updatedAt, scheduledAt, submittedAt, duration, outputBytes, preparedAt, receipts, destinations, history, lastCheckedAt, exports }) =>
            ({ id, title, state, held, recordingFailed, error, createdAt, updatedAt, scheduledAt, submittedAt, duration, outputBytes, preparedAt, receipts, destinations, history, lastCheckedAt, exports })),
        });
      }
      if (url.pathname.startsWith('/api/publisher/')) {
        if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { error: 'Refresh the publisher session.' });
        const exportMatch = /^\/api\/publisher\/exports\/([a-f0-9-]{36})$/.exec(url.pathname);
        if (req.method === 'POST' && exportMatch) {
          if (!ffmpegReady) return json(res, 503, { error: 'FFmpeg is required for social exports' });
          try { return json(res, 202, { output: await queue.requestExport(exportMatch[1], url.searchParams.get('format'), url.searchParams.get('framing') || 'safe') }); }
          catch (error) { return json(res, 409, { error: error.message }); }
        }
        if (req.method === 'POST' && url.pathname === '/api/publisher/parallel/start') {
          if (!ffmpegReady) return json(res, 503, { error: 'FFmpeg is required for parallel video output' });
          try {
            const batch = await parallel.start({ count: Number(url.searchParams.get('count') || 10), seconds: Number(url.searchParams.get('seconds') || 60), speed: Number(url.searchParams.get('speed') || 4) });
            return json(res, 202, { batch });
          } catch (error) { return json(res, 409, { error: error.message }); }
        }
        if (req.method === 'POST' && url.pathname === '/api/publisher/parallel/stop') { parallel.stop(); return json(res, 200, { stopping: true }); }
        if (req.method === 'POST' && url.pathname === '/api/publisher/sync') {
          try { await queue.sync(); return json(res, 200, { synced: true }); }
          catch (error) { return json(res, 409, { error: error.message }); }
        }
        if (req.method === 'POST' && /^\/api\/publisher\/worker\/(pause|resume)$/.test(url.pathname)) {
          await queue.setPaused(url.pathname.endsWith('/pause'));
          json(res, 200, { paused: queue.paused });
          if (!queue.paused) void queue.process().catch(() => {});
          return;
        }
        const action = /^\/api\/publisher\/jobs\/([a-f0-9-]{36})\/(retry|hold|release)$/.exec(url.pathname);
        if (req.method === 'POST' && action) {
          try { await queue.act(action[1], action[2]); json(res, 200, { ok: true }); void queue.process().catch(() => {}); }
          catch (error) { json(res, 409, { error: error.message }); }
          return;
        }
        if (req.method === 'POST' && url.pathname === '/api/publisher/telemetry') {
          let size = 0; const chunks = [];
          for await (const chunk of req) { size += chunk.length; if (size > 4096) throw new Error('Telemetry is too large'); chunks.push(chunk); }
          const value = JSON.parse(Buffer.concat(chunks).toString());
          const numeric = key => Number.isFinite(value[key]) ? Math.max(0, value[key]) : 0;
          telemetry = { at: Date.now(), botRunning: value.botRunning === true, speed: numeric('speed'), score: numeric('score'), moves: numeric('moves'), lines: numeric('lines'),
            capture: ['batch', 'live'].includes(value.capture) ? value.capture : null, elapsed: numeric('elapsed'), clips: numeric('clips') };
          return json(res, 200, { ok: true });
        }
        if (url.pathname === '/api/publisher/clip' && req.method === 'POST') {
          if (!accepting) return json(res, 409, { error: 'Another clip is being received.' });
          if (!ffmpegReady) return json(res, 503, { error: 'Install FFmpeg before recording.' });
          const id = url.searchParams.get('id');
          if (!/^[a-f0-9-]{36}$/.test(id || '')) return json(res, 400, { error: 'Invalid recording id' });
          if (queue.jobs.some(job => job.id === id)) return json(res, 200, { id, duplicate: true });
          const type = req.headers['content-type'] || '';
          const suffix = type.startsWith('video/mp4') ? 'mp4' : type.startsWith('video/webm') ? 'webm' : null;
          if (!suffix) return json(res, 415, { error: 'Send an MP4 or WebM recording.' });
          accepting = false;
          const temp = join(directory, `${id}.part`);
          try {
            let size = 0; const hash = createHash('sha256');
            const limit = new Transform({ transform(chunk, encoding, next) {
              size += chunk.length;
              if (size > 256 * 1024 * 1024) return next(new Error('Clip exceeds 256 MiB'));
              hash.update(chunk); next(null, chunk);
            } });
            await pipeline(req, limit, createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
            if (size === 0) throw new Error('Empty recording');
            const source = `${id}.source.${suffix}`;
            await rename(temp, join(directory, source));
            const duration = Number(url.searchParams.get('duration'));
            const added = await queue.add({ id, source, hash: hash.digest('hex'), title: `BlockRush · ${new Date().toISOString()} · ${queue.jobs.length + 1}`,
              ...(Number.isFinite(duration) && duration > 0 && duration < 86400 ? { duration } : {}) });
            if (!added) await unlink(join(directory, source));
            json(res, 202, { id, duplicate: !added });
            void queue.process().catch(() => {});
          } finally { accepting = true; await unlink(temp).catch(() => {}); }
          return;
        }
        const match = /^\/api\/publisher\/download\/([a-f0-9-]{36})$/.exec(url.pathname);
        if (match && req.method === 'GET') {
          const job = queue.jobs.find(j => j.id === match[1]);
          if (!job) return json(res, 404, { error: 'Recording not found' });
          const formatId = url.searchParams.get('format');
          let suffix = '';
          if (formatId) {
            const layout = exportLayout(formatId, url.searchParams.get('framing') || 'safe');
            if (job.exports?.[layout.key]?.state !== 'ready') return json(res, 409, { error: 'Render this social format before downloading' });
            suffix = `.${layout.key}`;
          }
          const path = join(directory, `${job.id}${suffix}.mp4`);
          const info = await stat(path);
          res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': info.size, 'Content-Disposition': `attachment; filename="blockrush-${job.id}${suffix}.mp4"` });
          createReadStream(path).pipe(res); return;
        }
        return json(res, 404, { error: 'Unknown publisher command' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
      let path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      if (path !== root && !path.startsWith(root + sep)) return json(res, 403, { error: 'Invalid path' });
      let info = await stat(path);
      if (info.isDirectory()) { path = join(path, 'index.html'); info = await stat(path); }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
      res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Content-Length': info.size, 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') res.end(); else createReadStream(path).pipe(res);
    } catch (error) { if (!res.headersSent) json(res, error.code === 'ENOENT' ? 404 : 400, { error: error.code === 'ENOENT' ? 'Run npm run publisher:build first.' : 'Publisher request failed. Check the local configuration and recording.' }); else res.end(); }
  });
  const ws = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, origin);
    if (!trustedRequest(req, origin) || req.headers.origin !== origin || url.pathname !== '/api/publisher/live' || url.searchParams.get('token') !== token || !streamUrl || !ffmpegReady || liveSocket) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    ws.handleUpgrade(req, socket, head, connection => ws.emit('connection', connection));
  });
  ws.on('connection', socket => {
    liveSocket = socket; liveState = 'connecting';
    liveStartedAt = Date.now(); liveBytes = 0; lastChunkAt = null;
    const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
      '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', '-b:v', '5000k', '-maxrate', '5000k', '-bufsize', '10000k',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-f', 'flv', streamUrl],
    { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
    encoder = child;
    child.once('spawn', () => { liveState = 'encoding'; socket.send(JSON.stringify({ ready: true })); });
    child.stdin.on('error', () => socket.close(1011, 'Encoder stopped'));
    child.once('error', () => { liveState = 'failed'; socket.close(1011, 'Encoder unavailable'); });
    child.once('exit', code => {
      liveState = code === 0 ? 'idle' : 'failed';
      if (encoder === child) encoder = null;
      if (liveSocket === socket) liveSocket = null;
      socket.close(code === 0 ? 1000 : 1011, 'Encoder ended');
    });
    socket.on('message', (chunk, binary) => {
      if (!binary) return socket.close(1003, 'Video chunks only');
      if (child.stdin.destroyed || child.stdin.writableEnded) return;
      liveBytes += chunk.length; lastChunkAt = Date.now();
      if (!child.stdin.write(chunk)) { socket.pause(); child.stdin.once('drain', () => socket.resume()); }
    });
    socket.on('error', () => socket.close());
    socket.once('close', () => { child.stdin.end(); const timer = setTimeout(() => child.kill(), 10_000); timer.unref(); child.once('exit', () => clearTimeout(timer)); });
  });
  let lastSyncAttempt = 0;
  const timer = setInterval(() => {
    void queue.process().catch(() => {});
    if (queue.key && queue.config.postizBaseUrl && !queue.syncing && Date.now() - lastSyncAttempt > 60_000) {
      lastSyncAttempt = Date.now(); void queue.sync().catch(() => {});
    }
  }, 10_000);
  timer.unref();
  server.once('close', () => { clearInterval(timer); parallel.stop(); liveSocket?.terminate(); encoder?.kill(); ws.close(); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  void queue.process().catch(() => {});
  return { server, queue, origin };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = fileURLToPath(new URL('.', import.meta.url));
  let config = {};
  try { config = JSON.parse(await readFile(join(base, 'config.local.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const { origin } = await createPublisher({ directory: join(base, 'data'), config, root: resolve(base, '../out') });
  console.log(`BlockRush publisher: ${origin}/play/?bot=1&speed=4&publisher=1`);
  console.log('Channel credentials and RTMP keys stay in the local worker. See docs/AUTO-PUBLISHING.md.');
}
