import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { WebSocket } from 'ws';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createPublisher } from '../publisher/server.mjs';

test('real FFmpeg and HTTP: capture, convert, authenticated download, no publishing',
  {skip:process.env.PUBLISHER_FFMPEG_TEST!=='1'},async t=>{
  const directory=await mkdtemp(join(tmpdir(),'blockrush-ffmpeg-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const input=join(directory,'fixture.mp4');
  const encoder=process.env.FFMPEG_PATH||'ffmpeg';
  const generated=spawnSync(encoder,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=180x320:r=30','-t','0.5','-c:v','libx264','-pix_fmt','yuv420p',input],{windowsHide:true});
  assert.equal(generated.status,0,generated.stderr.toString());
  const {server,queue,origin}=await createPublisher({directory,root:directory,port:18765,config:{mode:'local'}});
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const status=await(await fetch(`${origin}/api/publisher/status`)).json();
  assert.equal(status.ffmpeg,true);assert.equal(status.mode,'local');
  const id=randomUUID(),url=`${origin}/api/publisher/clip?id=${id}`;
  const rejected=await fetch(url,{method:'POST'});assert.equal(rejected.status,401);
  const clip=await readFile(input);
  const sent=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${status.token}`,'Content-Type':'video/mp4'},body:clip});
  assert.equal(sent.status,202);
  for(let attempt=0;attempt<100&&!['ready','failed'].includes(queue.jobs[0]?.state);attempt++)await new Promise(resolve=>setTimeout(resolve,100));
  assert.equal(queue.jobs[0].state,'ready',queue.jobs[0].error);
  const repeat=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${status.token}`,'Content-Type':'video/mp4'},body:clip});
  assert.equal((await repeat.json()).duplicate,true);assert.equal(queue.jobs.length,1);
  const downloaded=await fetch(`${origin}/api/publisher/download/${id}`,{headers:{Authorization:`Bearer ${status.token}`}});
  assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('content-type'),'video/mp4');
  assert.ok((await downloaded.arrayBuffer()).byteLength>1000);
  const output=spawnSync(encoder,['-hide_banner','-i',join(directory,`${id}.mp4`),'-f','null','-'],{windowsHide:true});
  assert.equal(output.status,0);assert.match(output.stderr.toString(),/1080x1920/);
});

test('live encoder sends decodable video to a loopback RTMP receiver',
  {skip:process.env.PUBLISHER_FFMPEG_TEST!=='1'},async t=>{
  const directory=await mkdtemp(join(tmpdir(),'blockrush-rtmp-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const encoder=process.env.FFMPEG_PATH||'ffmpeg';
  const input=join(directory,'fixture.webm'),output=join(directory,'received.flv');
  const source=spawnSync(encoder,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=180x320:r=30','-t','1','-c:v','libvpx','-pix_fmt','yuv420p',input],{windowsHide:true});
  assert.equal(source.status,0,source.stderr.toString());
  const url='rtmp://127.0.0.1:19359/live/blockrush-test';
  const receiver=spawn(encoder,['-hide_banner','-loglevel','error','-listen','1','-i',url,'-c','copy','-y',output],{windowsHide:true,stdio:'ignore'});
  const received=new Promise(resolve=>receiver.once('exit',resolve));
  t.after(()=>receiver.kill());
  const previous=process.env.PUBLISHER_RTMP_URL;process.env.PUBLISHER_RTMP_URL=url;
  let publisher;
  try{publisher=await createPublisher({directory,root:directory,port:18766,config:{mode:'local'}});}
  finally{if(previous===undefined)delete process.env.PUBLISHER_RTMP_URL;else process.env.PUBLISHER_RTMP_URL=previous;}
  t.after(()=>new Promise(resolve=>{publisher.server.closeAllConnections();publisher.server.close(resolve);}));
  const status=await(await fetch(`${publisher.origin}/api/publisher/status`)).json();
  const socket=new WebSocket(`ws://127.0.0.1:18766/api/publisher/live?token=${status.token}`,{origin:publisher.origin});
  t.after(()=>socket.terminate());
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Encoder ready timeout')),5000);socket.once('message',()=>{clearTimeout(timer);resolve();});socket.once('error',reject);});
  socket.send(await readFile(input),{binary:true});socket.close();
  let timeout;
  const result=await Promise.race([received,new Promise(resolve=>{timeout=setTimeout(()=>resolve('timeout'),10000);})]);
  clearTimeout(timeout);
  assert.notEqual(result,'timeout','RTMP receiver timed out');
  const decoded=spawnSync(encoder,['-hide_banner','-i',output,'-f','null','-'],{windowsHide:true});
  assert.equal(decoded.status,0,decoded.stderr.toString());
  assert.match(decoded.stderr.toString(),/h264/);
});
