# ChocoBlock — Native Flutter port

A native Flutter port of the Block Blast puzzle game (chocolate-themed
palette) using the **Flame** game engine. No WebView — the game logic,
rendering, audio, and UI are all native Dart code.

## Project layout

```
flutter-app/
├── lib/
│   ├── main.dart                       Flutter entry point: GameWidget +
│   │                                   header/score/game-over overlay.
│   └── game/
│       ├── block_blast_game.dart        Main FlameGame class. 8x8 grid,
│       │                                tray, drag-drop, line clearing,
│       │                                score, game-over detection.
│       ├── palette.dart                 Chocolate palette (6 colors with
│       │                                3-tone shading each).
│       └── shapes.dart                  22 piece shapes (1x1 to 5x1, L, T, square).
├── assets/
│   └── audio/                          MP3 audio (converted from
│                                        original webm via ffmpeg).
│                                        put.mp3, score.mp3, lose.mp3,
│                                        revive.mp3, whoosh.mp3, beep.mp3,
│                                        return.mp3, no_space.mp3, music.mp3,
│                                        plus 15 score variations and
│                                        5 cheerful variations.
├── android/                            Standard Flutter Android scaffolding:
│   ├── settings.gradle.kts
│   ├── build.gradle.kts
│   ├── app/build.gradle.kts             (applicationId: com.jessicacarter.chocoblock,
│   │                                     minSdk=21, release signed with debug key)
│   ├── app/src/main/AndroidManifest.xml (portrait-locked, hardware-accelerated)
│   ├── app/src/main/res/                (launcher icons at 5 densities,
│   │                                     launch background, styles)
│   └── app/src/main/kotlin/com/jessicacarter/chocoblock/MainActivity.kt
├── pubspec.yaml                        name=chocoblock, version=0.1.0+1
│                                       flame: ^1.20.0, flame_audio: ^2.10.0,
│                                       audioplayers: ^6.1.0
├── .github/workflows/build-apk.yml     GitHub Actions workflow.
├── .gitignore
└── README.md (this file)
```

## How it works

The game renders everything with `Canvas` primitives (rounded
rectangles + highlights + shadows) — no sprite sheets needed. The
chocolate palette has 6 base block colors (gold, brown, green, sky,
cream, purple), each with a matching shadow and highlight tone for
the 3D shaded look.

Audio is loaded from `assets/audio/` via Flame's audio cache. The
original game used `.webm` files (which Flutter's audio system can't
decode on all platforms); we converted them to `.mp3` via `ffmpeg`.

The header (CHOCO BLOCK title + score) and game-over modal are
rendered as Flutter widgets on top of the `GameWidget`, not on the
canvas — keeps the game logic separate from UI chrome.

## Build the APK

You don't need Flutter installed locally — GitHub Actions builds the
APK for you.

### One-time setup

1. Make sure your repo is at https://github.com/jessicacarter9955/best-block-blast
2. Copy the contents of this `flutter-app/` folder INTO the repo root
   (not as a subfolder — GitHub Actions only runs workflows from
   `<repo-root>/.github/workflows/`). Example:
   ```bash
   cd /path/to/best-block-blast
   cp -r /home/z/my-project/flutter-app/* .
   cp -r /home/z/my-project/flutter-app/.github .
   cp /home/z/my-project/flutter-app/.gitignore .
   git add .
   git commit -m "Add native Flutter port (Flame engine)"
   git push
   ```
3. Watch the build at `https://github.com/jessicacarter9955/best-block-blast/actions`.

### Every push to `main`

- GitHub Actions installs Flutter (cached), bootstraps missing files
  (gradle wrapper) via `flutter create .`, then runs `flutter build apk --debug`.
- Download `chocoblock-debug-<sha>.apk` from the Actions tab → latest run → Artifacts.
- Install on your phone:
  ```
  adb install chocoblock-debug-<sha>.apk
  ```

### Tag a release

```bash
git tag v0.1.0
git push origin v0.1.0
```

- GitHub Actions builds the release APK (minified, shrunk).
- The APK is automatically attached to a new GitHub Release at
  `https://github.com/jessicacarter9955/best-block-blast/releases`.

## To change the app name or app id

Both are easy to change before publishing:

- **App name** (under the icon):
  - `android/app/src/main/AndroidManifest.xml` → `android:label="ChocoBlock"`
  - `pubspec.yaml` → `name: chocoblock`
- **Application ID**:
  - `android/app/build.gradle.kts` → `namespace = "..."` and `applicationId = "..."`
  - Rename the folder `android/app/src/main/kotlin/com/jessicacarter/chocoblock/`
    to match the new namespace, and update the `package` line in
    `MainActivity.kt`.

## To tweak the chocolate palette

Edit `lib/game/palette.dart` — change any of the `BlockColor` entries.
Each entry has a `base`, `shadow`, and `highlight` color, used by the
`drawBlock()` helper for the 3D shaded look.

## To add new piece shapes

Edit `lib/game/shapes.dart` and add a new `[[...]]` matrix to the
`kShapes` list. The game picks shapes randomly when refilling the
tray.

## iOS

Not yet scaffolded. To add iOS:

1. Get an Apple Developer account ($99/year).
2. Add `--platforms=ios` to the `flutter create` step in
   `.github/workflows/build-apk.yml`.
3. Run on a macOS GitHub Actions runner with a code-signing cert
   from GitHub Secrets.

## AdMob

Not yet wired. To add ads:

1. Add `google_mobile_ads: ^5.0.0` to `pubspec.yaml`.
2. Initialize MobileAds in `main.dart`'s `initState`.
3. Add a banner at the top of `GameScreen` (below the header) and
   an interstitial between tray refills.
