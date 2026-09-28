import 'dart:math' as math;

/// Minimal tween engine — mirrors the Construct 3 Tween values used by the
/// original game (linear, ease-in-out, ease-out, bounce, elastic...).
///
/// Tweens are plain values updated from the game loop; each holds an
/// [onUpdate] callback that applies the value.
class Tween {
  Tween({
    required double from,
    required double to,
    required double duration,
    Ease ease = Ease.linear,
    void Function(double value)? onUpdate,
    void Function()? onComplete,
    double delay = 0,
  })  : _from = from,
        _to = to,
        _duration = math.max(duration, 0.0001),
        _ease = ease,
        _onUpdate = onUpdate,
        _onComplete = onComplete,
        _elapsed = -delay;

  final double _from;
  final double _to;
  final double _duration;
  final Ease _ease;
  final void Function(double value)? _onUpdate;
  final void Function()? _onComplete;

  double _elapsed;
  bool _finished = false;
  bool _started = false;

  bool get finished => _finished;
  double get value => _ease.transform(_elapsed / _duration).clamp(0.0, 1.0) * (_to - _from) + _from;

  /// Advances the tween; returns true when it just completed.
  bool update(double dt) {
    if (_finished) return false;
    _elapsed += dt;
    if (_elapsed < 0) return false; // still in delay
    if (!_started) {
      _started = true;
      _onUpdate?.call(_from);
    }
    final t = (_elapsed / _duration).clamp(0.0, 1.0);
    final v = _ease.transform(t) * (_to - _from) + _from;
    _onUpdate?.call(v);
    if (t >= 1.0) {
      _finished = true;
      _onComplete?.call();
      return true;
    }
    return false;
  }

  /// Jumps to the end immediately (fires completion).
  void finish() {
    if (_finished) return;
    _finished = true;
    _onUpdate?.call(_to);
    _onComplete?.call();
  }
}

/// Easing functions matching the C3 tween modes used by the original
/// ([18, X] entries): 0=linear, 1=smoothstep, 4=ease-out-quad, 8=smoothstep,
/// 9=ease-out-back, 21=ease-in-quad, 24=ease-out-quad, 25=smoothstep.
class Ease {
  final double Function(double t) transform;
  const Ease._(this.transform);

  static const linear = Ease._(_linear);

  static double _linear(double t) => t;

  static final smooth = Ease._((t) => t * t * (3 - 2 * t));

  static final easeOut = Ease._((t) => 1 - (1 - t) * (1 - t));

  static final easeIn = Ease._((t) => t * t);

  /// ease-out-back (C3 mode 9) — slight overshoot, used by pop-ins.
  static final easeOutBack = Ease._((t) {
    final c1 = 1.70158;
    final c3 = c1 + 1;
    final p = t - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  });
}
