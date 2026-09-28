import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flame/components.dart';
import 'package:flutter/services.dart' show rootBundle;

import 'sprite_manifest.dart';

/// Loads sprites from the Construct 3 sprite manifest at
/// assets/sprites-named/manifest.json and caches them by object name.
///
/// Usage:
///   final spr = await SpriteCache.load();
///   final block = spr.get('Block', frame: 0);  // Sprite
class SpriteCache {
  SpriteCache._(this._manifest, this._images);

  final SpriteManifest _manifest;
  final Map<String, ui.Image> _images; // keyed by file path

  static SpriteCache? _instance;

  /// Loads (or returns cached) the SpriteCache. Safe to call multiple
  /// times.
  static Future<SpriteCache> load() async {
    if (_instance != null) return _instance!;
    final raw = await rootBundle.loadString('assets/sprites-named/manifest.json');
    final manifest = SpriteManifest.parse(jsonDecode(raw) as List<dynamic>);
    final images = <String, ui.Image>{};
    // Load each unique file once.
    final uniqueFiles = <String>{};
    for (final obj in manifest.objectNames) {
      for (final a in manifest.framesFor(obj)!) {
        uniqueFiles.add(a.file);
      }
    }
    for (final file in uniqueFiles) {
      final bytes = await rootBundle.load(file);
      final data = bytes.buffer.asUint8List();
      final codec = await ui.instantiateImageCodec(data);
      final frame = await codec.getNextFrame();
      images[file] = frame.image;
    }
    _instance = SpriteCache._(manifest, images);
    return _instance!;
  }

  /// Returns a Flame Sprite for the given object + frame index.
  /// Throws if the object isn't found.
  Sprite get(String objectName, {int frame = 0}) {
    final assets = _manifest.framesFor(objectName);
    if (assets == null || assets.isEmpty) {
      throw StateError('No sprite for object "$objectName"');
    }
    final a = assets[frame.clamp(0, assets.length - 1)];
    final image = _images[a.file]!;
    // The PNG file is already a cropped sprite (extracted with 2px
    // padding for AA edges), so we draw the whole image.
    return Sprite(image);
  }

  /// Returns ALL frames for an object (e.g. for animation).
  List<Sprite> allFrames(String objectName) {
    final assets = _manifest.framesFor(objectName);
    if (assets == null || assets.isEmpty) return [];
    return assets.map((a) {
      final image = _images[a.file]!;
      return Sprite(image);
    }).toList();
  }

  /// Returns the raw ui.Image for an object (for cases where you
  /// need direct canvas painting instead of a Sprite).
  ui.Image imageOf(String objectName, {int frame = 0}) {
    final assets = _manifest.framesFor(objectName);
    if (assets == null || assets.isEmpty) {
      throw StateError('No sprite for object "$objectName"');
    }
    final a = assets[frame.clamp(0, assets.length - 1)];
    return _images[a.file]!;
  }

  Iterable<String> get objectNames => _manifest.objectNames;
}
