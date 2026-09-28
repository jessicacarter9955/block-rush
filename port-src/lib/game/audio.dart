import 'package:flame_audio/flame_audio.dart';

import 'persistence.dart';

/// Audio manager — 1:1 with the original's PlaySFX / music handling.
///
/// Original PlaySFX(name, volumeDb) checks JSON_LS "SFX" == 1 and plays the
/// sound at the given dB volume. Mapped dB -> linear volume:
///   0 dB -> 1.0, -10 dB -> 0.32
///
/// Score line-clear sounds: "score/s" + min(15, Combo+1)  (14 files, no s12)
/// Cheerful praise sounds: "cheerful/c" + lines           (c2..c6, vol -10)
class GameAudio {
  bool _initialized = false;

  // Music at -5 dB in the original => linear ~0.56.
  static const double _musicVolume = 0.56;

  final GameStorage Function() storage;

  GameAudio(this.storage);

  bool get sfxOn => storage().sfxOn;
  bool get musicOn => storage().musicOn;

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    try {
      await FlameAudio.audioCache.loadAll([
        'put.mp3', 'return.mp3', 'whoosh.mp3', 'no_space.mp3',
        'lose.mp3', 'revive.mp3', 'beep.mp3', 'music.mp3',
        'score.mp3',
        'score/s1.mp3', 'score/s2.mp3', 'score/s3.mp3', 'score/s4.mp3',
        'score/s5.mp3', 'score/s6.mp3', 'score/s7.mp3', 'score/s8.mp3',
        'score/s9.mp3', 'score/s10.mp3', 'score/s11.mp3', 'score/s13.mp3',
        'score/s14.mp3', 'score/s15.mp3',
        'cheerful/c2.mp3', 'cheerful/c3.mp3', 'cheerful/c4.mp3',
        'cheerful/c5.mp3', 'cheerful/c6.mp3',
      ]);
    } catch (_) {
      // Audio is best-effort.
    }
  }

  // === Music ===

  void startMusic() {
    if (!musicOn) return;
    try {
      FlameAudio.bgm.initialize();
      FlameAudio.bgm.play('music.mp3', volume: _musicVolume);
    } catch (_) {}
  }

  void stopMusic() {
    try {
      FlameAudio.bgm.stop();
    } catch (_) {}
  }

  // === SFX (volumes mapped from the original dB values) ===

  void play(String name, {double volume = 1.0}) {
    if (!sfxOn) return;
    try {
      FlameAudio.play(name, volume: volume);
    } catch (_) {}
  }

  void sfxWhoosh() => play('whoosh.mp3', volume: 1.0);
  void sfxPut() => play('put.mp3', volume: 1.0);
  void sfxReturn() => play('return.mp3', volume: 1.0);
  void sfxNoSpace() => play('no_space.mp3', volume: 1.0);
  void sfxLose() => play('lose.mp3', volume: 1.0);
  void sfxRevive() => play('revive.mp3', volume: 1.0);

  /// Revive countdown beep (original: volume 5 dB -> clamped to 1.0).
  void sfxBeep() => play('beep.mp3', volume: 1.0);

  /// Line-clear sound variant (original: "score/s" + min(15, Combo+1)).
  void sfxScore(int comboPre) {
    final n = (comboPre + 1).clamp(1, 15);
    if (n == 12) {
      // No s12 in the original asset set; fall back to the generic score.
      play('score.mp3', volume: 1.0);
      return;
    }
    play('score/s$n.mp3', volume: 1.0);
  }

  /// Cheerful praise sound (original: "cheerful/c" + lines, vol -10 dB).
  void sfxCheerful(int lines) {
    final n = lines.clamp(2, 6);
    play('cheerful/c$n.mp3', volume: 0.32);
  }
}
