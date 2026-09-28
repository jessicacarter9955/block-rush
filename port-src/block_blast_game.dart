import 'dart:math' as math;
import 'dart:ui' show Canvas, Color;

import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flame/game.dart';
import 'bitmap_font.dart';
import 'layout_constants.dart';
import 'persistence.dart';
import 'audio.dart';
import 'ranking.dart';
import 'rendering.dart';
import 'shapes.dart';
import 'sprite_cache.dart';
import 'tutorial.dart';
import 'tween.dart';

/// Game states — mirrors the original's GameState variable values
/// ("Home", "HUD", "Pause", "Revive", "GameOver", "Ranking", "Waiting").
enum GameState { home, hud, pause, revive, gameOver, ranking, waiting }

/// The full Block Blast game — 1:1 native Flame port of the original
/// Construct 3 project, using the original sprites and the original fixed
/// 1080x1920 design coordinates.
///
/// All logic below is a direct transcription of the decompiled event sheets
/// (see docs/DIFFERENZE.md for the full mapping).
class BlockBlastGame extends FlameGame {
  BlockBlastGame()
      : super(
          camera: CameraComponent.withFixedResolution(
            world: World(),
            width: Design.width,
            height: Design.height,
          ),
        ) {
    storage = GameStorage();
    audio = GameAudio(() => storage);
    tutorial = TutorialController(this);
  }

  // === Assets & services ===
  late final SpriteCache sprites;
  late final GameStorage storage;
  late final GameAudio audio;
  late final TutorialController tutorial;
  late BitmapFont scoreFont;
  late BitmapFont earnedFont;
  late BitmapFont comboFont;

  final math.Random rng = math.Random();

  // === Core state ===
  GameState state = GameState.home;
  final List<List<int?>> grid =
      List.generate(Design.gridSize, (_) => List<int?>.filled(Design.gridSize, null));

  int score = 0;
  double scoreShown = 0; // animated counter (original: tween "num" 0.5s)
  double bestShown = 0;
  int combo = -1;
  int comboHeartActive = 0;
  int noScoreMoves = 0;
  int putShapeCount = 0;

  // Shape pool (original: ArrayShapesList — 5 placeable shapes, distinct)
  List<int> shapePool = [];

  // === Tray ===
  /// 3 slots; null = empty. Slot 1 (middle) hosts tutorial pieces.
  final List<TraySlot?> tray = [null, null, null];

  // === Drag state ===
  int dragSlot = -1;
  double dragDX = 0;
  Vector2 dragPos = Vector2.zero();
  bool dragValid = false;
  List<math.Point<int>> dragTargets = [];
  final Set<String> dragMarkedLines = {}; // "R3" / "C4"
  double dragScale = 1; // piece scale animates 1 -> 2 on grab
  double dragReturnT = -1; // >= 0 while returning to the tray
  Vector2 returnFrom = Vector2.zero();

  // === Placement settle animation (cells -> progress 0..1) ===
  final Map<math.Point<int>, double> settleCells = {};

  // === Effects ===
  final List<Tween> tweens = [];
  final List<LineFx> lineFx = [];
  final List<SquareFx> squares = [];
  final List<GlowBurst> glowBursts = [];
  final List<Particle> particles = [];
  ComboDisplay? comboDisplay;
  EarnedDisplay? earnedDisplay;
  NoSpaceBanner? noSpaceBanner;

  // === Screen shake (original: Shaker + DoShake(distance, duration)) ===
  double shakeValue = 0;
  double shakeT = 0;
  double shakeDuration = 0.001;
  double shakeDistance = 0;

  // === HUD ===
  bool heartVisible = false;
  double heartPulse = 0;

  // === Pause popup ===
  double pausePopupY = -1500; // slides to 960
  double blackBgOpacity = 0;
  GameState stateBeforePause = GameState.hud;
  GameState rankingReturn = GameState.home;

  // === Revive ===
  int revivePassed = 0;
  double reviveRadial = 0; // 0..100
  int reviveText = Design.reviveTime;

  // === Game over ===
  double goScoreShown = 0;

  // === Ranking ===
  RankingData? rankingData;

  // === Button press feedback (original: scale 0.95 on touch) ===
  String? pressedButton;

  // === Tutorial hint loop ===
  double tutHintT = 0;

  // === Pending scheduled actions ===
  final List<Scheduled> _pending = [];
  int _scheduledSerial = 0;

  /// Letterbox color matching the original background gradient's dark tone
  /// (the original "Responsive" group extends the Bg over the whole screen).
  @override
  Color backgroundColor() => const Color(0xFF2B3F7E);

  @override
  Future<void> onLoad() async {
    camera.viewfinder.position = Vector2(Design.width / 2, Design.height / 2);
    sprites = await SpriteCache.load();
    scoreFont = BitmapFont.digits(sprites.get('txtScore'));
    earnedFont = BitmapFont.digitsPlus(sprites.get('txtEarnedScore'));
    comboFont = BitmapFont.comboBig(sprites.get('txtComboNum'));
    await storage.load();
    await audio.init();
    bestShown = storage.bestScore.toDouble();
    await world.add(GameCanvas(this));
  }

