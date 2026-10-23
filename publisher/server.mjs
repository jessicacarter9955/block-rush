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
  let encoder = null, liveSocket = null, liveState = 'idle';
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
        return json(res, 200, {
          token, mode: queue.config.mode, ffmpeg: ffmpegReady, postiz: Boolean(queue.key),
          channels: queue.config.channels.map(c => ({ id: c.id, provider: c.settings.__type })),
          liveConfigured: Boolean(streamUrl), liveState,
          jobs: queue.jobs.slice(-50).reverse().map(({ id, title, state, error, scheduledAt, receipts }) => ({ id, title, state, error, scheduledAt, receipts })),
        });
      }
      if (url.pathname.startsWith('/api/publisher/')) {
        if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { error: 'Refresh the publisher session.' });
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
            const added = await queue.add({ id, source, hash: hash.digest('hex'), title: `BlockRush · ${new Date().toISOString()} · ${queue.jobs.length + 1}` });
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
          const path = join(directory, `${job.id}.mp4`);
          const info = await stat(path);
          res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': info.size, 'Content-Disposition': `attachment; filename="blockrush-${job.id}.mp4"` });
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
      if (!child.stdin.write(chunk)) { socket.pause(); child.stdin.once('drain', () => socket.resume()); }
    });
    socket.on('error', () => socket.close());
    socket.once('close', () => { child.stdin.end(); const timer = setTimeout(() => child.kill(), 10_000); timer.unref(); child.once('exit', () => clearTimeout(timer)); });
  });
  const timer = setInterval(() => { void queue.process().catch(() => {}); }, 10_000);
  timer.unref();
  server.once('close', () => { clearInterval(timer); liveSocket?.terminate(); encoder?.kill(); ws.close(); });
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
