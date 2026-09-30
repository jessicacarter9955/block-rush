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
test('individually placeable squares can be an impossible tray',()=>{
 const board=Array.from({length:64},(_,i)=>{const r=Math.floor(i/8),c=i%8;return (r<2&&c<2)||(r+c)%2===0?null:0;});
 const square=makePiece(25,0);assert.ok(canPlace(board,square,0,0));assert.equal(solveTray(board,[square,square,square]),null);
 const fixed=ensureFairTray(board,[square,square,square],seeded(1));assert.equal(fixed.refreshed,true);replay(board,fixed.solution);
});
test('500 deals with arbitrary legal choices always retain a verified continuation',()=>{
 const rand=seeded(2026);let board=Array(64).fill(null),pieces=[null,null,null];
 for(let turn=0;turn<1500;turn++){
  const verified=ensureFairTray(board,pieces,rand);pieces=verified.pieces;replay(board,verified.solution);
  const legal=[];for(let slot=0;slot<3;slot++){const piece=pieces[slot];if(!piece)continue;for(let pos=0;pos<64;pos++){const r=Math.floor(pos/8),c=pos%8;if(canPlace(board,piece,r,c))legal.push({slot,piece,r,c});}}
  assert.ok(legal.length);const chosen=legal[Math.floor(rand()*legal.length)];board=applySolution(board,chosen);pieces=[...pieces];pieces[chosen.slot]=null;
 }
});
test('refresh preserves consumed slots and existing board',()=>{
 const board=Array.from({length:64},(_,i)=>Math.floor(i/8)===i%8?null:1),copy=[...board];
 const result=ensureFairTray(board,[makePiece(28,1),null,makePiece(28,2)],seeded(9));assert.equal(result.pieces[1],null);assert.deepEqual(board,copy);replay(board,result.solution);
});
