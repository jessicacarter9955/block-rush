import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { formats, exportLayout } from '../publisher/formats.mjs';
import { PublisherQueue, validateConfig } from '../publisher/core.mjs';
import { createPublisher } from '../publisher/server.mjs';

test('social layouts fit the complete game inside even-sized protected regions', () => {
  for (const format of formats) for (const framing of ['fit','safe']) {
    const layout = exportLayout(format.id, framing);
    assert.ok(layout.x >= 0 && layout.y >= 0);
    assert.ok(layout.x + layout.contentWidth <= format.width);
    assert.ok(layout.y + layout.contentHeight <= format.height);
    assert.equal(layout.contentWidth % 2, 0); assert.equal(layout.contentHeight % 2, 0);
    assert.match(layout.filter, /force_original_aspect_ratio=decrease/);
    assert.doesNotMatch(layout.filter, /crop=/);
  }
  assert.throws(() => exportLayout('../secret', 'safe'));
  assert.throws(() => exportLayout('tiktok', 'crop'));
  assert.throws(() => validateConfig({channels:[{id:'a',format:'unknown',settings:{__type:'youtube',type:'private'}}]}));
});

test('social renders deduplicate requests, persist metadata, and leave the original intact', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'blockrush-social-'));
  t.after(() => rm(directory, { recursive:true, force:true }));
  let renders = 0;
  const queue = new PublisherQueue(directory, {}, { convert:async args => {renders++;await writeFile(args.at(-1),'export');} });
  await queue.init();await queue.add({id:'one',source:'one.webm',preparedAt:1},{state:'ready'});
  await writeFile(join(directory,'one.mp4'),'original');
  await Promise.all([queue.requestExport('one','instagram-feed'),queue.requestExport('one','instagram-feed')]);
  const path = await queue.prepareExport('one','instagram-feed');
  assert.equal(renders,1);assert.equal(await readFile(path,'utf8'),'export');
  assert.equal(await readFile(join(directory,'one.mp4'),'utf8'),'original');
  const restarted = new PublisherQueue(directory, {});await restarted.init();
  assert.equal(restarted.jobs[0].exports['instagram-feed-safe'].state,'ready');
  assert.equal(restarted.jobs[0].exports['instagram-feed-safe'].height,1350);
});

test('each publishing destination receives its selected aspect ratio', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'blockrush-destinations-'));
  t.after(() => rm(directory, { recursive:true, force:true }));
  const uploads = [];let post;
  const config = {mode:'draft',postizBaseUrl:'https://publisher.example/api',channels:[
    {id:'shorts',format:'youtube-shorts',settings:{__type:'youtube',type:'private'}},
    {id:'feed',format:'instagram-feed',settings:{__type:'instagram'}},
    {id:'shorts-2',format:'youtube-shorts',settings:{__type:'youtube',type:'private'}},
  ]};
  const queue = new PublisherQueue(directory, config, {key:'test',convert:async args=>writeFile(args.at(-1),args[args.indexOf('-vf')+1]),request:async(url,options)=>{
    if(url.endsWith('/upload')){uploads.push(await options.body.get('file').text());return {ok:true,json:async()=>({id:`media-${uploads.length}`,path:`https://media.example/${uploads.length}.mp4`})};}
    post=JSON.parse(options.body);return {ok:true,json:async()=>config.channels.map(channel=>({postId:channel.id,integration:channel.id}))};
  }});
  await queue.init();await queue.add({id:'one',source:'one.webm',title:'BlockRush test'});await queue.process();
  assert.equal(queue.jobs[0].state,'draft',queue.jobs[0].error);assert.equal(uploads.length,2);
  assert.match(uploads[0],/pad=1080:1920/);assert.match(uploads[1],/pad=1080:1350/);
  assert.equal(post.posts[0].value[0].image[0].id,'media-1');
  assert.equal(post.posts[1].value[0].image[0].id,'media-2');
  assert.equal(post.posts[2].value[0].image[0].id,'media-1');
});

test('real social exports use target dimensions, keep audio and duration, and authenticate downloads',
  {skip:process.env.PUBLISHER_FFMPEG_TEST!=='1'}, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'blockrush-social-real-'));
  t.after(() => rm(directory,{recursive:true,force:true}));
  const encoder=process.env.FFMPEG_PATH||'ffmpeg';
  const {server,queue,origin}=await createPublisher({directory,root:directory,port:18768,config:{mode:'local'}});
  t.after(async()=>{await queue.exportWork;await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});});
  const id=randomUUID();
  const fixture=spawnSync(encoder,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=180x320:r=30','-f','lavfi','-i','sine=frequency=440','-t','0.5','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p',join(directory,`${id}.mp4`)],{windowsHide:true});
  assert.equal(fixture.status,0,fixture.stderr.toString());
  await queue.add({id,preparedAt:1},{state:'ready'});
  const {token}=await(await fetch(`${origin}/api/publisher/status`)).json();
  const headers={Authorization:`Bearer ${token}`};
  assert.equal((await fetch(`${origin}/api/publisher/exports/${id}?format=tiktok`,{method:'POST'})).status,401);
  assert.equal((await fetch(`${origin}/api/publisher/exports/${id}?format=unknown`,{method:'POST',headers})).status,409);
  for(const formatId of ['youtube-shorts','instagram-feed','square','youtube-landscape']){
    const response=await fetch(`${origin}/api/publisher/exports/${id}?format=${formatId}`,{method:'POST',headers});
    assert.equal(response.status,202);
    const path=await queue.prepareExport(id,formatId);
    const decoded=spawnSync(encoder,['-hide_banner','-i',path,'-f','null','-'],{windowsHide:true});
    assert.equal(decoded.status,0,decoded.stderr.toString());
    const format=formats.find(format=>format.id===formatId);
    assert.match(decoded.stderr.toString(),new RegExp(`${format.width}x${format.height}`));
    assert.match(decoded.stderr.toString(),/Audio: aac/);
    assert.match(decoded.stderr.toString(),/Duration: 00:00:00.5/);
    assert.equal((await fetch(`${origin}/api/publisher/download/${id}?format=${formatId}`)).status,401);
    const download=await fetch(`${origin}/api/publisher/download/${id}?format=${formatId}`,{headers});
    assert.equal(download.status,200);assert.ok((await download.arrayBuffer()).byteLength>1000);
  }
});