  // =====================================================================
  //  Scheduling helpers (C3 "Wait" equivalents)
  // =====================================================================

  int after(double seconds, void Function() action) {
    final id = ++_scheduledSerial;
    _pending.add(Scheduled(id, seconds, action));
    return id;
  }

  void cancel(int id) {
    _pending.removeWhere((s) => s.id == id);
  }

  void addTween(Tween t) => tweens.add(t);

  // =====================================================================
  //  Game flow
  // =====================================================================

  void startGame() {
    for (var y = 0; y < Design.gridSize; y++) {
      grid[y] = List<int?>.filled(Design.gridSize, null);
    }
    for (var i = 0; i < 3; i++) {
      tray[i] = null;
    }
    score = 0;
    scoreShown = 0;
    combo = -1;
    comboHeartActive = 0;
    noScoreMoves = 0;
    putShapeCount = 0;
    heartVisible = false;
    lineFx.clear();
    squares.clear();
    glowBursts.clear();
    particles.clear();
    comboDisplay = null;
    earnedDisplay = null;
    noSpaceBanner = null;
    settleCells.clear();
    _pending.clear();
    tweens.clear();
    pausePopupY = -1500;
    blackBgOpacity = 0;
    revivePassed = 0;
    state = GameState.hud;
    audio.startMusic();
    if (storage.tut == 1) {
      tutorial.startStep(1);
      _spawnTutorialPiece();
    } else {
      createShapes();
    }
  }

  void goHome() {
    state = GameState.home;
    audio.stopMusic();
  }

  /// Original "CreateShapes": pool of 5 placeable shapes, 3 distinct picks,
  /// 3 distinct colors popped from a shuffled 0..7 list.
  void createShapes({bool revive = false}) {
    if (!revive || shapePool.length < 3) {
      getAvailableShapes();
    }
    final colors = List<int>.generate(8, (i) => i)..shuffle(rng);
    for (var i = 0; i < 3; i++) {
      int shapeIdx;
      if (shapePool.isNotEmpty) {
        shapeIdx = shapePool[rng.nextInt(shapePool.length)];
        // Keep the pool at >= 3 so tray shapes stay distinct (original rule).
        if (shapePool.length >= 3) {
          shapePool.remove(shapeIdx);
        }
      } else {
        shapeIdx = rng.nextInt(kShapes.length);
      }
      final colorIdx = colors.isEmpty
          ? rng.nextInt(8)
          : colors.removeAt(rng.nextInt(colors.length));
      tray[i] = TraySlot(shapeIdx, colorIdx);
      _spawnPopEffects(i);
    }
  }

  /// Original "GetAvailableShapes": 5 distinct shapes that fit the board.
  void getAvailableShapes() {
    final all = List<int>.generate(kShapes.length, (i) => i)..shuffle(rng);
    final pool = <int>[];
    for (final s in all) {
      if (pool.length >= 5) break;
      if (shapeFitsAnywhere(s)) pool.add(s);
    }
    shapePool = pool.isEmpty ? [rng.nextInt(kShapes.length)] : pool;
  }

  /// Original "ShapeCheckPlace": does [shapeIdx] fit anywhere on the board?
  bool shapeFitsAnywhere(int shapeIdx) {
    final shape = kShapes[shapeIdx];
    for (var y = 0; y < Design.gridSize; y++) {
      for (var x = 0; x < Design.gridSize; x++) {
        if (_shapeFitsAt(shape, x, y)) return true;
      }
    }
    return false;
  }

  bool _shapeFitsAt(List<List<int>> shape, int ox, int oy) {
    for (var r = 0; r < shape.length; r++) {
      for (var c = 0; c < shape[r].length; c++) {
        if (shape[r][c] == 0) continue;
        final gx = ox + c;
        final gy = oy + r;
        if (gx < 0 || gx >= Design.gridSize || gy < 0 || gy >= Design.gridSize) {
          return false;
        }
        if (grid[gy][gx] != null) return false;
      }
    }
    return true;
  }

  /// Original "IsThereSpace": any unplaced tray piece fits anywhere?
  bool anyRemainingFits() {
    for (final slot in tray) {
      if (slot == null || slot.placed) continue;
      if (shapeFitsAnywhere(slot.shapeIdx)) return true;
    }
    return false;
  }

  void _spawnTutorialPiece() {
    final colorIdx = rng.nextInt(8);
    final piece = tutorial.pieceForStep(colorIdx);
    if (piece == null) return;
    tray[1] = TraySlot.fromPiece(piece);
    _spawnPopEffects(1);
  }

