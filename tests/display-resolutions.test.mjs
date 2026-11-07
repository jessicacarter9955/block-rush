import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { formats, displayFormats, exportLayout } from '../publisher/formats.mjs';
import { createPublisher } from '../publisher/server.mjs';
import { PublisherQueue } from '../publisher/core.mjs';

const targets = [
  ['gameplay-portrait-fhd', 1080, 1920],
  ['gameplay-portrait-4k', 2160, 3840],
  ['gameplay-landscape-fhd', 1920, 1080],
  ['gameplay-landscape-4k', 3840, 2160],
  ['gameplay-ultrawide', 3440, 1440],
  ['gameplay-square', 2048, 2048],
];

test('the six device formats are exact, unique and preserve every gameplay pixel', () => {
  assert.equal(displayFormats.length, 6);
  for (const [id, width, height] of targets) {
    const format = displayFormats.find(item => item.id === id);
    assert.ok(format, id);
    assert.equal(format.width, width);
    assert.equal(format.height, height);
    assert.equal(format.group, 'display');
    assert.ok(formats.includes(format));
    for (const framing of ['fit', 'safe']) {
      const layout = exportLayout(id, framing);
      assert.equal(layout.width, width);
      assert.equal(layout.height, height);
      assert.equal(layout.contentWidth, width);
      assert.equal(layout.contentHeight, height);
      assert.match(layout.filter, /force_original_aspect_ratio=decrease/);
      assert.doesNotMatch(layout.filter, /crop=/);
    }
  }
  assert.equal(new Set(displayFormats.map(item => item.id)).size, 6);
});

test('one authenticated action queues six exports, persists them and serializes encoding', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'blockrush-device-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let running = 0, peak = 0, renders = 0;
  const convert = async args => {
    peak = Math.max(peak, ++running);
    renders++;
    await new Promise(resolve => setTimeout(resolve, 10));
    await writeFile(args.at(-1), String(args[args.indexOf('-vf') + 1]));
    running--;
  };
  const { server, queue, origin } = await createPublisher({ directory, root: directory, port: 18771, config: { mode: 'local' }, convert });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const id = randomUUID();
  await queue.add({ id, source: `${id}.webm`, title: 'Six resolutions', preparedAt: Date.now() }, { state: 'ready' });
  await writeFile(join(directory, `${id}.mp4`), 'original untouched');
  const status = await (await fetch(`${origin}/api/publisher/status`)).json();
  const target = `${origin}/api/publisher/exports/${id}/display-pack`;
  assert.equal((await fetch(target, { method: 'POST' })).status, 401);
  const headers = { Authorization: `Bearer ${status.token}` };
  assert.equal((await fetch(target, { method: 'POST', headers })).status, 202);
  // Repeated clicks should not render duplicates or bypass the queue.
  assert.equal((await fetch(target, { method: 'POST', headers })).status, 202);
  await queue.exportWork;
  assert.equal(peak, 1);
  assert.equal(renders, 6);
  assert.equal(Object.values(queue.jobs[0].exports).filter(output => output.state === 'ready').length, 6);
  for (const [formatId, width, height] of targets) {
    const output = queue.jobs[0].exports[`${formatId}-fit`];
    assert.equal(output.width, width); assert.equal(output.height, height);
    const read = await readFile(join(directory, `${id}.${formatId}-fit.mp4`), 'utf8');
    assert.match(read, new RegExp(`pad=${width}:${height}`));
  }
  assert.equal(await readFile(join(directory, `${id}.mp4`), 'utf8'), 'original untouched');
  const restarted = await readFile(join(directory, 'queue.json'), 'utf8');
  assert.equal(Object.keys(JSON.parse(restarted)[0].exports).length, 6);
  const unauthorized = await fetch(`${origin}/api/publisher/download/${id}?format=gameplay-landscape-fhd&framing=fit`);
  assert.equal(unauthorized.status, 401);
  const video = await fetch(`${origin}/api/publisher/download/${id}?format=gameplay-landscape-fhd&framing=fit`, { headers });
  assert.equal(video.status, 200);
});

test('FFmpeg encodes the six device canvases with exact playback dimensions',
  { skip: process.env.PUBLISHER_FFMPEG_TEST !== '1', timeout: 180_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'blockrush-real-device-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const id = randomUUID();
  const encoder = process.env.FFMPEG_PATH || 'ffmpeg';
  const fixture = spawnSync(encoder, ['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=180x320:r=30',
    '-f','lavfi','-i','sine=frequency=440','-t','0.2','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p',
    join(directory, `${id}.mp4`)], { windowsHide: true });
  assert.equal(fixture.status, 0, fixture.stderr.toString());
  const queue = new PublisherQueue(directory, {});
  await queue.init(); await queue.add({ id, preparedAt: Date.now() }, { state: 'ready' });
  for (const [formatId, width, height] of targets) {
    const output = await queue.prepareExport(id, formatId, 'fit');
    const meta = spawnSync('ffprobe', ['-v','error','-select_streams','v:0','-show_entries','stream=width,height',
      '-of','csv=p=0',output], { windowsHide: true });
    assert.equal(meta.status, 0, meta.stderr.toString());
    assert.equal(meta.stdout.toString().trim(), `${width},${height}`);
  }
});
