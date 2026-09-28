/// Exact geometry constants of the original Block Blast (Construct 3).
///
/// The original project uses a fixed 1080x1920 design. All values below were
/// extracted from data.json (layout instances) and verified against the live
/// game (pixel measurements at scale 0.3889, fit-width letterboxed).
///
/// Grid derivation (matches the original's CreateSpots + PutSpotsCenter
/// re-parenting math):
///   Board sprite: center (540, 831), size 1000x1000  ->  spans 40..1040, 331..1331
///   Spot(x, y) center = (120 + 120x, 411 + 120y)     ->  grid spans 62..1018, 353..1309
class Design {
  Design._();

  static const double width = 1080;
  static const double height = 1920;

  // === Board & grid ===
  static const double boardX = 540;
  static const double boardY = 831;
  static const double boardSize = 1000;
  static const double bigSize = 120; // cell size on the board (BigSize)
  static const double smallSize = 60; // cell size in the tray (SmallSize)
  static const double gridOriginX = 120; // spot(0,0) center x
  static const double gridOriginY = 411; // spot(0,0) center y
  static const int gridSize = 8;

  // === Tray (PlaceHolders) ===
  static const double trayY = 1626;
  static const double phSize = 250;
  static const List<double> trayX = [196.5, 539.5, 883.5];

  // === HUD ===
  static const double txtScoreY = 211.5;
  static const double cupX = 97;
  static const double cupY = 76;
  static const double cupSize = 104;
  static const double bestScoreX = 158;
  static const double bestScoreY = 82;
  static const double pauseBtnX = 974;
  static const double pauseBtnY = 88;
  static const double pauseBtnSize = 100;
  static const double heartX = 540;
  static const double heartY = 210;
  static const double heartSize = 240;

  // === Pause popup (layer positions, center-anchored) ===
  static const double pausePopupX = 540;
  static const double pausePopupY = 960.5;
  static const double pausePopupW = 886;
  static const double pausePopupH = 1113;
  static const double btnCloseX = 899;
  static const double btnCloseY = 482;
  static const double btnCloseSize = 80;
  static const double btnSfxX = 794;
  static const double btnSfxY = 654;
  static const double btnMusicX = 794;
  static const double btnMusicY = 817;
  static const double toggleW = 210;
  static const double toggleH = 100;
  static const double btnHomeX = 761;
  static const double btnHomeY = 994;
  static const double btnHomeW = 282;
  static const double btnHomeH = 115;
  static const double btnResetX = 761;
  static const double btnResetY = 1164;
  static const double btnResetW = 282;
  static const double btnResetH = 116;
  static const double btnShowRankingX = 761;
  static const double btnShowRankingY = 1344;
  static const double btnShowRankingW = 280;
  static const double btnShowRankingH = 114;

  // === Revive ===
  static const double reviveCircleX = 540;
  static const double reviveCircleY = 779;
  static const double reviveCircleSize = 570;
  static const double btnReviveX = 533.4;
  static const double btnReviveY = 1362.1;
  static const double btnReviveW = 544;
  static const double btnReviveH = 188.4;
  static const int reviveTime = 5; // seconds

  // === Game Over ===
  static const double goBannerX = 540.2;
  static const double goBannerY = 506.4;
  static const double goBannerW = 940.4;
  static const double goBannerH = 156.4;
  static const double goScoreLabelY = 761.3;
  static const double goScoreY = 905;
  static const double goBestLabelY = 1113;
  static const double goCupX = 407.5;
  static const double goCupY = 1205.5;
  static const double goCupSize = 140;
  static const double goBestX = 482;
  static const double goBestY = 1223;
  static const double btnGOResetX = 540.1;
  static const double btnGOResetY = 1597.9;
  static const double btnGOResetW = 510.2;
  static const double btnGOResetH = 176.7;

  // === Ranking popup ===
  static const double lbPopupX = 540;
  static const double lbPopupY = 966.5;
  static const double lbPopupW = 928;
  static const double lbPopupH = 1535;
  static const double lbTitleX = 540;
  static const double lbTitleY = 283;
  static const double lbRowStartY = 490; // ItemBg y for row 0 (490 + i*120)
  static const double lbRowStep = 120;
  static const double lbRowW = 733;
  static const double lbRowH = 103;
  static const double lbCloseX = 918;
  static const double lbCloseY = 275;
  static const double lbCloseSize = 89.3;

  // === Home ===
  static const double logoX = 540.5;
  static const double logoY = 532;
  static const double logoW = 837;
  static const double logoH = 888;
  static const double btnPlayX = 540;
  static const double btnPlayY = 1295;
  static const double btnPlayW = 625;
  static const double btnPlayH = 216;
  static const double homeMusicX = 906;
  static const double homeSfxX = 175;
  static const double homeBtnY = 1770;
  static const double homeBtnSize = 170;

  // === No space left banner ===
  static const double noSpaceX = 540;
  static const double noSpaceY = 1630;
  static const double noSpaceW = 998;
  static const double noSpaceH = 295;

  // === Block sizes on sheets (natural art size) ===
  static const double blockSpriteSize = 125;
}
