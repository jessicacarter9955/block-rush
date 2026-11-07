/** Pure geometry shared by the responsive game renderer and pointer hit tests. */
export interface GameViewport {
  width: number;
  height: number;
  landscape: boolean;
  boardScale: number;
  boardX: number;
  boardY: number;
  dragLift: number;
}

export interface GridGeometry {
  x: number;
  y: number;
  pitchX: number;
  pitchY: number;
  sizeX: number;
  sizeY: number;
}

export function gameViewport(width: number, landscape: boolean): GameViewport {
  if (!landscape) return { width: 1080, height: 1920, landscape: false, boardScale: 1, boardX: 74.5, boardY: 385, dragLift: 200 };
  const boardScale = 0.75;
  return {
    width,
    height: 1080,
    landscape: true,
    boardScale,
    boardX: width / 2 - (926.5 * boardScale) / 2,
    boardY: (1080 - 943.5 * boardScale) / 2,
    dragLift: 120,
  };
}

export function screenToStage(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  viewport: GameViewport,
) {
  return {
    x: ((clientX - rect.left) / rect.width) * viewport.width,
    y: ((clientY - rect.top) / rect.height) * viewport.height,
  };
}

export function pointerToGrid(
  point: { x: number; y: number },
  piece: { w: number; h: number },
  viewport: GameViewport,
  grid: GridGeometry,
) {
  const gridX = viewport.landscape ? viewport.boardX : grid.x;
  const gridY = viewport.landscape ? viewport.boardY : grid.y;
  const scale = viewport.boardScale;
  const col = Math.round(((point.x - gridX) / scale - (piece.w * grid.pitchX) / 2) / grid.pitchX);
  const row = Math.round((((point.y - viewport.dragLift) - gridY) / scale - (piece.h * grid.pitchY) / 2) / grid.pitchY);
  return { r: row, c: col };
}

/** The bot and manual drag both use this exact inverse of pointerToGrid. */
export function gridDropPoint(
  piece: { w: number; h: number },
  r: number,
  c: number,
  viewport: GameViewport,
  grid: GridGeometry,
) {
  return {
    x: (viewport.landscape ? viewport.boardX : grid.x) + (c + piece.w / 2) * grid.pitchX * viewport.boardScale,
    y: (viewport.landscape ? viewport.boardY : grid.y) + (r + piece.h / 2) * grid.pitchY * viewport.boardScale + viewport.dragLift,
  };
}

export function boardPoint(point: { x: number; y: number }, viewport: GameViewport, grid: GridGeometry) {
  if (!viewport.landscape) return point;
  return {
    x: viewport.boardX + (point.x - grid.x) * viewport.boardScale,
    y: viewport.boardY + (point.y - grid.y) * viewport.boardScale,
  };
}
