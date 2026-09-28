import 'dart:math' as math;

import 'package:flame/components.dart';
import 'package:flutter/painting.dart';

import 'block_blast_game.dart';
import 'layout_constants.dart';
import 'shapes.dart';

/// All rendering — a visual 1:1 of the original layers:
/// Bg -> Shadow -> Game -> Tut -> HUD -> Pause -> Revive -> GameOver -> Ranking.
extension GameRendering on BlockBlastGame {
  void renderWorld(Canvas canvas) {
    _drawBackground(canvas);
    if (state == GameState.home) {
      _drawHome(canvas);
      _drawRankingOverlay(canvas);
      return;
    }
    _drawBoard(canvas);
    _drawTray(canvas);
    _drawTutorialHint(canvas);
    _drawHud(canvas);
    _drawBlackBg(canvas);
    _drawNoSpaceBanner(canvas);
    _drawReviveOverlay(canvas);
    _drawGameOverOverlay(canvas);
    _drawPauseOverlay(canvas);
    _drawRankingOverlay(canvas);
  }

  // =====================================================================
  //  Background (original: Bg tiled gradient + Responsive)
  // =====================================================================

  void _drawBackground(Canvas canvas) {
    final bg = sprites.get('Bg');
    bg.render(canvas, position: Vector2.zero(), size: Vector2(Design.width, Design.height));
  }

  // =====================================================================
  //  Board (original layer "Game")
  // =====================================================================