  void _spawnPopEffects(int slotIdx) {
    final ph = slotCenter(slotIdx);
    glowBursts.add(GlowBurst(ph.x, ph.y, t: 0));
    for (var i = 0; i < 10; i++) {
      final ang = rng.nextDouble() * math.pi * 2;
      particles.add(Particle(
        ph.x,
        ph.y,
        math.cos(ang) * 220,
        math.sin(ang) * 220,
        life: 0.6 + rng.nextDouble() * 0.4,
      ));
    }
  }

  Vector2 slotCenter(int i) => Vector2(Design.trayX[i], Design.trayY);

  // =====================================================================
  //  Drag & drop (original "Dragging Blocks" group)
  // =====================================================================

  /// Finger position in design coordinates (tracked incrementally because
  /// flame 1.20's DragUpdateEvent.localEndPosition double-counts the delta).
  final Vector2 finger = Vector2.zero();

  void onDragStart(Vector2 p) {
    if (state != GameState.hud) return;
    if (dragSlot >= 0) return;
    pressedButton = null;
    finger.setFrom(p);
    for (var i = 0; i < 3; i++) {
      final slot = tray[i];
      if (slot == null || slot.placed) continue;
      if (dragReturnT >= 0 && i == returningSlot) continue;
      // Grab when the touch is within 120 design px of any block.
      final centers = _trayBlockCenters(i);
      var best = double.infinity;
      for (final c in centers) {
        final d = c.distanceTo(p);
        if (d < best) best = d;
      }
      if (best < 120) {
        dragSlot = i;
        final ph = slotCenter(i);
        dragDX = ph.x - p.x;
        dragPos.setFrom(ph);
        dragScale = 1;
        audio.sfxWhoosh();
        // Original hides the Tut layer while dragging.
        return;
      }
    }
  }

  int returningSlot = -1;

