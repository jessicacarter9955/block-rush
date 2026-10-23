import { spawn } from 'node:child_process';
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
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
  if (config.mode !== 'local' && !config.channels.length) throw new Error('Connect at least one channel before enabling publishing');
  if (config.mode !== 'local' || config.postizBaseUrl) {
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
    this.paused = false; this.syncing = false; this.remote = { checkedAt: null, error: null, channels: [] };
  }
  async init() {
    await mkdir(this.directory, { recursive: true });
    try { this.jobs = JSON.parse(await readFile(join(this.directory, 'queue.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { this.paused = Boolean(JSON.parse(await readFile(join(this.directory, 'worker.json'), 'utf8')).paused); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const job of this.jobs) {
      if (job.state === 'sending') { job.state = 'unknown'; job.error = 'Worker restarted during submission. Check Postiz; do not automatically resubmit.'; }
      if (job.state === 'converting') job.state = 'captured';
      if (job.state === 'uploading') job.state = 'ready';
    }
    await this.save();
  }
  save() {
    const snapshot = structuredClone(this.jobs);
    this.persistence = this.persistence.then(() => atomicJson(join(this.directory, 'queue.json'), snapshot));
    return this.persistence;
  }
  transition(job, state, note) {
    job.state = state; job.updatedAt = Date.now();
    job.history = [...(job.history || []), { at: job.updatedAt, state, ...(note ? { note } : {}) }].slice(-30);
  }
  async setPaused(paused) {
    this.paused = paused;
    const snapshot = { paused };
    this.persistence = this.persistence.then(() => atomicJson(join(this.directory, 'worker.json'), snapshot));
    await this.persistence;
  }
  async act(id, action) {
    const job = this.jobs.find(item => item.id === id);
    if (!job) throw new Error('Clip not found');
    if (action === 'retry') {
      if (job.state !== 'failed' || job.receipts?.length) throw new Error('Only a local conversion or upload failure can be retried. Reconcile submitted posts in Postiz.');
      delete job.error; this.transition(job, job.preparedAt ? 'ready' : 'captured', 'Retry requested');
    } else if (action === 'hold' || action === 'release') {
      if (!['captured', 'ready', 'failed'].includes(job.state)) throw new Error('This clip has already started processing or was submitted');
      job.held = action === 'hold';
      this.transition(job, job.state, job.held ? 'Clip placed on hold' : 'Clip released');
    } else throw new Error('Unknown clip action');
    await this.save();
  }
  summary() {
    const counts = {};
    for (const job of this.jobs) counts[job.state] = (counts[job.state] || 0) + 1;
    return { total: this.jobs.length, counts, held: this.jobs.filter(j => j.held).length,
      bytes: this.jobs.reduce((sum, j) => sum + (j.outputBytes || 0), 0),
      seconds: this.jobs.reduce((sum, j) => sum + (j.duration || 0), 0),
      active: this.jobs.find(j => ['converting', 'uploading', 'sending'].includes(j.state))?.id || null };
  }
  async sync() {
    if (this.syncing) return;
    if (!this.key || !this.config.postizBaseUrl) throw new Error('Configure Postiz before syncing publication status');
    this.syncing = true;
    try {
      const channels = await postizRequest(this.config.postizBaseUrl, this.key, '/integrations', {}, this.request);
      if (!Array.isArray(channels)) throw new Error('Invalid channel response from Postiz');
      this.remote.channels = channels.filter(c => this.config.channels.some(config => config.id === c.id))
        .map(c => ({ id: c.id, name: c.name, provider: c.identifier, disabled: Boolean(c.disabled) }));
      const jobs = this.jobs.filter(j => Array.isArray(j.receipts) && j.receipts.length);
      if (jobs.length) {
        const dates = jobs.flatMap(j => [j.submittedAt || j.createdAt || j.scheduledAt, j.scheduledAt]).filter(Number.isFinite);
        const query = new URLSearchParams({ startDate: new Date(Math.min(...dates) - 86400000).toISOString(), endDate: new Date(Math.max(Date.now(), ...dates) + 86400000).toISOString() });
        const response = await postizRequest(this.config.postizBaseUrl, this.key, `/posts?${query}`, {}, this.request);
        if (!Array.isArray(response.posts)) throw new Error('Invalid posts response from Postiz');
        const posts = new Map(response.posts.map(p => [p.id, p]));
        for (const job of jobs) {
          job.destinations = job.receipts.map(receipt => {
            const post = posts.get(receipt.postId);
            if (!post || (post.integration?.id && post.integration.id !== receipt.integration)) return { postId: receipt.postId, integration: receipt.integration, state: 'UNVERIFIED' };
            let url;
            try { const link = new URL(post.releaseURL); if (['https:', 'http:'].includes(link.protocol)) url = link.href; } catch {}
            return { postId: receipt.postId, integration: receipt.integration, state: post.state,
              ...(url ? { url } : {}), ...(post.error ? { error: String(post.error).slice(0, 600) } : {}) };
          });
          const states = job.destinations.map(d => d.state);
          const complete = job.receipts.length === (job.targetIds?.length || job.receipts.length);
          const next = complete && states.every(state => state === 'PUBLISHED') ? 'published'
            : states.includes('ERROR') ? 'remote_failed'
            : states.includes('PUBLISHED') ? 'partial'
            : complete && states.every(state => state === 'QUEUE') ? 'scheduled'
            : complete && states.every(state => state === 'DRAFT') ? 'draft'
            : null;
          if (next && next !== job.state) this.transition(job, next, 'Confirmed by Postiz');
          job.lastCheckedAt = Date.now();
        }
        await this.save();
      }
      this.remote.checkedAt = Date.now(); this.remote.error = null;
    } catch (error) { this.remote.error = error.message; throw error; }
    finally { this.syncing = false; }
  }
  async add(job) {
    if (this.jobs.some(existing => existing.id === job.id || (job.hash && existing.hash === job.hash))) return false;
    const lastSlot = this.jobs.reduce((latest, existing) => Math.max(latest, existing.scheduledAt || 0), 0);
    job.scheduledAt = Math.max(Date.now() + 60_000, lastSlot + this.config.intervalMinutes * 60_000);
    job.createdAt = Date.now(); this.transition(job, 'captured'); this.jobs.push(job); await this.save(); return true;
  }
  async process() {
    if (this.running || this.paused) return;
    this.running = true;
    try {
      for (const job of this.jobs) {
        if (this.paused) break;
        if (job.held) continue;
        if (!['captured', 'ready'].includes(job.state)) continue;
        try {
          const output = join(this.directory, `${job.id}.mp4`);
          if (job.state === 'captured') {
            this.transition(job, 'converting'); await this.save();
            await this.convert(['-y', '-i', join(this.directory, job.source), '-map', '0:v:0', '-map', '0:a:0?',
              '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
              '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '30',
              '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output]);
            job.preparedAt = Date.now(); job.outputBytes = (await stat(output)).size;
            this.transition(job, 'ready'); await this.save();
          }
          if (this.paused || job.held || this.config.mode === 'local' || !this.key) continue;
          const form = new FormData();
          form.set('file', new Blob([await readFile(output)], { type: 'video/mp4' }), `${job.id}.mp4`);
          form.set('adjust', 'false');
          this.transition(job, 'uploading'); await this.save();
          const media = await postizRequest(this.config.postizBaseUrl, this.key, '/upload', { method: 'POST', body: form }, this.request);
          if (!media.id || !media.path) throw new Error('Postiz returned invalid media metadata');
          if (this.paused || job.held) { this.transition(job, 'ready', 'Media upload finished; submission paused'); await this.save(); continue; }
          // Persist intent before creating the post. A lost HTTP response must
          // never automatically create duplicate posts on the next startup.
          this.transition(job, 'sending'); job.submittedAt = Date.now(); job.targetIds = this.config.channels.map(c => c.id); await this.save();
          const result = await postizRequest(this.config.postizBaseUrl, this.key, '/posts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(makePost(this.config, job, media)),
          }, this.request);
          if (Array.isArray(result)) job.receipts = result.filter(r => r.postId && this.config.channels.some(c => c.id === r.integration));
          if (!Array.isArray(result) || result.length !== this.config.channels.length || new Set(result.map(r => r.integration)).size !== this.config.channels.length || result.some(r => !r.postId || !this.config.channels.some(c => c.id === r.integration))) throw new Error('Postiz did not return receipts for every configured channel. Reconcile in Postiz.');
          job.receipts = result; this.transition(job, this.config.mode === 'draft' ? 'draft' : 'scheduled');
        } catch (error) {
          this.transition(job, job.state === 'sending' ? 'unknown' : 'failed', error.message);
          job.error = error.message;
        }
        await this.save();
      }
    } finally { this.running = false; }
  }
}
