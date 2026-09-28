import 'block_blast_game.dart';
import 'layout_constants.dart';
import 'shapes.dart';

/// Scripted 3-step tutorial — 1:1 port of the original "Tutorials" event group.
///
/// Step 1 (TutNum=1): fill board columns 3..5 in every row except row 4,
///   each row colored by its row index (Color[yy]). A 1x3 horizontal piece
///   (shape 19) spawns on the middle PlaceHolder. Placing it in row 4
///   completes the 3 columns.
///
/// Step 2 (TutNum=2): fill board rows 3..5 in every column except column 4,
///   each column colored by its column index (Color[xx]). A 3x1 vertical
///   piece (shape 20) spawns on the middle PlaceHolder. Placing it in
///   column 4 completes the 3 rows.
///
/// Step 3 (TutNum=3): fill a "cross" — columns 3..4 for rows outside 3..4
///   (colored by row) plus rows 3..4 for columns outside 3..4 (colored by
///   column). A 2x2 piece (shape 25) spawns on the middle PlaceHolder.
///   Placing it at (3..4, 3..4) completes 2 rows + 2 columns (4 lines).
///
/// Drag constraints (original "Dragging Blocks" tutorial conditions):
///   step 1: target cells must have xx in 3..5
///   step 2: target cells must have yy in 3..5
///   step 3: target cells must have xx in 3..4 AND yy in 3..4
class TutorialController {
  final BlockBlastGame game;

  TutorialController(this.game);

  int tutNum = 0; // 0 = off, 1..3 = active step

  bool get active => tutNum > 0;

  /// The forced piece for each step (shape indices from the original's
  /// CreateShapeForTut calls: 19, 20, 25).
  static const List<int> stepShapes = [19, 20, 25];

  /// Steps run TutStep(N) which fills the board BEFORE the piece appears.
  void startStep(int step) {
    tutNum = step;
    switch (step) {
      case 1:
        _fillCells(
          (x, y) => x >= 3 && x <= 5 && y != 4,
          colorFor: (x, y) => y,
        );
        break;
      case 2:
        _fillCells(
          (x, y) => y >= 3 && y <= 5 && x != 4,
          colorFor: (x, y) => x,
        );
        break;
      case 3:
        _fillCells(
          (x, y) =>
              (x >= 3 && x <= 4 && y != 3 && y != 4) ||
              (y >= 3 && y <= 4 && x != 3 && x != 4),
          colorFor: (x, y) => (x >= 3 && x <= 4) ? y : x,
        );
        break;
    }
  }

  void _fillCells(bool Function(int x, int y) where,
      {required int Function(int x, int y) colorFor}) {
    for (var y = 0; y < Design.gridSize; y++) {
      for (var x = 0; x < Design.gridSize; x++) {
        if (game.grid[y][x] == null && where(x, y)) {
          game.grid[y][x] = colorFor(x, y);
        }
      }
    }
  }

  /// Whether a drag target cell is allowed in the current tutorial step
  /// (original FSpot conditions during "Dragging Blocks").
  bool allowsTarget(int x, int y) {
    switch (tutNum) {
      case 1:
        return x >= 3 && x <= 5;
      case 2:
        return y >= 3 && y <= 5;
      case 3:
        return x >= 3 && x <= 4 && y >= 3 && y <= 4;
      default:
        return true;
    }
  }

  /// The piece required by the step (random color, like the original's
  /// CreateShapeForTut which draws a color from the shuffled color list).
  Piece? pieceForStep(int colorIdx) {
    if (!active) return null;
    final shapeIdx = stepShapes[tutNum - 1];
    return Piece(shape: kShapes[shapeIdx], colorIdx: colorIdx);
  }
}