  List<Vector2> _trayBlockCenters(int slotIdx) {
    final slot = tray[slotIdx];
    if (slot == null) return const [];
    final shape = kShapes[slot.shapeIdx];
    final ph = slotCenter(slotIdx);
    final rows = shape.length;
    final cols = shape[0].length;
    final out = <Vector2>[];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (shape[r][c] == 0) continue;
        out.add(Vector2(
          ph.x + (c - (cols - 1) / 2) * Design.smallSize,
          ph.y + (r - (rows - 1) / 2) * Design.smallSize,
        ));
      }
    }
    return out;
  }

  void onDragDelta(Vector2 delta) {
    if (dragSlot < 0) return;
    finger.x += delta.x;
    finger.y += delta.y;
    // Original: ShapesParent follows the touch, lifted 200px above it.
    dragPos.setValues(finger.x + dragDX, finger.y - 200);
    _updateSnap();
  }

  void _updateSnap() {
    dragTargets = [];
    dragMarkedLines.clear();
    dragValid = false;
    final slot = dragSlot >= 0 ? tray[dragSlot] : null;
    if (slot == null) return;
    final shape = kShapes[slot.shapeIdx];
    final rows = shape.length;
    final cols = shape[0].length;
    final cells = <math.Point<int>>[];
    final seen = <math.Point<int>>{};
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (shape[r][c] == 0) continue;
        final bx = dragPos.x + (c - (cols - 1) / 2) * Design.bigSize;
        final by = dragPos.y + (r - (rows - 1) / 2) * Design.bigSize;
        final gx = ((bx - Design.gridOriginX) / Design.bigSize).round();
        final gy = ((by - Design.gridOriginY) / Design.bigSize).round();
        if (gx < 0 || gx >= Design.gridSize || gy < 0 || gy >= Design.gridSize) {
          return;
        }
        if (grid[gy][gx] != null) return;
        final cell = math.Point(gx, gy);
        if (seen.contains(cell)) return;
        if (tutorial.active && !tutorial.allowsTarget(gx, gy)) return;
        seen.add(cell);
        cells.add(cell);
      }
    }
    dragTargets = cells;
    dragValid = true;
    _markCompletedLines(cells);
  }

  /// Original "CheckRowsCols": during a valid drag, rows/columns that would
  /// be completed (counting the preview cells as filled) get marked, and the
  /// blocks in them are recolored to the dragged piece's color.
  void _markCompletedLines(List<math.Point<int>> targets) {
    final targetSet = targets.toSet();
    for (final t in targets) {
      // Row check
      var rowFull = true;
      for (var x = 0; x < Design.gridSize; x++) {
        final cell = math.Point(x, t.y);
        if (grid[t.y][x] == null && !targetSet.contains(cell)) {
          rowFull = false;
          break;
        }
      }
      if (rowFull) dragMarkedLines.add('R${t.y}');
      // Column check
      var colFull = true;
      for (var y = 0; y < Design.gridSize; y++) {
        final cell = math.Point(t.x, y);
        if (grid[y][t.x] == null && !targetSet.contains(cell)) {
          colFull = false;
          break;
        }
      }
      if (colFull) dragMarkedLines.add('C${t.x}');
    }
  }

  void onDragEnd() {
    if (dragSlot < 0) return;
    final slot = tray[dragSlot];
    if (slot == null) {
      dragSlot = -1;
      return;
    }
    if (dragValid && dragTargets.isNotEmpty) {
      _placeDraggedPiece(slot);
    } else {
      _returnPiece();
    }
    dragValid = false;
    dragMarkedLines.clear();
  }

  void _placeDraggedPiece(TraySlot slot) {
    final colorIdx = slot.colorIdx;
    final blockCount = dragTargets.length;
    for (final cell in dragTargets) {
      grid[cell.y][cell.x] = colorIdx;
      settleCells[cell] = 0;
    }
    slot.placed = true;
    putShapeCount++;
    dragSlot = -1;

    // Score: +blocks, animated count-up (original AddScore, 0.5s tween).
    score += blockCount;
    audio.sfxPut();

    final piecePos = dragPos.clone();
    final markedLines = Set<String>.of(dragMarkedLines);

    after(0.1, () {
      if (markedLines.isNotEmpty) {
        _runLineClears(markedLines, colorIdx, piecePos);
      } else {
        _onNoScoreMove();
      }
      after(0, _advanceFlow);
    });
  }

  void _returnPiece() {
    final slotIdx = dragSlot;
    dragSlot = -1;
    if (slotIdx < 0) return;
    returningSlot = slotIdx;
    dragReturnT = 0;
    returnFrom.setFrom(dragPos);
    audio.sfxReturn();
  }

  // =====================================================================
  //  Line clearing / combo / earned score (original groups "Lines",
  //  "Combo", "Combo Heart", "Score", "Best Score")
  // =====================================================================

  void _runLineClears(Set<String> markedLines, int colorIdx, Vector2 piecePos) {
    noScoreMoves = 0;
    // Original: AddCombo increments Combo first (-1 -> 0 on the first clear);
    // the EarnedScore expression then reads the INCREMENTED value and adds +1.
    combo += 1;
    final comboAfter = combo;
    comboHeartActive = 1;
    if (comboAfter > 1) heartVisible = true;

    final lines = markedLines.length;
    // Verified against the live game (63 / 186 / 550 tutorial sequence):
    // step1 Combo=0 -> 60, step2 Combo=1 -> 120, step3 Combo=2 -> 360.
    final lineMult = lines >= 2 ? lines - 1 : 1;
    final earnedScore = (comboAfter + 1) * 10 * lines * lineMult;
    audio.sfxScore(comboAfter);

    // Destroy blocks + spawn effects for each marked line (ClearLine).
    for (final line in markedLines) {
      _clearLine(line, colorIdx);
    }

    if (comboAfter == 0) {
      // First clear: the original's "Combo < 1" branch fires the earned-score
      // popup immediately (no combo glow yet).
      showEarnedScore(piecePos.x, piecePos.y, earnedScore, lines);
    } else {
      // Combo display (glow from the 2nd consecutive clear, counter + shake
      // from the 3rd), then the earned popup after 0.9s + 0.5s shrink.
      comboDisplay = ComboDisplay(comboAfter, lines, piecePos: piecePos.clone());
      if (comboAfter > 1) {
        doShake(5, 0.2);
      }
      after(1.4, () {
        showEarnedScore(piecePos.x, piecePos.y, earnedScore, lines);
      });
    }
  }

  void _clearLine(String line, int colorIdx) {
    final color = _blockColor(colorIdx);
    if (line.startsWith('R')) {
      final y = int.parse(line.substring(1));
      for (var x = 0; x < Design.gridSize; x++) {
        grid[y][x] = null;
      }
      lineFx.add(LineFx(
        horizontal: true,
        pos: Design.gridOriginY + y * Design.bigSize,
        color: color,
      ));
      // Original: the squares spawn after Wait(0.2).
      after(0.2, () {
        _spawnSquareEffects(
          Design.boardX,
          Design.gridOriginY + y * Design.bigSize,
          horizontal: true,
          color: color,
        );
      });
    } else {
      final x = int.parse(line.substring(1));
      for (var y = 0; y < Design.gridSize; y++) {
        grid[y][x] = null;
      }
      lineFx.add(LineFx(
        horizontal: false,
        pos: Design.gridOriginX + x * Design.bigSize,
        color: color,
      ));
      // Original: the squares spawn after Wait(0.2).
      after(0.2, () {
        _spawnSquareEffects(
          Design.gridOriginX + x * Design.bigSize,
          Design.boardY,
          horizontal: false,
          color: color,
        );
      });
    }
  }

  void _spawnSquareEffects(double x, double y,
      {required bool horizontal, required RgbColor color}) {
    // Original: For loopindex 1..10 (vSquareCount/2), TWO CreateSquareEffect
    // calls per iteration (one per direction along the line axis):
    //   spawn offset along the axis = (loopindex - 1) * 50
    //   perpendicular jitter        = random(-50, 50)
    //   displacement                = +/-220 along the axis, 0 perpendicular
    //   size                        = int(random(20, 50))
    //   movement duration           = random(1.5, 2.2) * 1.5  (linear)
    //   opacity                     = 100 -> 0 over 1s, destroy at end.
    // The 0.2s delay before spawning is applied by the caller (after(0.2,..)).
    for (var i = 1; i <= 10; i++) {
      final along = (i - 1) * 50.0;
      final j1 = rng.nextDouble() * 100 - 50;
      final j2 = rng.nextDouble() * 100 - 50;
      final s1 = 20 + rng.nextDouble() * 30;
      final s2 = 20 + rng.nextDouble() * 30;
      final d1 = (1.5 + rng.nextDouble() * 0.7) * 1.5;
      final d2 = (1.5 + rng.nextDouble() * 0.7) * 1.5;
      if (horizontal) {
        // Original "X" branch: fly +/-X, Y jitter.
        squares.add(SquareFx(x + along, y + j1, 220, 0, s1, color, d1));
        squares.add(SquareFx(x - along, y + j2, -220, 0, s2, color, d2));
      } else {
        // Original "Y" branch: fly +/-Y, X jitter.
        squares.add(SquareFx(x + j1, y + along, 0, 220, s1, color, d1));
        squares.add(SquareFx(x - j2, y - along, 0, -220, s2, color, d2));
      }
    }
  }

  void _onNoScoreMove() {
    // Original: 3 consecutive non-clearing moves with the combo heart active
    // resets the combo and hides the heart.
    if (comboHeartActive != 1) return;
    noScoreMoves++;
    if (noScoreMoves >= 3) {
      noScoreMoves = 0;
      combo = -1;
      comboHeartActive = 0;
      heartVisible = false;
    }
  }

  /// Original "ShowEarnedScore": adds the score, shows "+N", glow, and the
  /// Cheerful praise sprite (frame = lines) for multi-line clears.
  void showEarnedScore(double x, double y, int value, int lines) {
    score += value;
    earnedDisplay = EarnedDisplay(x, y, value, lines);
    if (lines >= 2) {
      audio.sfxCheerful(lines);
    }
  }

  void doShake(double distance, double duration) {
    shakeDistance = distance;
    shakeDuration = duration;
    shakeT = 0;
    shakeValue = distance;
  }

  // =====================================================================
  //  Flow after each placement (original post-Put sequence)
  // =====================================================================

  void _advanceFlow() {
    if (tutorial.active) {
      switch (tutorial.tutNum) {
        case 1:
          after(1.5, () {
            tutorial.startStep(2);
            _spawnTutorialPiece();
          });
          break;
        case 2:
          after(2.5, () {
            tutorial.startStep(3);
            _spawnTutorialPiece();
          });
          break;
        case 3:
          tutorial.tutNum = 0;
          putShapeCount = 0;
          storage.setTutCompleted();
          after(1.0, () => createShapes());
          break;
      }
      return;
    }
    if (putShapeCount >= 3) {
      putShapeCount = 0;
      final delay = lineFx.isNotEmpty ? 0.5 : 0.0;
      after(delay, () => createShapes());
    } else {
      if (!anyRemainingFits()) {
        gameOverStart();
      }
    }
  }

  // =====================================================================
  //  Game over / revive (original groups "Game Over" + "Revive")
  // =====================================================================

  void gameOverStart() {
    if (state == GameState.gameOver || state == GameState.waiting) return;
    state = GameState.waiting;
    audio.stopMusic();
    audio.sfxNoSpace();
    noSpaceBanner = NoSpaceBanner();
    after(1.0, _reviveOpen);
  }

  void _reviveOpen() {
    state = GameState.revive;
    revivePassed = 0;
    reviveText = Design.reviveTime;
    reviveRadial = 0;
    addTween(Tween(
      from: blackBgOpacity,
      to: 0.80,
      duration: 0.5,
      onUpdate: (v) => blackBgOpacity = v,
    ));
    after(1.0, _reviveTick);
  }

  void _reviveTick() {
    if (state != GameState.revive) return;
    if (revivePassed >= Design.reviveTime) {
      _showGameOverLayer();
      return;
    }
    revivePassed++;
    reviveText = Design.reviveTime - revivePassed;
    audio.sfxBeep();
    final target = (100 / Design.reviveTime) * revivePassed;
    addTween(Tween(
      from: reviveRadial,
      to: target,
      duration: 0.5,
      ease: Ease.easeOut,
      onUpdate: (v) => reviveRadial = v,
    ));
    after(1.0, _reviveTick);
  }

  void _showGameOverLayer() {
    state = GameState.gameOver;
    audio.sfxLose();
    goScoreShown = 0;
    addTween(Tween(
      from: 0,
      to: score.toDouble(),
      duration: 0.8,
      ease: Ease.easeOut,
      onUpdate: (v) => goScoreShown = v,
    ));
  }

  /// Original "ReviveGame": destroys the tray pieces (the original destroys
  /// the loose Block instances overlapping the PlaceHolders), resets the
  /// tray and deals a new set.
  void reviveNow() {
    if (state != GameState.revive) return;
    noSpaceBanner = null;
    audio.sfxRevive();
    addTween(Tween(
      from: blackBgOpacity,
      to: 0,
      duration: 0.5,
      onUpdate: (v) => blackBgOpacity = v,
    ));
    for (var i = 0; i < 3; i++) {
      tray[i] = null;
    }
    putShapeCount = 0;
    createShapes(revive: true);
    state = GameState.hud;
    audio.startMusic();
  }

  // =====================================================================
  //  Pause (original "Pause" group)
  // =====================================================================

  void pauseOpen() {
    if (state != GameState.hud) return;
    stateBeforePause = GameState.hud;
    state = GameState.pause;
    addTween(Tween(
      from: pausePopupY,
      to: Design.height / 2,
      duration: 0.5,
      ease: Ease.easeOut,
      onUpdate: (v) => pausePopupY = v,
    ));
    addTween(Tween(
      from: blackBgOpacity,
      to: 0.70,
      duration: 0.5,
      onUpdate: (v) => blackBgOpacity = v,
    ));
  }

  void pauseClose() {
    if (state != GameState.pause && state != GameState.ranking) return;
    state = GameState.hud;
    addTween(Tween(
      from: pausePopupY,
      to: -1500,
      duration: 0.5,
      ease: Ease.easeIn,
      onUpdate: (v) => pausePopupY = v,
    ));
    addTween(Tween(
      from: blackBgOpacity,
      to: 0,
      duration: 0.5,
      onUpdate: (v) => blackBgOpacity = v,
    ));
  }

  // =====================================================================
  //  Ranking (original GeneralSheet "Ranking" group)
  // =====================================================================

  Future<void> rankingOpen() async {
    rankingReturn = state;
    rankingData = await RankingData.load(storage.bestScore);
  }

  void rankingClose() {
    if (rankingReturn == GameState.home) {
      state = GameState.home;
    } else {
      state = GameState.pause;
    }
    rankingData = null;
  }

  // =====================================================================
  //  Update loop
  // =====================================================================

  @override
  void update(double dt) {
    super.update(dt);
    if (dt <= 0 || dt > 0.5) return;

    // Scheduled actions.
    final due = <Scheduled>[];
    _pending.removeWhere((s) {
      s.delay -= dt;
      if (s.delay <= 0) {
        due.add(s);
        return true;
      }
      return false;
    });
    for (final s in due) {
      s.action();
    }

    // Tweens.
    tweens.removeWhere((t) => t.update(dt));

    // Score counters chase their targets (smooth count-up).
    scoreShown += (score - scoreShown) * math.min(1, dt * 6);
    if ((score - scoreShown).abs() < 0.5) scoreShown = score.toDouble();
    if (score > storage.bestScore) {
      storage.setBestScore(score);
    }
    bestShown += (storage.bestScore - bestShown) * math.min(1, dt * 6);

    // Tray piece pop-ins (0.3s).
    for (final slot in tray) {
      if (slot != null && slot.popT < 1) {
        slot.popT = math.min(1, slot.popT + dt / 0.3);
      }
    }

    // Heart pulse (original: Sine behavior on Heart).
    if (heartVisible) {
      heartPulse += dt;
    }

    // Effects.
    for (final fx in lineFx) {
      fx.t += dt;
    }
    lineFx.removeWhere((fx) => fx.t > 1.0);
    for (final s in squares) {
      s.t += dt;
    }
    // Original: the 1s opacity tween carries the destroy flag, so the
    // particle is removed at 1s even though the movement tween is longer.
    squares.removeWhere((s) => s.t >= 1.0);
    for (final g in glowBursts) {
      g.t += dt;
    }
    glowBursts.removeWhere((g) => g.t > 0.4);
    for (final p in particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles.removeWhere((p) => p.t >= p.life);

    // Combo display lifecycle.
    final cd = comboDisplay;
    if (cd != null) {
      cd.t += dt;
      if (cd.t > 2.4) comboDisplay = null;
    }
    final ed = earnedDisplay;
    if (ed != null) {
      ed.t += dt;
      if (ed.t > 2.3) earnedDisplay = null;
    }
    final ns = noSpaceBanner;
    if (ns != null) {
      ns.t += dt;
    }

    // Drag piece scale-in.
    if (dragSlot >= 0) {
      dragScale = math.min(2.0, dragScale + dt * 8);
    }

    // Piece return animation (0.3s).
    if (dragReturnT >= 0) {
      dragReturnT += dt / 0.3;
      if (dragReturnT >= 1) {
        dragReturnT = -1;
        returningSlot = -1;
      }
    }

    // Settle animation (0.1s).
    final settledCells = <math.Point<int>>[];
    settleCells.forEach((cell, t) {
      if (t + dt / 0.1 >= 1) settledCells.add(cell);
    });
    for (final cell in settledCells) {
      settleCells.remove(cell);
    }
    if (settleCells.isNotEmpty) {
      final keys = settleCells.keys.toList();
      for (final cell in keys) {
        final t = settleCells[cell]!;
        settleCells[cell] = (t + dt / 0.1).clamp(0.0, 1.0);
      }
    }

    // Tutorial hint loop timing.
    if (tutorial.active && state == GameState.hud && dragSlot < 0) {
      tutHintT += dt;
    }

    // Screen shake decay.
    if (shakeValue > 0) {
      shakeT += dt;
      if (shakeT >= shakeDuration) {
        shakeValue = 0;
      } else {
        shakeValue = shakeDistance * (1 - shakeT / shakeDuration);
      }
    }
  }

  // =====================================================================
  //  Input from the canvas component
  // =====================================================================

  void handleTapDown(Vector2 p) {
    pressedButton = _buttonAt(p);
  }

  void handleTapUp(Vector2 p) {
    final btn = _buttonAt(p);
    final pressed = pressedButton;
    pressedButton = null;
    if (btn == null || btn != pressed) return;
    switch (btn) {
      case 'home_play':
        startGame();
        break;
      case 'home_ranking':
        rankingOpen();
        break;
      case 'home_music':
        storage.setMusic(!storage.musicOn);
        if (!storage.musicOn) audio.stopMusic();
        break;
      case 'home_sfx':
        storage.setSfx(!storage.sfxOn);
        break;
      case 'hud_pause':
        pauseOpen();
        break;
      case 'pause_close':
        pauseClose();
        break;
      case 'pause_music':
        storage.setMusic(!storage.musicOn);
        break;
      case 'pause_sfx':
        storage.setSfx(!storage.sfxOn);
        break;
      case 'pause_home':
        goHome();
        break;
      case 'pause_reset':
        startGame();
        break;
      case 'pause_ranking':
        rankingOpen();
        break;
      case 'revive_btn':
        reviveNow();
        break;
      case 'go_reset':
        startGame();
        break;
      case 'ranking_close':
        rankingClose();
        break;
    }
  }

  /// Hit-testing for every interactive button, per state — rects from the
  /// original layout instances (center-anchored).
  String? _buttonAt(Vector2 p) {
    switch (state) {
      case GameState.home:
        if (rankingData != null) {
          if (_contains(p, Design.lbCloseX, Design.lbCloseY,
              Design.lbCloseSize, Design.lbCloseSize)) {
            return 'ranking_close';
          }
          return null;
        }
        if (_contains(p, Design.btnPlayX, Design.btnPlayY, Design.btnPlayW,
            Design.btnPlayH)) {
          return 'home_play';
        }
        if (_contains(p, Design.btnPlayX, Design.homeBtnY, Design.homeBtnSize,
            Design.homeBtnSize)) {
          return 'home_ranking';
        }
        if (_contains(p, Design.homeMusicX, Design.homeBtnY, 170,
            Design.homeBtnSize)) {
          return 'home_music';
        }
        if (_contains(p, Design.homeSfxX, Design.homeBtnY, 170,
            Design.homeBtnSize)) {
          return 'home_sfx';
        }
        return null;
      case GameState.hud:
        if (_contains(p, Design.pauseBtnX, Design.pauseBtnY,
            Design.pauseBtnSize, Design.pauseBtnSize)) {
          return 'hud_pause';
        }
        return null;
      case GameState.pause:
        if (rankingData != null) {
          if (_contains(p, Design.lbCloseX, Design.lbCloseY,
              Design.lbCloseSize, Design.lbCloseSize)) {
            return 'ranking_close';
          }
          return null;
        }
        if (_contains(p, Design.btnCloseX, Design.btnCloseY,
            Design.btnCloseSize, Design.btnCloseSize)) {
          return 'pause_close';
        }
        if (_contains(p, Design.btnSfxX, Design.btnSfxY, Design.toggleW,
            Design.toggleH)) {
          return 'pause_sfx';
        }
        if (_contains(p, Design.btnMusicX, Design.btnMusicY, Design.toggleW,
            Design.toggleH)) {
          return 'pause_music';
        }
        if (_contains(p, Design.btnHomeX, Design.btnHomeY, Design.btnHomeW,
            Design.btnHomeH)) {
          return 'pause_home';
        }
        if (_contains(p, Design.btnResetX, Design.btnResetY, Design.btnResetW,
            Design.btnResetH)) {
          return 'pause_reset';
        }
        if (_contains(p, Design.btnShowRankingX, Design.btnShowRankingY,
            Design.btnShowRankingW, Design.btnShowRankingH)) {
          return 'pause_ranking';
        }
        return null;
      case GameState.revive:
        if (_contains(p, Design.btnReviveX, Design.btnReviveY,
            Design.btnReviveW, Design.btnReviveH)) {
          return 'revive_btn';
        }
        return null;
      case GameState.gameOver:
        if (_contains(p, Design.btnGOResetX, Design.btnGOResetY,
            Design.btnGOResetW, Design.btnGOResetH)) {
          return 'go_reset';
        }
        return null;
      case GameState.ranking:
        if (_contains(p, Design.lbCloseX, Design.lbCloseY, Design.lbCloseSize,
            Design.lbCloseSize)) {
          return 'ranking_close';
        }
        return null;
      default:
        return null;
    }
  }

  bool _contains(Vector2 p, double cx, double cy, double w, double h) {
    return p.x >= cx - w / 2 && p.x <= cx + w / 2 && p.y >= cy - h / 2 && p.y <= cy + h / 2;
  }

  RgbColor _blockColor(int colorIdx) => RgbColor.fromColor(colorIdx);
}

