import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/services.dart' show rootBundle;

import 'layout_constants.dart';

/// Leaderboard data — 1:1 port of the original "Ranking" event group.
///
/// The original loads `ranking.json` via AJAX, then decays/boosts each entry:
///   score + int((1100 - (targetDate - now) / 86400000) * 8.5 * (index+1))
/// with targetDate = 1757653239000 ms (2025-09-12), using the C3 Date
/// plugin's Difference(first, second) = second - first. The player's own
/// score ("You") is inserted without any bonus, everything is sorted
/// descending and the top 10 rows are shown.
class RankingData {
  RankingData._({
    required this.entries,
  });

  final List<RankingEntry> entries;

  static const int _targetMs = 1757653239000;

  static Future<RankingData> load(int yourBestScore) async {
    List<RankingEntry> base = [];
    try {
      final raw = await rootBundle.loadString('assets/data/ranking.json');
      final data = jsonDecode(raw) as Map<String, dynamic>;
      final list = data['Ranking'] as List<dynamic>;
      final now = DateTime.now().millisecondsSinceEpoch;
      for (var i = 0; i < list.length; i++) {
        final e = list[i] as Map<String, dynamic>;
        final name = e['Name'] as String;
        final best = (e['Best'] as num).toInt();
        // Original formula (see class docs).
        final days = (_targetMs - now) / 86400000.0;
        final bonus = ((1100 - days) * (8.5 * (i + 1))).toInt();
        base.add(RankingEntry(name, best + bonus));
      }
    } catch (_) {
      base = const [];
    }
    // Remove any previous "You", insert the player, sort descending.
    base.removeWhere((e) => e.name == 'You');
    base.add(RankingEntry('You', yourBestScore));
    base.sort((a, b) => b.score.compareTo(a.score));
    return RankingData._(entries: base);
  }

  /// The 10 rows to display (may be fewer if data was unavailable).
  List<RankingEntry> get topRows => entries.take(10).toList(growable: false);

  /// Whether "You" is inside the visible top 10.
  bool get youInTopRows => entries.take(10).any((e) => e.name == 'You');

  /// The player's position in the full sorted list (1-based).
  int get yourRank {
    final idx = entries.indexWhere((e) => e.name == 'You');
    return idx < 0 ? entries.length : idx + 1;
  }

  /// Display rank for row [i] — mirrors the original's special case: when the
  /// 10th row is "You" and the player is below the top 10, the original shows
  /// a computed rank (at least 10).
  int displayRankFor(int row) {
    final entry = topRows[row];
    if (entry.name == 'You' && !youInTopRows) {
      // Original: max(10, int((LB[8] - Best) / (LB[8] / LastRank)))
      return math.max(10, yourRank);
    }
    return row + 1;
  }

  double get rowY => Design.lbRowStartY;
}

class RankingEntry {
  const RankingEntry(this.name, this.score);
  final String name;
  final int score;
}
