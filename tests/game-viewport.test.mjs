import test from 'node:test';
import assert from 'node:assert/strict';
import { gameViewport, gridDropPoint, pointerToGrid, screenToStage, boardPoint } from '../src/lib/game-viewport.ts';

const grid = {x:74.5,y:385,pitchX:115.8125,pitchY:117.9375,sizeX:926.5,sizeY:943.5};

test('portrait retains exact reference coordinates', () => {
  const stage=gameViewport(1080,false);
  assert.deepEqual({width:stage.width,height:stage.height,scale:stage.boardScale,lift:stage.dragLift},
    {width:1080,height:1920,scale:1,lift:200});
  assert.deepEqual(boardPoint({x:74.5,y:385},stage,grid),{x:74.5,y:385});
  assert.deepEqual(pointerToGrid({x:74.5+115.8125/2,y:385+117.9375/2+200},{w:1,h:1},stage,grid),{r:0,c:0});
});

for(const width of [1920,2560]) test(`native wide ${width} board remains interactive and fully in stage`,()=>{
  const stage=gameViewport(width,true);
  assert.ok(stage.boardX>0 && stage.boardX+grid.sizeX*stage.boardScale<width);
  assert.ok(stage.boardY>0 && stage.boardY+grid.sizeY*stage.boardScale<1080);
  for(const [r,c] of [[0,0],[3,4],[7,7]]) {
    const center={
      x:stage.boardX+(c+0.5)*grid.pitchX*stage.boardScale,
      y:stage.boardY+(r+0.5)*grid.pitchY*stage.boardScale+stage.dragLift,
    };
    assert.deepEqual(pointerToGrid(center,{w:1,h:1},stage,grid),{r,c});
    assert.deepEqual(pointerToGrid(gridDropPoint({w:1,h:1},r,c,stage,grid),{w:1,h:1},stage,grid),{r,c});
    assert.deepEqual(boardPoint({x:grid.x+(c+.5)*grid.pitchX,y:grid.y+(r+.5)*grid.pitchY},stage,grid),
      {x:center.x,y:center.y-stage.dragLift});
  }
  // Stage is fitted in a browser: client pointer must invert the CSS scale.
  const rect={left:63,top:21,width:width*.44,height:1080*.44};
  const p=screenToStage(rect.left+rect.width*.6,rect.top+rect.height*.4,rect,stage);
  assert.ok(Math.abs(p.x-width*.6)<1e-10);
  assert.ok(Math.abs(p.y-1080*.4)<1e-10);
});

test('multi-cell pieces snap to the intended top-left grid cell',()=>{
  const stage=gameViewport(1920,true);
  const piece={w:3,h:2};
  const center={
    x:stage.boardX+(2+piece.w/2)*grid.pitchX*stage.boardScale,
    y:stage.boardY+(4+piece.h/2)*grid.pitchY*stage.boardScale+stage.dragLift,
  };
  assert.deepEqual(pointerToGrid(center,piece,stage,grid),{r:4,c:2});
  assert.deepEqual(gridDropPoint(piece,4,2,stage,grid),center);
});