// =====================================================================
//  Data classes
// =====================================================================

class TraySlot {
  TraySlot(this.shapeIdx, this.colorIdx);

  TraySlot.fromPiece(Piece piece)
      : shapeIdx = kShapes.indexOf(piece.shape),
        colorIdx = piece.colorIdx;

  int shapeIdx;
  int colorIdx;
  bool placed = false;
  double popT = 0; // pop-in animation 0..1
}

class Scheduled {
  Scheduled(this.id, this.delay, this.action);
  final int id;
  double delay;
  final void Function() action;
}

class LineFx {
  LineFx({required this.horizontal, required this.pos, required this.color});
  final bool horizontal;
  final double pos; // y for horizontal lines, x for vertical
  final RgbColor color;
  double t = 0;
}

class SquareFx {
  /// 1:1 with the original CreateSquareEffect:
  /// - spawns at (x, y), tween-position to (x + vx, y + vy) over [dur]
  ///   with LINEAR easing (vx/vy are the full ±220 / 0 displacements);
  /// - opacity tween 100 -> 0 over 1s with destroy-on-finish, so the
  ///   particle is gone at t = 1 regardless of the longer movement tween;
  /// - size stays fixed (the original has no size tween).
  SquareFx(this.x, this.y, this.vx, this.vy, this.size, this.color, this.dur);
  final double x;
  final double y;
  final double vx;
  final double vy;
  final double size;
  final RgbColor color;
  final double dur;
  double t = 0; // age in seconds; destroyed at 1.0
}

