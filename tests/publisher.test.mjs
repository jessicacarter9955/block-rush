import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PublisherQueue, validateConfig, makePost } from '../publisher/core.mjs';
import { trustedRequest } from '../publisher/server.mjs';

const config = { mode:'schedule', intervalMinutes:120, postizBaseUrl:'https://publisher.example/api/public/v1', channels:[
  {id:'channel-a',settings:{__type:'youtube',type:'public',selfDeclaredMadeForKids:'no'}},
  {id:'channel-b',settings:{__type:'youtube',type:'private',selfDeclaredMadeForKids:'no'}},
] };
const job = id => ({id,source:`${id}.webm`,title:`BlockRush ${id}`});

test('publishing requires explicit destinations and YouTube visibility',()=>{
  assert.equal(validateConfig().mode,'local');
  assert.throws(()=>validateConfig({...config,channels:[]}));
  assert.throws(()=>validateConfig({...config,channels:[{id:'x',settings:{__type:'youtube'}}]}));
  assert.throws(()=>validateConfig({...config,intervalMinutes:0}));
  assert.throws(()=>validateConfig({...config,postizBaseUrl:'http://remote.example/api'}));
  assert.throws(()=>validateConfig({...config,channels:[config.channels[0],config.channels[0]]}));
});

test('payload preserves each channel visibility and one future schedule',()=>{
  const payload=makePost(config,{...job('one'),scheduledAt:1},{id:'media',path:'https://media.example/one.mp4'},100000);
  assert.equal(payload.posts.length,2);
  assert.equal(payload.posts[0].settings.type,'public');
  assert.equal(payload.posts[1].settings.type,'private');
  assert.equal(payload.type,'schedule');
  assert.ok(Date.parse(payload.date)>100000);
});

test('local worker rejects remote origins, DNS rebinding and cross-site fetches',()=>{
  const origin='http://127.0.0.1:8765';
  assert.ok(trustedRequest({headers:{host:'127.0.0.1:8765',origin}},origin));
  assert.equal(trustedRequest({headers:{host:'evil.example',origin}},origin),false);
  assert.equal(trustedRequest({headers:{host:'127.0.0.1:8765',origin:'https://evil.example'}},origin),false);
  assert.equal(trustedRequest({headers:{host:'127.0.0.1:8765','sec-fetch-site':'cross-site'}},origin),false);
});

test('queue stores MP4 locally without a publishing configuration',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'blockrush-local-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let calls=0;
  const queue=new PublisherQueue(directory,{}, {request:async()=>{calls++;throw new Error('must stay local');},convert:async args=>writeFile(args.at(-1),'video')});
  await queue.init();await queue.add({...job('one'),hash:'hash-a'});
  assert.equal(await queue.add({...job('two'),hash:'hash-a'}),false);
  await queue.process();
  assert.equal(queue.jobs[0].state,'ready');assert.equal(calls,0);
  assert.equal(await readFile(join(directory,'one.mp4'),'utf8'),'video');
});

test('scheduled batch uses spaced slots and never resubmits after restart',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'blockrush-batch-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const calls=[];
  const request=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/upload')?{id:'media',path:'https://media.example/clip.mp4'}:[{postId:'receipt',integration:'channel-a'}]};};
  const options={key:'test-key',request,convert:async args=>writeFile(args.at(-1),'video')};
  const queue=new PublisherQueue(directory,config,options);await queue.init();
  await queue.add(job('one'));await queue.add(job('two'));
  assert.ok(queue.jobs[1].scheduledAt-queue.jobs[0].scheduledAt>=120*60000);
  await queue.process();assert.deepEqual(queue.jobs.map(j=>j.state),['scheduled','scheduled']);
  assert.equal(calls.filter(c=>c.url.endsWith('/posts')).length,2);
  const restarted=new PublisherQueue(directory,config,options);await restarted.init();await restarted.process();
  assert.equal(calls.length,4);
  assert.equal(calls[0].options.headers.Authorization,'test-key');
});

test('an ambiguous create-post response is held for reconciliation, never retried',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'blockrush-unknown-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  let submissions=0;
  const options={key:'test-key',convert:async args=>writeFile(args.at(-1),'video'),request:async url=>{
    if(url.endsWith('/posts')){submissions++;throw new Error('Connection lost after submission');}
    return {ok:true,json:async()=>({id:'media',path:'https://media.example/clip.mp4'})};
  }};
  const queue=new PublisherQueue(directory,config,options);await queue.init();await queue.add(job('one'));await queue.process();
  assert.equal(queue.jobs[0].state,'unknown');
  const restarted=new PublisherQueue(directory,config,options);await restarted.init();await restarted.process();
  assert.equal(submissions,1);assert.equal(restarted.jobs[0].state,'unknown');
});
