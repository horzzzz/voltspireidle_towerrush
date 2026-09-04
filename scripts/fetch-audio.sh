#!/bin/bash
#
# Rebuilds assets/audio/ from its CC0 sources.
#
# Not part of any build — the encoded .m4a files are committed. This exists so
# the set is reproducible: to swap a clip, change its row in SFX_MAP below and
# re-run, rather than hand-converting a file and losing track of where it came
# from. assets/audio/CREDITS.md is the human-readable version of the same table.
#
# Everything is converted with afconvert (CoreAudio), which is already on every
# macOS box and reads both WAV and Ogg Vorbis — no ffmpeg/sox to install.
# A channel downmix straight out of Vorbis is refused, hence the WAV hop:
#
#   source -> stereo 16-bit WAV -> mono 16-bit WAV -> mono AAC 64k .m4a
#
# Music skips the downmix and stays stereo at 96k: it is the one file where
# the width is worth the bytes.
#
# Nothing is normalized on the way through: these mirrors already ship the
# packs at a consistent peak, so the standing per-clip mix trims live in
# SFX_GAIN in src/game/audio/sfx.ts, where the balance stays tunable without a
# re-encode.
#
# The LOUD column below (RMS over the loudest 300 ms) is what those trims are
# picked from, *not* PEAK. The packs master a 0.06 s blip and a 2 s explosion
# to the same peak while they are 20 dB apart in audibility, so trimming on
# peak is what buried the UI clicks under the music the first time round. A big
# PEAK-to-LOUD gap also means gain cannot save that clip — it clips before it
# gets loud — so a clip that has to cut through needs a different source, which
# is why ui-click and tower-hit are the ones they are.
#
# Usage: scripts/fetch-audio.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/assets/audio"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# kenney.nl only hands out its download URL through JavaScript, so the packs
# come from Godot-addon mirrors that expose the same CC0 files over raw.
KENNEY_UI="https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/master/addons/kenney_interface_sounds"
KENNEY_IMPACT="https://raw.githubusercontent.com/Boyquotes/kenney-impact-sounds-for-godot/main/addons/kenney%20impact%20sounds"
KENNEY_SCIFI="https://raw.githubusercontent.com/Boyquotes/kenney-sci-fi-sounds-for-godot/main/addons/kenney%20sci-fi%20sounds"
KENNEY_JINGLE="https://raw.githubusercontent.com/Boyquotes/kenney-music-jingles-for-godot/main/addons/kenney%20music%20jingles/Steel%20jingles"

MUSIC_URL="https://opengameart.org/sites/default/files/space_dungeon_bpm100_0.ogg"

# "<sfx id>|<base url>|<source file>". Keep in sync with assets/audio/CREDITS.md
# and the SFX_SOURCES registry in src/game/audio/sfx.ts.
SFX_MAP=(
  # UI
  "ui-click|$KENNEY_UI|select_002.wav"
  "ui-back|$KENNEY_UI|back_001.wav"
  "ui-denied|$KENNEY_UI|error_004.wav"
  "ui-toggle|$KENNEY_UI|switch_003.wav"
  # Economy
  "purchase|$KENNEY_UI|confirmation_001.wav"
  "reward-claim|$KENNEY_JINGLE|jingles_steel_0.ogg"
  "unlock|$KENNEY_SCIFI|force_field_001.ogg"
  "level-up|$KENNEY_UI|maximize_006.wav"
  # Wheel (wheel-spin.m4a is supplied by the project owner, not fetched)
  "wheel-win|$KENNEY_JINGLE|jingles_steel_9.ogg"
  "wheel-fail|$KENNEY_UI|error_002.wav"
  # Battle
  "tower-shot|$KENNEY_SCIFI|laser_small_002.ogg"
  "tower-crit|$KENNEY_SCIFI|laser_large_001.ogg"
  "enemy-death|$KENNEY_SCIFI|impact_metal_002.ogg"
  "boss-death|$KENNEY_SCIFI|low_frequency_explosion_000.ogg"
  "tower-hit|$KENNEY_IMPACT|impact_plate_heavy_002.ogg"
  "boss-spawn|$KENNEY_IMPACT|impact_bell_heavy_002.ogg"
  "wave-start|$KENNEY_SCIFI|force_field_003.ogg"
  "run-upgrade|$KENNEY_UI|confirmation_003.wav"
  "defeat|$KENNEY_JINGLE|jingles_steel_16.ogg"
)

mkdir -p "$OUT"

encode_sfx() {
  local id="$1" src="$2"
  afconvert -f WAVE -d LEI16 "$src" "$TMP/$id.stereo.wav"

  # `--mix -c 1` is an error, not a no-op, on a source that is already mono —
  # and the Kenney interface pack ships a mix of both.
  if afinfo "$TMP/$id.stereo.wav" | grep -q '^Data format: *1 ch'; then
    cp "$TMP/$id.stereo.wav" "$TMP/$id.mono.wav"
  else
    afconvert -f WAVE -d LEI16 --mix -c 1 "$TMP/$id.stereo.wav" "$TMP/$id.mono.wav"
  fi

  afconvert -f m4af -d aac -b 64000 "$TMP/$id.mono.wav" "$OUT/$id.m4a"
}

printf '%-14s %7s %7s %8s  %s\n' "ID" "PEAK" "LOUD" "LENGTH" "SOURCE"
for row in "${SFX_MAP[@]}"; do
  IFS='|' read -r id base file <<<"$row"
  curl -fsSL --retry 2 -m 60 -o "$TMP/$id.src" "$base/$file"
  encode_sfx "$id" "$TMP/$id.src"
  read -r peak loud <<<"$(python3 "$ROOT/scripts/audio-levels.py" "$TMP/$id.mono.wav")"
  secs="$(afinfo "$OUT/$id.m4a" | sed -n 's/estimated duration: \([0-9.]*\).*/\1/p')"
  printf '%-14s %6sdB %5sdB %7.2fs  %s\n' "$id" "$peak" "$loud" "$secs" "$file"
done

echo "  music-theme  <-  space_dungeon_bpm100_0.ogg"
curl -fsSL --retry 2 -m 180 -o "$TMP/music.src" "$MUSIC_URL"
afconvert -f WAVE -d LEI16 "$TMP/music.src" "$TMP/music.wav"
afconvert -f m4af -d aac -b 96000 "$TMP/music.wav" "$OUT/music-theme.m4a"

echo
echo "Done. assets/audio is $(du -sh "$OUT" | cut -f1):"
ls -la "$OUT"