class GlowBurst {
  GlowBurst(this.x, this.y, {this.t = 0});
  final double x;
  final double y;
  double t;
}

class Particle {
  Particle(this.x, this.y, this.vx, this.vy, {required this.life});
  double x;
  double y;
  final double vx;
  final double vy;
  final double life;
  double t = 0;
}

class ComboDisplay {
  ComboDisplay(this.combo, this.lines, {required this.piecePos});
  final int combo;
  final int lines;
  final Vector2 piecePos;
  double t = 0;
}

class EarnedDisplay {
  EarnedDisplay(this.x, this.y, this.value, this.lines);
  final double x;
  final double y;
  final int value;
  final int lines;
  double t = 0;
}

class NoSpaceBanner {
  double t = 0;
}

class RgbColor {
  RgbColor(this.r, this.g, this.b);
  factory RgbColor.fromColor(int blockFrameIdx) {
    const values = [
      (139, 95, 215),
      (54, 178, 225),
      (59, 180, 59),
      (72, 100, 231),
      (237, 182, 50),
      (237, 120, 33),
      (201, 49, 49),
      (211, 95, 215),
    ];
    final v = values[blockFrameIdx.clamp(0, 7)];
    return RgbColor(v.$1, v.$2, v.$3);
  }
  final int r;
  final int g;
  final int b;
}

