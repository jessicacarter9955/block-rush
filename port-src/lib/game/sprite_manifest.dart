/// Sprite manifest loaded from assets/sprites-named/manifest.json.
///
/// Each entry maps a Construct 3 object name to one or more sprite
/// frames. We use this to load the right PNG file when we need a
/// specific UI element (e.g. "BtnPlay", "Block" frame 0, "Board").
class SpriteAsset {
  final String objectName;
  final String animation;
  final int frame;
  final String sheet;
  final int srcX, srcY, srcW, srcH;
  final String file;

  const SpriteAsset({
    required this.objectName,
    required this.animation,
    required this.frame,
    required this.sheet,
    required this.srcX,
    required this.srcY,
    required this.srcW,
    required this.srcH,
    required this.file,
  });

  factory SpriteAsset.fromJson(Map<String, dynamic> j) => SpriteAsset(
        objectName: j['object'] as String,
        animation: j['animation'] as String,
        frame: (j['frame'] as num).toInt(),
        sheet: j['sheet'] as String,
        srcX: (j['src_x'] as num).toInt(),
        srcY: (j['src_y'] as num).toInt(),
        srcW: (j['src_w'] as num).toInt(),
        srcH: (j['src_h'] as num).toInt(),
        file: j['file'] as String,
      );
}

/// Manifest: a list of SpriteAsset, indexed by object name.
class SpriteManifest {
  final Map<String, List<SpriteAsset>> byObject;

  SpriteManifest._(this.byObject);

  static SpriteManifest parse(List<dynamic> raw) {
    final byObject = <String, List<SpriteAsset>>{};
    for (final j in raw) {
      final asset = SpriteAsset.fromJson(j as Map<String, dynamic>);
      byObject.putIfAbsent(asset.objectName, () => []).add(asset);
    }
    // Sort each object's frames by animation + frame index for
    // deterministic iteration.
    for (final list in byObject.values) {
      list.sort((a, b) {
        final ac = a.animation.compareTo(b.animation);
        if (ac != 0) return ac;
        return a.frame.compareTo(b.frame);
      });
    }
    return SpriteManifest._(byObject);
  }

  /// Returns the frames for an object, sorted by animation then frame.
  /// Returns null if the object isn't in the manifest.
  List<SpriteAsset>? framesFor(String objectName) => byObject[objectName];

  /// Returns the first frame for an object, or throws if not found.
  SpriteAsset firstFrame(String objectName) {
    final list = byObject[objectName];
    if (list == null || list.isEmpty) {
      throw StateError('No sprite found for object "$objectName"');
    }
    return list.first;
  }

  Iterable<String> get objectNames => byObject.keys;
}
