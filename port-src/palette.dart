import 'dart:ui';

/// Original Block Blast colors — sampled directly from the original
/// block-sheet0.png frames (the repo now ships the ORIGINAL sprites,
/// restored from the game's CDN).
///
/// Frame order (matches data.json Block animation frames):
///   0 lavender, 1 cyan, 2 green, 3 blue,
///   4 yellow, 5 orange, 6 red, 7 pink
class BlockPalette {
  BlockPalette._();

  static const int kBlockVariants = 8;

  /// Base color of each Block sprite frame (used for the drag-preview tint,
  /// line-clear effect colors and square particles).
  static const List<Color> blockColors = [
    Color(0xFF8D5FD7), // frame 0 — lavender  (139, 95, 215)
    Color(0xFF36B2E1), // frame 1 — cyan      (54, 178, 225)
    Color(0xFF3BB43B), // frame 2 — green     (59, 180, 59)
    Color(0xFF4864E7), // frame 3 — blue      (72, 100, 231)
    Color(0xFFEDB632), // frame 4 — yellow    (237, 182, 50)
    Color(0xFFED7821), // frame 5 — orange    (237, 120, 33)
    Color(0xFFC93131), // frame 6 — red       (201, 49, 49)
    Color(0xFFD35FD7), // frame 7 — pink      (211, 95, 215)
  ];

  // Screen chrome colors (from the original layout).
  static const Color bg = Color(0xFF1E3580); // letterbox fill (gradient bottom tone)
  static const Color gridCell = Color(0xFF212C52); // empty spot tone (33,44,82)
  static const Color text = Color(0xFFFFFFFF);
  static const Color textMuted = Color(0xFF6B7280);
}