  void _drawBoard(Canvas canvas) {
    // Board sprite: 990x990 art at 1000x1000, center (540, 831).
    final board = sprites.get('Board');
    board.render(
      canvas,
      position: Vector2(Design.boardX - Design.boardSize / 2,
          Design.boardY - Design.boardSize / 2),
      size: Vector2(Design.boardSize, Design.boardSize),
    );

    // Spots (116x116 markers on the 120 grid).
    final spot = sprites.get('Spot');
    final spotSize = spot.srcSize;
    for (var y = 0; y < Design.gridSize; y++) {
      for (var x = 0; x < Design.gridSize; x++) {
        final cx = Design.gridOriginX + x * Design.bigSize;
        final cy = Design.gridOriginY + y * Design.bigSize;
        spot.render(
          canvas,
          position: Vector2(cx - spotSize.x / 2, cy - spotSize.y / 2),
          size: spotSize,
        );
      }
    }

    // Drag preview: BlockBelow (30% opacity, piece color) on target cells.
    if (dragSlot >= 0 && dragValid && dragTargets.isNotEmpty) {
      final slot = tray[dragSlot]!;
      final preview = sprites.get('BlockBelow', frame: slot.colorIdx);
      final previewPaint = Paint()..color = const Color(0x4DFFFFFF);
      canvas.saveLayer(null, previewPaint);
      for (final cell in dragTargets) {
        final cx = Design.gridOriginX + cell.x * Design.bigSize;
        final cy = Design.gridOriginY + cell.y * Design.bigSize;
        preview.render(
          canvas,
          position: Vector2(cx - Design.bigSize / 2, cy - Design.bigSize / 2),
          size: Vector2(Design.bigSize, Design.bigSize),
        );
      }
      canvas.restore();
    }

    // Placed blocks. Blocks in lines marked during the drag render in the
    // dragged piece's color (original CheckRowsCols recoloring).
    final draggingSlot = dragSlot >= 0 ? tray[dragSlot] : null;
    for (var y = 0; y < Design.gridSize; y++) {
      for (var x = 0; x < Design.gridSize; x++) {
        var colorIdx = grid[y][x];
        if (colorIdx == null) continue;
        if (draggingSlot != null && dragValid) {
          final inMarkedRow = dragMarkedLines.contains('R$y');
          final inMarkedCol = dragMarkedLines.contains('C$x');
          if (inMarkedRow || inMarkedCol) {
            colorIdx = draggingSlot.colorIdx;
          }
        }
        final block = sprites.get('Block', frame: colorIdx);
        var cx = Design.gridOriginX + x * Design.bigSize;
        var cy = Design.gridOriginY + y * Design.bigSize;
        // Settle animation: tiny pop when the piece lands (0.1s).
        final settle = settleCells[math.Point(x, y)];
        if (settle != null && settle < 1) {
          final s = 0.9 + 0.1 * settle;
          canvas.save();
          canvas.translate(cx, cy);
          canvas.scale(s, s);
          canvas.translate(-cx, -cy);
        }
        block.render(
          canvas,
          position: Vector2(cx - Design.bigSize / 2, cy - Design.bigSize / 2),
          size: Vector2(Design.bigSize, Design.bigSize),
        );
        if (settle != null && settle < 1) {
          canvas.restore();
        }
      }
    }

    // Line clear effects (LineEffect + GlowEffect bars).
    for (final fx in lineFx) {
      _drawLineEffect(canvas, fx);
    }

    // Square particles — 1:1 with the original CreateSquareEffect:
    // linear movement from the spawn point toward (spawn + v) over [dur],
    // opacity 100 -> 0 over exactly 1s (destroy at 1s), fixed size.
    final squarePaint = Paint();
    for (final s in squares) {
      final moveFrac = (s.t / s.dur).clamp(0.0, 1.0);
      final alpha = (1 - s.t).clamp(0.0, 1.0);
      squarePaint.color = Color.fromRGBO(s.color.r, s.color.g, s.color.b, alpha);
      canvas.drawRect(
        Rect.fromCenter(
          center: _off(s.x + s.vx * moveFrac, s.y + s.vy * moveFrac),
          width: s.size,
          height: s.size,
        ),
        squarePaint,
      );
    }

    // Spawn particles (white-ish dots from piece creation).
    for (final p in particles) {
      final alpha = (1 - p.t / p.life).clamp(0.0, 1.0);
      squarePaint.color = Color.fromRGBO(255, 255, 255, alpha * 0.8);
      canvas.drawCircle(_off(p.x, p.y), 6 * (1 - p.t / p.life) + 2, squarePaint);
    }

    // Circle glow bursts at piece spawn (original CircleGlow: scale 0 -> 300,
    // opacity 0 -> 30).
    for (final g in glowBursts) {
      final t = (g.t / 0.4).clamp(0.0, 1.0);
      final radius = 300 * t;
      final alpha = 30 * (1 - t) / 100;
      final paint = Paint()
        ..color = const Color(0xFFFFFFFF).withOpacity(alpha)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 30);
      canvas.drawCircle(_off(g.x, g.y), radius, paint);
    }
  }

  /// Original LineEffect: colored ninepatch bar sweeping the cleared line —
  /// opacity 30 -> 100, width -> board-45, then height -> 120, then fade out.
  void _drawLineEffect(Canvas canvas, LineFx fx) {
    final t = fx.t;
    final length = (Design.boardSize - 45) * math.min(1.0, t / 0.1);
    var opacity = 0.30 + 0.70 * math.min(1.0, t / 0.1);
    var height = 25.0;
    if (t > 0.1 && t < 0.3) {
      height = 25 + (Design.bigSize - 25) * ((t - 0.1) / 0.08).clamp(0.0, 1.0);
    } else if (t >= 0.3) {
      height = Design.bigSize.toDouble();
      opacity = (1 - (t - 0.3) / 0.2).clamp(0.0, 1.0);
    }
    if (opacity <= 0) return;
    final paint = Paint()..color = Color.fromRGBO(fx.color.r, fx.color.g, fx.color.b, opacity);
    final glow = Paint()
      ..color = Color.fromRGBO(fx.color.r, fx.color.g, fx.color.b, opacity * 0.5)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 24);
    if (fx.horizontal) {
      final y = fx.pos;
      final rect = Rect.fromCenter(
        center: _off(Design.boardX, y),
        width: length,
        height: height,
      );
      canvas.drawRRect(RRect.fromRectAndRadius(rect, const Radius.circular(12)), glow);
      canvas.drawRRect(RRect.fromRectAndRadius(rect, const Radius.circular(12)), paint);
    } else {
      final x = fx.pos;
      final rect = Rect.fromCenter(
        center: _off(x, Design.boardY),
        width: height,
        height: length,
      );
      canvas.drawRRect(RRect.fromRectAndRadius(rect, const Radius.circular(12)), glow);
      canvas.drawRRect(RRect.fromRectAndRadius(rect, const Radius.circular(12)), paint);
    }
  }

  // =====================================================================
  //  Tray (original: PlaceHolders + pieces with shadows)
  // =====================================================================

  void _drawTray(Canvas canvas) {
    for (var i = 0; i < 3; i++) {
      final ph = slotCenter(i);
      // PlaceHolder art at 20% opacity (original instance color alpha).
      final phSprite = sprites.get('PlaceHolder');
      canvas.saveLayer(
        Rect.fromCenter(center: _off(ph.x, ph.y), width: Design.phSize + 8, height: Design.phSize + 8),
        Paint()..color = const Color(0x33FFFFFF),
      );
      phSprite.render(
        canvas,
        position: Vector2(ph.x - Design.phSize / 2, ph.y - Design.phSize / 2),
        size: Vector2(Design.phSize, Design.phSize),
      );
      canvas.restore();

      final slot = tray[i];
      if (slot == null || slot.placed) continue;
      if (i == dragSlot) continue; // drawn separately on top

      // Returning animation (0.3s, ease-out) + pop-in scale.
      var center = ph;
      var scale = 1.0;
      if (dragReturnT >= 0 && i == returningSlot) {
        final t = dragReturnT.clamp(0.0, 1.0);
        final eased = 1 - (1 - t) * (1 - t);
        center = Vector2(
          returnFrom.x + (ph.x - returnFrom.x) * eased,
          returnFrom.y + (ph.y - returnFrom.y) * eased,
        );
        scale = 2.0 - eased; // shrink back to tray size
      } else if (slot.popT < 1) {
        scale = slot.popT; // pop-in (0.3s, advanced in update)
      }
      _drawPiece(canvas, slot, center, scale, withShadow: true);
    }

    // Dragged piece on top, big cells, no shadow (original hides shadows
    // while dragging).
    if (dragSlot >= 0) {
      final slot = tray[dragSlot];
      if (slot != null) {
        _drawPiece(canvas, slot, dragPos, dragScale, withShadow: false);
      }
    }
  }

  /// Draws a piece's blocks with cells of [cell] px centered on [center].
  void _drawPiece(Canvas canvas, TraySlot slot, Vector2 center, double scale,
      {required bool withShadow}) {
    final shape = kShapes[slot.shapeIdx];
    final rows = shape.length;
    final cols = shape[0].length;
    final cell = Design.smallSize * scale;
    final block = sprites.get('Block', frame: slot.colorIdx);
    final shadow = sprites.get('BlockShadow');
    final shadowOff = cell * 0.13; // original 8px offset on 60px blocks
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (shape[r][c] == 0) continue;
        final cx = center.x + (c - (cols - 1) / 2) * cell;
        final cy = center.y + (r - (rows - 1) / 2) * cell;
        if (withShadow) {
          shadow.render(
            canvas,
            position: Vector2(cx - cell / 2 + shadowOff, cy - cell / 2 + shadowOff),
            size: Vector2(cell, cell),
          );
        }
        block.render(
          canvas,
          position: Vector2(cx - cell / 2, cy - cell / 2),
          size: Vector2(cell, cell),
        );
      }
    }
  }

  // =====================================================================
  //  Tutorial hint (original layer "Tut": Hand + TutBlock ghost)
  // =====================================================================

  void _drawTutorialHint(Canvas canvas) {
    if (!tutorial.active || state != GameState.hud) return;
    if (dragSlot >= 0) return;
    final slot = tray[1];
    if (slot == null || slot.placed) return;

    // Hint cycle: move the ghost from the tray to the target, fade, repeat.
    final cycle = tutHintT % 2.2;
    var moveT = 0.0;
    var fade = 1.0;
    if (cycle < 0.5) {
      moveT = cycle / 0.5;
    } else if (cycle < 0.7) {
      moveT = 1;
    } else if (cycle < 1.0) {
      moveT = 1;
      fade = 1 - (cycle - 0.7) / 0.3;
    } else {
      return; // pause before recreating the hand (original 1.2s timer)
    }

    // Target cell for the current step.
    math.Point<int>? target;
    if (tutorial.tutNum == 1) target = const math.Point(4, 4);
    if (tutorial.tutNum == 2) target = const math.Point(4, 4);
    if (tutorial.tutNum == 3) target = const math.Point(3, 3);
    if (target == null) return;

    final ph = slotCenter(1);
    final tx = Design.gridOriginX + target.x * Design.bigSize;
    final ty = Design.gridOriginY + target.y * Design.bigSize;
    final eased = 1 - (1 - moveT) * (1 - moveT);
    final gx = ph.x + (tx - ph.x) * eased;
    final gy = ph.y + (ty - ph.y) * eased;
    final scale = 1 + eased; // small -> big

    canvas.saveLayer(null, Paint()..color = Color.fromRGBO(255, 255, 255, fade));
    // Ghost piece (TutBlock, 50% opacity).
    canvas.saveLayer(null, Paint()..color = const Color(0x80FFFFFF));
    _drawPiece(canvas, slot, Vector2(gx, gy), scale, withShadow: false);
    canvas.restore();
    // Hand sprite, hotspot near top-left (original 0.088, 0.098).
    final hand = sprites.get('Hand');
    final handSize = hand.srcSize;
    hand.render(
      canvas,
      position: Vector2(gx - handSize.x * 0.09, gy - handSize.y * 0.10),
      size: handSize,
    );
    canvas.restore();
  }

  // =====================================================================
  //  HUD (original layer "HUD")
  // =====================================================================

  void _drawHud(Canvas canvas) {
    if (state == GameState.home) return;

    // Heart behind the score (original Heart at (540, 210), Sine pulse).
    if (heartVisible) {
      final heart = sprites.get('Heart');
      final pulse = 1 + 0.08 * math.sin(heartPulse * 6.4);
      final s = Design.heartSize * pulse;
      heart.render(
        canvas,
        position: Vector2(Design.heartX - s / 2, Design.heartY - s / 2),
        size: Vector2(s, s),
      );
    }

    // Score (bitmap font, natural size).
    scoreFont.drawCentered(
      canvas,
      scoreShown.toInt().toString(),
      Design.width / 2,
      Design.txtScoreY,
    );

    // Best score: cup + digits (left-anchored at 158).
    final cup = sprites.get('CupIcon');
    cup.render(
      canvas,
      position: Vector2(Design.cupX - Design.cupSize / 2, Design.cupY - Design.cupSize / 2),
      size: Vector2(Design.cupSize, Design.cupSize),
    );
    final bestText = bestShown.toInt().toString();
    final bestW = scoreFont.measureWidth(bestText);
    scoreFont.drawCentered(
      canvas,
      bestText,
      Design.bestScoreX + bestW / 2,
      Design.bestScoreY,
    );

    // Pause button.
    final pause = sprites.get('BtnPause');
    _drawSpriteCentered(canvas, pause, Design.pauseBtnX, Design.pauseBtnY,
        Design.pauseBtnSize, Design.pauseBtnSize);

    // Combo display (original "Combo" group).
    _drawComboDisplay(canvas);

    // Earned score popup (original "ShowEarnedScore").
    _drawEarnedDisplay(canvas);
  }

  void _drawComboDisplay(Canvas canvas) {
    final cd = comboDisplay;
    if (cd == null) return;
    final t = cd.t;
    // Appear 0..0.5s (scale to 1.4x image, opacity 0->100), hold, shrink
    // from 0.9s (0.5s), gone at 1.4s.
    double scale;
    double opacity;
    if (t < 0.3) {
      scale = 1.4 * _easeOutBack(t / 0.3);
      opacity = t / 0.3;
    } else if (t < 0.9) {
      scale = 1.4;
      opacity = 1;
    } else {
      final st = (t - 0.9) / 0.5;
      scale = 1.4 * (1 - st);
      opacity = 1 - st;
    }
    if (opacity <= 0 || scale <= 0) return;

    final glow = sprites.get('ComboSprite');
    final gw = glow.srcSize.x * scale;
    final gh = glow.srcSize.y * scale;
    canvas.saveLayer(null, Paint()..color = Color.fromRGBO(255, 255, 255, opacity));
    glow.render(canvas, position: Vector2(540 - gw / 2, 960 - gh / 2), size: Vector2(gw, gh));

    if (cd.combo > 1) {
      // Combo counter (txtComboNum, digits only), scale 0 -> 1.7, placed to
      // the right of the glow (original: ComboSprite.BBoxRight + TextWidth/2).
      final textScale = math.min(1.0, t / 0.3);
      final s = 1.7 * textScale;
      final textW = comboFont.measureWidth('${cd.combo}', scale: s * 0.7);
      comboFont.drawCentered(
        canvas,
        '${cd.combo}',
        540 + gw / 2 + textW / 2,
        960,
        scale: s * 0.7,
      );
    }
    canvas.restore();
  }

  void _drawEarnedDisplay(Canvas canvas) {
    final ed = earnedDisplay;
    if (ed == null) return;
    final t = ed.t;
    double scale;
    double opacity;
    if (t < 0.3) {
      scale = 1.2 * _easeOutBack(t / 0.3);
      opacity = t / 0.3;
    } else if (t < 1.0) {
      scale = 1.2;
      opacity = 1;
    } else {
      final ft = (t - 1.0) / 0.3;
      scale = 1.2 * (1 - ft);
      opacity = 1 - ft;
    }
    if (opacity <= 0) return;

    final glow = sprites.get('EarnedScoreGlow');
    final gw = glow.srcSize.x * scale;
    final gh = glow.srcSize.y * scale;
    canvas.saveLayer(null, Paint()..color = Color.fromRGBO(255, 255, 255, opacity));
    glow.render(
      canvas,
      position: Vector2(ed.x - gw / 2, ed.y - gh / 2),
      size: Vector2(gw, gh),
    );
    earnedFont.drawCentered(
      canvas,
      '+${ed.value}',
      ed.x,
      ed.y,
      scale: scale * 0.9,
    );

    // Cheerful praise (frame = lines, only for 2+ lines).
    if (ed.lines >= 2) {
      final frame = ed.lines.clamp(2, 6);
      final cheerful = sprites.get('Cheerful', frame: frame);
      final cw = cheerful.srcSize.x * scale;
      final ch = cheerful.srcSize.y * scale;
      cheerful.render(
        canvas,
        position: Vector2(ed.x - cw / 2, ed.y + 150 - ch / 2),
        size: Vector2(cw, ch),
      );
    }
    canvas.restore();
  }

  // =====================================================================
  //  Overlays
  // =====================================================================

  void _drawBlackBg(Canvas canvas) {
    if (blackBgOpacity <= 0.01) return;
    final paint = Paint()..color = const Color(0xFF0E1626).withOpacity(blackBgOpacity);
    canvas.drawRect(
      const Rect.fromLTWH(0, 0, Design.width, Design.height),
      paint,
    );
  }

  void _drawNoSpaceBanner(Canvas canvas) {
    final ns = noSpaceBanner;
    if (ns == null) return;
    final t = ns.t.clamp(0.0, 1.0);
    final scale = _easeOutBack((t / 0.3).clamp(0.0, 1.0));
    final opacity = (t / 0.3).clamp(0.0, 1.0);
    final banner = sprites.get('NoSpaceLeft');
    final w = Design.noSpaceW * scale;
    final h = Design.noSpaceH * scale;
    canvas.saveLayer(null, Paint()..color = Color.fromRGBO(255, 255, 255, opacity));
    banner.render(
      canvas,
      position: Vector2(Design.noSpaceX - w / 2, Design.noSpaceY - h / 2),
      size: Vector2(w, h),
    );
    canvas.restore();
  }

  void _drawReviveOverlay(Canvas canvas) {
    if (state != GameState.revive) return;

    final circle = sprites.get('ReviveCircle');
    _drawSpriteCentered(
      canvas, circle, Design.reviveCircleX, Design.reviveCircleY,
      Design.reviveCircleSize, Design.reviveCircleSize,
    );

    // Radial progress arc (original RadialProgress behavior, 0..100).
    if (reviveRadial > 0) {
      final rect = Rect.fromCenter(
        center: _off(Design.reviveCircleX, Design.reviveCircleY),
        width: Design.reviveCircleSize - 24,
        height: Design.reviveCircleSize - 24,
      );
      final paint = Paint()
        ..color = const Color(0xFFFFC93C)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 26
        ..strokeCap = StrokeCap.round;
      canvas.drawArc(rect, -math.pi / 2, math.pi * 2 * reviveRadial / 100, false, paint);
    }

    // Countdown number (big bitmap digits).
    scoreFont.drawCentered(
      canvas,
      reviveText.toString(),
      Design.reviveCircleX,
      Design.reviveCircleY,
      scale: 2.0,
    );

    final btn = sprites.get('BtnRevive');
    _drawSpriteCentered(
      canvas, btn, Design.btnReviveX, Design.btnReviveY,
      Design.btnReviveW, Design.btnReviveH,
    );
  }

  void _drawGameOverOverlay(Canvas canvas) {
    if (state != GameState.gameOver) return;

    // Light blue backdrop (original LightBlueBg 1277x2094 at (540,995)).
    final bg = sprites.get('LightBlueBg');
    final bw = 1277.0, bh = 2094.0;
    bg.render(
      canvas,
      position: Vector2(540 - bw / 2, 995 - bh / 2),
      size: Vector2(bw, bh),
    );

    // "Game Over" banner.
    final banner = sprites.get('GameOver');
    _drawSpriteCentered(
      canvas, banner, Design.goBannerX, Design.goBannerY, Design.goBannerW, Design.goBannerH,
    );

    // Labels: "Score" (frame 0) and "Best Score" (frame 1).
    final labelScore = sprites.get('TLabel', frame: 0);
    _drawSpriteCentered(
      canvas, labelScore, 540, Design.goScoreLabelY, 146, 45,
    );
    final labelBest = sprites.get('TLabel', frame: 1);
    _drawSpriteCentered(
      canvas, labelBest, 540, Design.goBestLabelY, 262, 45,
    );

    // Big score with count-up.
    scoreFont.drawCentered(
      canvas,
      goScoreShown.toInt().toString(),
      540,
      Design.goScoreY,
      scale: 1.55,
    );

    // Cup + best (left-anchored group at (482, 1223)).
    final cup = sprites.get('CupIcon');
    _drawSpriteCentered(
      canvas, cup, Design.goCupX, Design.goCupY, Design.goCupSize, Design.goCupSize,
    );
    final bestText = storage.bestScore.toString();
    final bestW = scoreFont.measureWidth(bestText);
    scoreFont.drawCentered(
      canvas,
      bestText,
      Design.goBestX + bestW / 2,
      Design.goBestY,
    );

    // Play again button.
    final btn = sprites.get('BtnGOReset');
    _drawSpriteCentered(
      canvas, btn, Design.btnGOResetX, Design.btnGOResetY, Design.btnGOResetW, Design.btnGOResetH,
    );
  }

  void _drawPauseOverlay(Canvas canvas) {
    if (state != GameState.pause && state != GameState.ranking) return;
    if (state == GameState.ranking && rankingReturn == GameState.home) return;

    // PausePopup art at (540, pausePopupY) — slides in from the top.
    final popup = sprites.get('PausePopup');
    _drawSpriteCentered(
      canvas, popup, Design.pausePopupX, pausePopupY, Design.pausePopupW, Design.pausePopupH,
    );

    // Buttons (only meaningful once the popup is on screen).
    if (pausePopupY > 300) {
      _drawSpriteCentered(canvas, sprites.get('BtnClose'),
          Design.btnCloseX, Design.btnCloseY, Design.btnCloseSize, Design.btnCloseSize);
      final sfxFrame = storage.sfxOn ? 0 : 1;
      _drawSpriteCentered(canvas, sprites.get('BtnSFX', frame: sfxFrame),
          Design.btnSfxX, Design.btnSfxY, Design.toggleW, Design.toggleH);
      final musicFrame = storage.musicOn ? 0 : 1;
      _drawSpriteCentered(canvas, sprites.get('BtnMusic', frame: musicFrame),
          Design.btnMusicX, Design.btnMusicY, Design.toggleW, Design.toggleH);
      _drawSpriteCentered(canvas, sprites.get('BtnHome'),
          Design.btnHomeX, Design.btnHomeY, Design.btnHomeW, Design.btnHomeH);
      _drawSpriteCentered(canvas, sprites.get('BtnReset'),
          Design.btnResetX, Design.btnResetY, Design.btnResetW, Design.btnResetH);
      _drawSpriteCentered(canvas, sprites.get('BtnShowRanking'),
          Design.btnShowRankingX, Design.btnShowRankingY,
          Design.btnShowRankingW, Design.btnShowRankingH);
    }
  }

  void _drawRankingOverlay(Canvas canvas) {
    if (rankingData == null) return;
    if (state != GameState.ranking && rankingReturn != GameState.home &&
        state != GameState.home && state != GameState.pause) {
      return;
    }
    final data = rankingData!;
    final popup = sprites.get('LeaderboardPopup2');
    _drawSpriteCentered(
      canvas, popup, Design.lbPopupX, Design.lbPopupY, Design.lbPopupW, Design.lbPopupH,
    );

    // Title.
    _drawText(canvas, 'Ranking', 540, Design.lbTitleY, 64, const Color(0xFF212121));

    // Rows.
    final rows = data.topRows;
    for (var i = 0; i < rows.length; i++) {
      final entry = rows[i];
      final y = Design.lbRowStartY + i * Design.lbRowStep;
      final isYou = entry.name == 'You';
      final itemBg = sprites.get('ItemBg', frame: isYou ? 1 : 0);
      _drawSpriteCentered(canvas, itemBg, 540, y, Design.lbRowW, Design.lbRowH);
      final dark = const Color(0xFF212121);
      final rank = isYou && !data.youInTopRows ? data.displayRankFor(i) : i + 1;
      _drawText(canvas, '$rank', 540 - Design.lbRowW / 2 + 60, y, 36, dark,
          alignLeft: true);
      _drawText(canvas, entry.name, 540 - Design.lbRowW / 2 + 180, y, 36, dark,
          alignLeft: true);
      _drawText(canvas, '${entry.score}', 540 + Design.lbRowW / 2 - 30, y, 36, dark,
          alignLeft: false);
    }

    final close = sprites.get('BtnClose');
    _drawSpriteCentered(
      canvas, close, Design.lbCloseX, Design.lbCloseY, Design.lbCloseSize, Design.lbCloseSize,
    );
  }

  // =====================================================================
  //  Home screen (original Home layout)
  // =====================================================================

  void _drawHome(Canvas canvas) {
    // LightBlueBg backdrop.
    final bg = sprites.get('LightBlueBg');
    final bw = 1277.0, bh = 2094.0;
    bg.render(
      canvas,
      position: Vector2(540 - bw / 2, 960 - bh / 2),
      size: Vector2(bw, bh),
    );

    // Logo (Sprite2, the original title art).
    final logo = sprites.get('Sprite2');
    _drawSpriteCentered(
      canvas, logo, Design.logoX, Design.logoY, Design.logoW, Design.logoH,
    );

    // Play button.
    final play = sprites.get('BtnPlay');
    _drawSpriteCentered(
      canvas, play, Design.btnPlayX, Design.btnPlayY, Design.btnPlayW, Design.btnPlayH,
    );

    // Round buttons: ranking (cup), music, sfx.
    final ranking = sprites.get('BtnRanking');
    _drawSpriteCentered(
      canvas, ranking, 540, Design.homeBtnY, Design.homeBtnSize, Design.homeBtnSize,
    );
    final musicFrame = storage.musicOn ? 0 : 1;
    final music = sprites.get('BtnMusic2', frame: musicFrame);
    _drawSpriteCentered(
      canvas, music, Design.homeMusicX, Design.homeBtnY, Design.homeBtnSize, Design.homeBtnSize,
    );
    final sfxFrame = storage.sfxOn ? 0 : 1;
    final sfx = sprites.get('BtnSFX2', frame: sfxFrame);
    _drawSpriteCentered(
      canvas, sfx, Design.homeSfxX, Design.homeBtnY, Design.homeBtnSize, Design.homeBtnSize,
    );
  }

  // =====================================================================
  //  Helpers
  // =====================================================================

  void _drawSpriteCentered(
      Canvas canvas, Sprite sprite, double cx, double cy, double w, double h) {
    sprite.render(canvas, position: Vector2(cx - w / 2, cy - h / 2), size: Vector2(w, h));
  }

  void _drawText(Canvas canvas, String text, double x, double y, double size,
      Color color,
      {bool alignLeft = true}) {
    final tp = _textPainter(text, size, color);
    final dx = alignLeft ? x : x - tp.width;
    tp.paint(canvas, Offset(dx, y - tp.height / 2));
  }

  TextPainter _textPainter(String text, double size, Color color) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: color,
          fontSize: size,
          fontWeight: FontWeight.w700,
          fontFamily: 'Roboto',
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    return tp;
  }

  Offset _off(double x, double y) => Offset(x, y);

  double _easeOutBack(double t) {
    final c1 = 1.70158;
    final c3 = c1 + 1;
    final p = t - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  }
}
