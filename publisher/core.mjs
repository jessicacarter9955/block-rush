import { spawn } from 'node:child_process';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export function validateConfig(input = {}) {
  const config = { mode: 'local', intervalMinutes: 180, channels: [], ...input };
  if (!['local', 'draft', 'schedule'].includes(config.mode)) throw new Error('mode must be local, draft or schedule');
  if (!Number.isFinite(config.intervalMinutes) || config.intervalMinutes < 1) throw new Error('intervalMinutes must be at least 1');
  if (!Array.isArray(config.channels)) throw new Error('channels must be an array');
  const ids = new Set();
  for (const channel of config.channels) {
    if (!channel.id || ids.has(channel.id) || !channel.settings?.__type) throw new Error('Each channel needs a unique id and provider settings');
    ids.add(channel.id);
    if (channel.settings.__type === 'youtube' && !['public', 'unlisted', 'private'].includes(channel.settings.type)) throw new Error('Set YouTube visibility explicitly');
  }
  if (config.mode !== 'local') {
    if (!config.channels.length) throw new Error('Connect at least one channel before enabling publishing');
    const url = new URL(config.postizBaseUrl);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Use HTTPS for a remote Postiz instance');
    if (url.username || url.password) throw new Error('Keep credentials in POSTIZ_API_KEY');
  }
  return config;
}

export function makePost(config, job, media, now = Date.now()) {
  return {
    type: config.mode,
    date: new Date(Math.max(now + 60_000, job.scheduledAt)).toISOString(),
    shortLink: false, tags: [],
    posts: config.channels.map(channel => ({
      integration: { id: channel.id },
      value: [{ content: config.description || job.title, image: [{ id: media.id, path: media.path }] }],
      settings: { ...channel.settings, ...(channel.settings.__type === 'youtube' ? { title: job.title.slice(0, 100) } : {}) },
    })),
  };
}

export async function atomicJson(path, value) {
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

export async function postizRequest(base, key, path, options = {}, request = fetch) {
  const response = await request(`${base.replace(/\/$/, '')}${path}`, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(180_000),
    headers: { ...options.headers, Authorization: key },
  });
  if (!response.ok) throw new Error(`Postiz ${path}: HTTP ${response.status}. Check the Postiz dashboard before retrying.`);
  return response.json();
}

export function runFfmpeg(args, executable = process.env.FFMPEG_PATH || 'ffmpeg') {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-hide_banner', '-loglevel', 'error', ...args], { windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('FFmpeg timed out')); }, 600_000);
    child.once('error', () => { clearTimeout(timer); reject(new Error('FFmpeg is unavailable. Install it and restart the worker.')); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('FFmpeg conversion failed')); });
  });
}

export class PublisherQueue {
  constructor(directory, config, { key = process.env.POSTIZ_API_KEY, request = fetch, convert = runFfmpeg } = {}) {
    this.directory = directory; this.config = validateConfig(config); this.key = key;
    this.request = request; this.convert = convert; this.jobs = []; this.running = false; this.persistence = Promise.resolve();
  }
  async init() {
    await mkdir(this.directory, { recursive: true });
    try { this.jobs = JSON.parse(await readFile(join(this.directory, 'queue.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const job of this.jobs) {
      if (job.state === 'sending') { job.state = 'unknown'; job.error = 'Worker restarted during submission. Check Postiz; do not automatically resubmit.'; }
      if (job.state === 'converting') job.state = 'captured';
    }
    await this.save();
  }
  save() {
    const snapshot = structuredClone(this.jobs);
    this.persistence = this.persistence.then(() => atomicJson(join(this.directory, 'queue.json'), snapshot));
    return this.persistence;
  }
  async add(job) {
    if (this.jobs.some(existing => existing.id === job.id || (job.hash && existing.hash === job.hash))) return false;
    const lastSlot = this.jobs.reduce((latest, existing) => Math.max(latest, existing.scheduledAt || 0), 0);
    job.scheduledAt = Math.max(Date.now() + 60_000, lastSlot + this.config.intervalMinutes * 60_000);
    job.state = 'captured'; this.jobs.push(job); await this.save(); return true;
  }
  async process() {
    if (this.running) return;
    this.running = true;
    try {
      for (const job of this.jobs) {
        if (!['captured', 'ready'].includes(job.state)) continue;
        try {
          const output = join(this.directory, `${job.id}.mp4`);
          if (job.state === 'captured') {
            job.state = 'converting'; await this.save();
            await this.convert(['-y', '-i', join(this.directory, job.source), '-map', '0:v:0', '-map', '0:a:0?',
              '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
              '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '30',
              '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output]);
            job.state = 'ready'; await this.save();
          }
          if (this.config.mode === 'local' || !this.key) continue;
          const form = new FormData();
          form.set('file', new Blob([await readFile(output)], { type: 'video/mp4' }), `${job.id}.mp4`);
          form.set('adjust', 'false');
          const media = await postizRequest(this.config.postizBaseUrl, this.key, '/upload', { method: 'POST', body: form }, this.request);
          if (!media.id || !media.path) throw new Error('Postiz returned invalid media metadata');
          // Persist intent before creating the post. A lost HTTP response must
          // never automatically create duplicate posts on the next startup.
          job.state = 'sending'; await this.save();
          const result = await postizRequest(this.config.postizBaseUrl, this.key, '/posts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(makePost(this.config, job, media)),
          }, this.request);
          job.receipts = result; job.state = this.config.mode === 'draft' ? 'draft' : 'scheduled';
        } catch (error) {
          job.state = job.state === 'sending' ? 'unknown' : 'failed';
          job.error = error.message;
        }
        await this.save();
      }
    } finally { this.running = false; }
  }
}
