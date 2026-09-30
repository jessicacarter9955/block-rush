import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureRect,sliderToSpeed,speedToSlider} from '../src/lib/recording.ts';
test('crop respects independent horizontal and vertical capture scaling',()=>{assert.deepEqual(captureRect({left:100,top:20,width:200,height:400},{width:1000,height:800},{width:2000,height:1200}),{x:200,y:30,width:400,height:600});});
test('offscreen game is rejected rather than recording black borders',()=>{assert.throws(()=>captureRect({left:-10,top:0,width:200,height:400},{width:1000,height:800},{width:2000,height:1600}));});
test('invalid video metadata is rejected',()=>{assert.throws(()=>captureRect({left:0,top:0,width:200,height:400},{width:1000,height:800},{width:0,height:0}));});
test('speed slider covers cinematic to turbo and clamps invalid input',()=>{assert.equal(sliderToSpeed(0),.25);assert.equal(sliderToSpeed(100),16);assert.equal(speedToSlider(1),33);assert.equal(speedToSlider(100),100);assert.equal(speedToSlider(NaN),33);for(let i=0;i<=100;i++){assert.ok(Math.abs(speedToSlider(sliderToSpeed(i))-i)<=1);}});
