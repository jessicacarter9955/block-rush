import 'dart:ui';

/// Block Rush colors — sampled directly from the real game screenshot
/// (1170×2532, cells 128.25px, pixel-probed).
///
/// Frame order (matches the Block sprites):
///   0 viola, 1 ciano, 2 verde, 3 blu,
///   4 giallo, 5 arancio, 6 rosso, 7 magenta
class BlockPalette {
  BlockPalette._();

  static const int kBlockVariants = 8;

  /// Base color of each Block sprite frame (used for the drag-preview tint,
  /// line-clear effect colors and square particles).
  static const List<Color> blockColors = [
    Color(0xFF8848E0), // frame 0 — viola    (136, 72, 224)
    Color(0xFF00C0C0), // frame 1 — ciano    (0, 192, 192)
    Color(0xFF01C501), // frame 2 — verde    (1, 197, 1)
    Color(0xFF0090F8), // frame 3 — blu      (0, 144, 248)
    Color(0xFFF8D000), // frame 4 — giallo   (248, 208, 0)
    Color(0xFFC87D00), // frame 5 — arancio  (200, 125, 0)
    Color(0xFFC40A0A), // frame 6 — rosso    (196, 10, 10)
    Color(0xFFC40AC4), // frame 7 — magenta  (196, 10, 196)
  ];

  // Screen chrome colors (Block Rush theme).
  static const Color bg = Color(0xFF4E076D); // flat deep purple background
  static const Color gridCell = Color(0xFF2A0139); // uniform dark board
  static const Color text = Color(0xFFFFFFFF);
  static const Color textMuted = Color(0xFFB39DDB);
  static const Color accent = Color(0xFF9370DB); // lavender buttons
}