/// Full-screen input & render surface living in the world (design coords).
class GameCanvas extends Component with TapCallbacks, DragCallbacks {
  GameCanvas(this.game);

  final BlockBlastGame game;

  @override
  bool containsLocalPoint(Vector2 point) => true;

  @override
  void onTapDown(TapDownEvent event) {
    super.onTapDown(event);
    game.handleTapDown(event.localPosition);
  }

  @override
  void onTapUp(TapUpEvent event) {
    super.onTapUp(event);
    game.handleTapUp(event.localPosition);
  }

  @override
  void onTapCancel(TapCancelEvent event) {
    super.onTapCancel(event);
    game.pressedButton = null;
  }

  @override
  void onDragStart(DragStartEvent event) {
    super.onDragStart(event);
    game.onDragStart(event.localPosition);
  }

  @override
  void onDragUpdate(DragUpdateEvent event) {
    super.onDragUpdate(event);
    // flame 1.20 bug: localEndPosition = position + delta (double-counted);
    // localDelta is correct — apply it incrementally.
    game.onDragDelta(event.localDelta);
  }

  @override
  void onDragEnd(DragEndEvent event) {
    super.onDragEnd(event);
    game.onDragEnd();
  }

  @override
  void onDragCancel(DragCancelEvent event) {
    super.onDragCancel(event);
    game.onDragEnd();
  }

  @override
  void render(Canvas canvas) {
    game.renderWorld(canvas);
  }
}
