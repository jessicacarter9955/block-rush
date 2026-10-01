import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/hint-reward.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {setHintAdProvider,requestHintReward,scoreFontSize}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('reward completion, cancellation and missing or failing SDK stay distinct',async()=>{
 assert.equal(await requestHintReward(),'unavailable');
 setHintAdProvider(async()=> 'cancelled');assert.equal(await requestHintReward(),'cancelled');
 setHintAdProvider(async()=> {throw new Error('no fill');});assert.equal(await requestHintReward(),'unavailable');
 setHintAdProvider(async()=> 'completed');assert.equal(await requestHintReward(),'completed');
 setHintAdProvider(undefined);
});
test('score and record shrink monotonically and fit separate HUD regions',()=>{
 for(const [width,max] of [[530,160],[240,92]]){
  let previous=max;
  for(let digits=1;digits<=16;digits++){
   const size=scoreFontSize('8'.repeat(digits),max,width);
   assert.ok(size<=previous);assert.ok(size>0);assert.ok(size*digits*1.05+24<=width+0.001);previous=size;
  }
 }
});
