import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../src/lib/recording.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createGameRecorder}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

async function captureHarness(t) {
  let selections=0,tracksStopped=0,segmentCallback;
  const track={stop(){tracksStopped++;},getSettings:()=>({displaySurface:'browser'}),addEventListener(){}};
  class Stream {getTracks(){return [track];}getVideoTracks(){return [track];}getAudioTracks(){return [];}addTrack(){}}
  const video={videoWidth:1080,videoHeight:1920,play:async()=>{},pause(){},requestVideoFrameCallback:()=>1,cancelVideoFrameCallback(){}};
  const canvas={getContext:()=>({drawImage(){}}),captureStream:()=>new Stream()};
  class Recorder {
    static isTypeSupported(){return true;}state='inactive';mimeType='video/webm';
    start(){this.state='recording';}
    stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable({data:new Blob(['independent clip'])});this.onstop();});}
  }
  const replacements={navigator:{mediaDevices:{getDisplayMedia:async()=>{selections++;return new Stream();}}},MediaStream:Stream,MediaRecorder:Recorder,
    document:{createElement:tag=>tag==='video'?video:canvas},
    window:{setTimeout:(callback,delay)=>{if(delay===6000){segmentCallback=callback;return 0;}return setTimeout(callback,delay);},setInterval},
    innerWidth:1080,innerHeight:1920,cancelAnimationFrame(){}};
  const saved=new Map(Object.keys(replacements).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const [key,value]of Object.entries(replacements))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  t.after(()=>{for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  return {element:{getBoundingClientRect:()=>({left:0,top:0,width:1080,height:1920})},get selections(){return selections;},get tracksStopped(){return tracksStopped;},
    endSegment:async()=>{segmentCallback();await new Promise(resolve=>queueMicrotask(resolve));}};
}

test('a batch creates independent clips from one permission session and closes after its limit',async t=>{
  const harness=await captureHarness(t);const clips=[];let stopped=0;
  const stop=await createGameRecorder({element:harness.element,audio:false,segmentSeconds:6,maxSegments:2,onTime(){},onError:assert.fail,onComplete:blob=>clips.push(blob),onStopped:()=>stopped++});
  t.after(stop);
  await harness.endSegment();assert.equal(clips.length,1);assert.equal(harness.tracksStopped,0);
  await harness.endSegment();assert.equal(clips.length,2);assert.equal(harness.selections,1);assert.equal(stopped,1);assert.ok(harness.tracksStopped>0);
});

test('manual batch stop does not start another segment',async t=>{
  const harness=await captureHarness(t);let clips=0,stopped=0;
  const stop=await createGameRecorder({element:harness.element,audio:false,segmentSeconds:6,maxSegments:10,onTime(){},onError:assert.fail,onComplete:()=>clips++,onStopped:()=>stopped++});
  stop();await new Promise(resolve=>queueMicrotask(resolve));
  assert.equal(clips,1);assert.equal(stopped,1);assert.equal(harness.selections,1);
});

test('live chunks are forwarded without collecting a growing full-session blob',async t=>{
  const harness=await captureHarness(t);let chunks=0,completed=0;
  const stop=await createGameRecorder({element:harness.element,audio:false,onTime(){},onError:assert.fail,onComplete:()=>completed++,onChunk:()=>chunks++});
  stop();await new Promise(resolve=>queueMicrotask(resolve));assert.equal(chunks,1);assert.equal(completed,0);assert.ok(harness.tracksStopped>0);
});
