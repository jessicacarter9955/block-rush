import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../src/lib/recording.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {captureRect,sliderToSpeed,speedToSlider,createGameRecorder}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('crop respects independent horizontal and vertical capture scaling',()=>{assert.deepEqual(captureRect({left:100,top:20,width:200,height:400},{width:1000,height:800},{width:2000,height:1200}),{x:200,y:30,width:400,height:600});});
test('offscreen game is rejected rather than recording black borders',()=>{assert.throws(()=>captureRect({left:-10,top:0,width:200,height:400},{width:1000,height:800},{width:2000,height:1600}));});
test('invalid video metadata is rejected',()=>{assert.throws(()=>captureRect({left:0,top:0,width:200,height:400},{width:1000,height:800},{width:0,height:0}));});
test('speed slider covers cinematic to turbo and clamps invalid input',()=>{assert.equal(sliderToSpeed(0),.25);assert.equal(sliderToSpeed(100),16);assert.equal(speedToSlider(1),33);assert.equal(speedToSlider(100),100);assert.equal(speedToSlider(NaN),33);for(let i=0;i<=100;i++){assert.ok(Math.abs(speedToSlider(sliderToSpeed(i))-i)<=1);}});

test('recorder stops all capture tracks, releases video and returns a usable blob',async()=>{
 const stops={display:0,audio:0,canvas:0};
 const track=name=>({stop(){stops[name]++},getSettings(){return {displaySurface:'browser'}},addEventListener(){}});
 const display=track('display'),audio=track('audio'),canvasTrack=track('canvas');
 class Stream {constructor(tracks){this.tracks=tracks}getTracks(){return this.tracks}getVideoTracks(){return this.tracks.filter(t=>t!==audio)}getAudioTracks(){return this.tracks.filter(t=>t===audio)}addTrack(t){this.tracks.push(t)}}
 const video={videoWidth:2000,videoHeight:1600,play:async()=>{},pause(){this.paused=true},requestVideoFrameCallback:()=>1,cancelVideoFrameCallback(){}};
 const canvas={getContext:()=>({drawImage(){}}),captureStream:()=>new Stream([canvasTrack])};
 class Recorder {static isTypeSupported(){return true}state='inactive';mimeType='video/mp4';start(){this.state='recording'}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable({data:new Blob(['test video'])});this.onstop()})}}
 const replacements={navigator:{mediaDevices:{getDisplayMedia:async()=>new Stream([display,audio])}},MediaStream:Stream,MediaRecorder:Recorder,document:{createElement:tag=>tag==='video'?video:canvas},window:{setTimeout,setInterval},innerWidth:1000,innerHeight:800,cancelAnimationFrame:()=>{}};
 const saved=new Map(Object.keys(replacements).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try {
  for(const [k,v] of Object.entries(replacements))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
  let result,error;
  const stop=await createGameRecorder({element:{getBoundingClientRect:()=>({left:100,top:20,width:200,height:400})},audio:true,onTime(){},onComplete:b=>result=b,onError:e=>error=e});
  stop();await new Promise(resolve=>queueMicrotask(resolve));
  assert.equal(error,undefined);assert.ok(result.size>0);assert.equal(result.type,'video/mp4');assert.equal(video.srcObject,null);assert.equal(video.paused,true);assert.ok(Object.values(stops).every(n=>n>=1));
 }finally{for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
});
