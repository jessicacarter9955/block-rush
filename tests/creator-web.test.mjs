import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cropCoordinates, recordingMime, reelFilename, resolutionForQuality } from '../public/creator/recorder.mjs';

test('the web creator contains the actual controls and game, not a GitHub-only call to action', async () => {
  const html = await readFile(new URL('../public/creator/index.html', import.meta.url), 'utf8');
  for (const id of ['game', 'preview', 'record', 'stop', 'download', 'resultVideo', 'seconds', 'speed']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /\.\/recorder\.mjs/);
  assert.match(html, /\.\.\/play\/\?bot=1/);
  for (const id of ['quality','aspectLabel']) assert.match(html,new RegExp(`id="${id}"`));
  const platformOptions=html.match(/<select id="platform">([\s\S]*?)<\/select>/)?.[1].match(/<option /g)||[];
  const outputOptions=html.match(/<select id="quality">([\s\S]*?)<\/select>/)?.[1].match(/<option /g)||[];
  assert.equal(platformOptions.length,9,'all nine social destinations must remain available');
  assert.equal(outputOptions.length,15,'nine social exports and six gameplay resolutions');
});

test('the studio has a watchdog to restart a stalled embedded game', async () => {
  const script = await readFile(new URL('../public/creator/recorder.mjs', import.meta.url), 'utf8');
  assert.match(script, /api\?\.isGameOver\?\.\(\)/);
  assert.match(script, /Date\.now\(\) - gameOverSince > 3000/);
  assert.match(script, /if \(Date\.now\(\) - gameOverSince > 3000\) reloadGame\(\)/);
  assert.match(script, /if \(resolutionForQuality\(quality\.value\)\.layout === 'landscape'\) reloadGame\(\)/);
});

test('video cropping maps a fully visible portrait preview to its tab-capture pixels', () => {
  assert.deepEqual(cropCoordinates({ left: 50, top: 100, width: 270, height: 480 },
    { width: 900, height: 700 }, { width: 1800, height: 1400 }),
    { x: 100, y: 200, width: 540, height: 960 });
  assert.throws(() => cropCoordinates({ left: 0, top: 100, width: 270, height: 480 },
    { width: 900, height: 500 }, { width: 1800, height: 1000 }), /visibile/);
});

test('recorder prefers H.264 MP4, falls back to WebM, and labels files truthfully', () => {
  assert.equal(recordingMime(mime => mime.startsWith('video/mp4')), 'video/mp4;codecs=avc1.42E01E');
  assert.equal(recordingMime(mime => mime === 'video/webm'), 'video/webm');
  assert.equal(recordingMime(() => false), undefined);
  const at = new Date('2026-11-06T11:00:00Z');
  assert.equal(reelFilename('tiktok', 'video/mp4', at), 'blockrush-tiktok-2026-11-06T11-00-00-000Z.mp4');
  assert.match(reelFilename('instagram-reels', 'video/webm', at), /\.webm$/);
  assert.throws(() => reelFilename('other', 'video/mp4', at));
});

test('six gameplay aspect presets and landscape channels get correct native export dimensions', () => {
  const expected={
    'instagram-reels':[1080,1920,'portrait'],
    'youtube-shorts':[1080,1920,'portrait'],
    tiktok:[1080,1920,'portrait'],
    snapchat:[1080,1920,'portrait'],
    douyin:[1080,1920,'portrait'],
    'instagram-feed':[1080,1350,'portrait'],
    square:[1080,1080,'square'],
    'gameplay-portrait-fhd':[1080,1920,'portrait'],
    'gameplay-portrait-4k':[2160,3840,'portrait'],
    'gameplay-landscape-fhd':[1920,1080,'landscape'],
    'gameplay-landscape-4k':[3840,2160,'landscape'],
    'gameplay-ultrawide':[3440,1440,'landscape'],
    'gameplay-square':[2048,2048,'square'],
    'youtube-landscape':[1920,1080,'landscape'],
    bilibili:[1920,1080,'landscape'],
  };
  for(const [id,[width,height,layout]] of Object.entries(expected)) {
    assert.deepEqual(resolutionForQuality(id),{width,height,layout});
    const at=new Date('2026-11-06T11:00:00Z');
    if(id!=='gameplay-portrait-fhd'&&id!=='tiktok')assert.match(reelFilename('tiktok','video/mp4',at,id),new RegExp(id));
  }
  assert.deepEqual(resolutionForQuality('toString'),resolutionForQuality('bad'));
});
