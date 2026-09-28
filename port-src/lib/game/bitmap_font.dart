import 'dart:ui' as ui show Image;
import 'dart:ui' show BlendMode, Canvas, Color, ColorFilter, FilterQuality, Paint, Rect;

import 'package:flame/components.dart';

/// Bitmap digit font renderer — uses the ORIGINAL spritefont glyph sheets
/// shipped in assets/sprites-named (txtScore-f00.png etc.), so numbers look
/// pixel-identical to the original game.
///
/// Measured glyph geometry (txtScore sheet, 1024x128):
///   10 digits "0".."9", cell pitch ~92, glyph height ~90 (y 11..100),
///   which is exactly the size digits render at in the original HUD.
class BitmapFont {
  BitmapFont({
    required this.sheet,
    required this.charset,
    required this.cellW,
    required this.cellH,
    required this.columns,
  });

  final ui.Image sheet;
  final String charset;
  final double cellW;
  final double cellH;
  final int columns;

  /// The main HUD score font ("0".."9", pitch 92, natural design size).
  static BitmapFont digits(Sprite sprite) => BitmapFont(
        sheet: sprite.image,
        charset: '0123456789',
        cellW: 92.13,
        cellH: 128,
        columns: 10,
      );

  /// The earned-score font ("0".."9" and "+", 11 glyphs, 512x128 sheet).
  static BitmapFont digitsPlus(Sprite sprite) => BitmapFont(
        sheet: sprite.image,
        charset: '0123456789+',
        cellW: 512 / 11,
        cellH: 128,
        columns: 11,
      );

  /// The big combo-counter font (charset "1234567890" — original order —
  /// 700x400 sheet, 2 rows of 5, cells 140x200).
  static BitmapFont comboBig(Sprite sprite) => BitmapFont(
        sheet: sprite.image,
        charset: '1234567890',
        cellW: 140,
        cellH: 200,
        columns: 5,
      );

  /// Width of [text] rendered at [scale].
  double measureWidth(String text, {double scale = 1}) =>
      text.length * cellW * scale;

  /// Draws [text] centered horizontally on [cx], vertically on [cy].
  /// Each character advances a full cell width (monospace, matching the
  /// original spritefont face metrics).
  void drawCentered(Canvas canvas, String text, double cx, double cy,
      {double scale = 1, double opacity = 1.0}) {
    if (text.isEmpty) return;
    final totalW = text.length * cellW * scale;
    var x = cx - totalW / 2;
    final glyphH = cellH * scale;
    final top = cy - glyphH / 2;
    final paint = Paint()..filterQuality = FilterQuality.medium;
    if (opacity < 1) {
      paint.colorFilter = ColorFilter.mode(
        const Color(0xFFFFFFFF).withOpacity(opacity),
        BlendMode.dstIn,
      );
    }
    for (final ch in text.codeUnits) {
      final idx = charset.indexOf(String.fromCharCode(ch));
      if (idx < 0) {
        x += cellW * scale;
        continue;
      }
      final col = idx % columns;
      final row = idx ~/ columns;
      final src = Rect.fromLTWH(
        col * cellW,
        row * cellH + 11,
        cellW,
        cellH * 0.78,
      );
      final dst = Rect.fromLTWH(
        x,
        top + cellH * 0.11 * scale,
        cellW * scale,
        cellH * 0.78 * scale,
      );
      canvas.drawImageRect(sheet, src, dst, paint);
      x += cellW * scale;
    }
  }
}
