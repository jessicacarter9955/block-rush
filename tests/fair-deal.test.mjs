import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/game.ts',import.meta.url),'utf8');
const data=fs.readFileSync(new URL('../src/lib/assets-data.ts',import.meta.url),'utf8');
const js=ts.transpileModule(data+'\n'+source.replace("import { SHAPES } from './assets-data';",''),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {fairDeal,ensureFairTray,applySolution,canPlace,makePiece,solveTray}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function replay(board,solution){let next=[...board];for(const m of solution){assert.ok(canPlace(next,m.piece,m.r,m.c));next=applySolution(next,m);}return next;}
test('scarce board still has three verified moves and never mutates input',()=>{
 const board=Array.from({length:64},(_,i)=>Math.floor(i/8)===i%8?null:1),copy=[...board];
 const deal=fairDeal(board,[0,1,2],seeded(7));assert.equal(deal.solution.length,3);replay(board,deal.solution);assert.deepEqual(board,copy);
});
test('a bad choice can lose without replacing remaining pieces',()=>{
 const board=Array.from({length:64},(_,i)=>{const r=Math.floor(i/8),c=i%8;return (r<2&&c<2)||(r+c)%2===0?null:0;});
 const square=makePiece(25,0),pieces=[square,square,square];
 assert.ok(canPlace(board,square,0,0));assert.equal(solveTray(board,pieces),null);
 const before=ensureFairTray(board,pieces,seeded(1));assert.equal(before.pieces,pieces);assert.equal(before.lost,false);assert.deepEqual(before.solution,[]);
 const next=applySolution(board,{slot:0,piece:square,r:0,c:0}),remaining=[null,square,square];
 const after=ensureFairTray(next,remaining);assert.equal(after.pieces,remaining);assert.equal(after.lost,true);assert.deepEqual(after.solution,[]);
});

test('500 generated trays each have a complete replayable solution',()=>{
 const rand=seeded(2026);let board=Array(64).fill(null);
 for(let turn=0;turn<500;turn++){
  const deal=ensureFairTray(board,[null,null,null],rand);
  assert.equal(deal.lost,false);assert.equal(deal.solution.length,3);assert.equal(new Set(deal.solution.map(m=>m.slot)).size,3);
  board=replay(board,deal.solution);
 }
});

test('loss preserves consumed slots, existing board and tray identity',()=>{
 const board=Array.from({length:64},(_,i)=>Math.floor(i/8)===i%8?null:1),copy=[...board];
 const pieces=[makePiece(28,1),null,makePiece(28,2)];
 const result=ensureFairTray(board,pieces,seeded(9));assert.equal(result.pieces,pieces);assert.equal(result.lost,true);assert.deepEqual(board,copy);assert.deepEqual(result.solution,[]);
});
