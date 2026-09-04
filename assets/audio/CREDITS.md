# Audio credits

Everything here is **CC0** (or a file the project owner already owns) — free
for commercial use with no attribution required. Listed anyway for
traceability; nothing needs to ship in-app.

`scripts/fetch-audio.sh` rebuilds this whole directory from the sources below,
so this table and that script's `SFX_MAP` have to stay in step.

| File | Pack / author | Original file | License |
|---|---|---|---|
| `ui-click.m4a` | Kenney — Interface Sounds | `select_002.wav` | CC0 |
| `ui-back.m4a` | Kenney — Interface Sounds | `back_001.wav` | CC0 |
| `ui-denied.m4a` | Kenney — Interface Sounds | `error_004.wav` | CC0 |
| `ui-toggle.m4a` | Kenney — Interface Sounds | `switch_003.wav` | CC0 |
| `purchase.m4a` | Kenney — Interface Sounds | `confirmation_001.wav` | CC0 |
| `level-up.m4a` | Kenney — Interface Sounds | `maximize_006.wav` | CC0 |
| `run-upgrade.m4a` | Kenney — Interface Sounds | `confirmation_003.wav` | CC0 |
| `wheel-fail.m4a` | Kenney — Interface Sounds | `error_002.wav` | CC0 |
| `reward-claim.m4a` | Kenney — Music Jingles | `Steel jingles/jingles_steel_0.ogg` | CC0 |
| `wheel-win.m4a` | Kenney — Music Jingles | `Steel jingles/jingles_steel_9.ogg` | CC0 |
| `defeat.m4a` | Kenney — Music Jingles | `Steel jingles/jingles_steel_16.ogg` | CC0 |
| `tower-shot.m4a` | Kenney — Sci-Fi Sounds | `laser_small_002.ogg` | CC0 |
| `tower-crit.m4a` | Kenney — Sci-Fi Sounds | `laser_large_001.ogg` | CC0 |
| `enemy-death.m4a` | Kenney — Sci-Fi Sounds | `impact_metal_002.ogg` | CC0 |
| `boss-death.m4a` | Kenney — Sci-Fi Sounds | `low_frequency_explosion_000.ogg` | CC0 |
| `unlock.m4a` | Kenney — Sci-Fi Sounds | `force_field_001.ogg` | CC0 |
| `wave-start.m4a` | Kenney — Sci-Fi Sounds | `force_field_003.ogg` | CC0 |
| `tower-hit.m4a` | Kenney — Impact Sounds | `impact_plate_heavy_002.ogg` | CC0 |
| `boss-spawn.m4a` | Kenney — Impact Sounds | `impact_bell_heavy_002.ogg` | CC0 |
| `wheel-spin.m4a` | Provided by the project owner | — | — |
| `music-theme.m4a` | "Space Dungeon" by MintoDog | `space_dungeon_bpm100_0.ogg` | CC0 |

## Sources

- Kenney packs — <https://kenney.nl/assets> (Interface Sounds, Impact Sounds,
  Sci-Fi Sounds, Music Jingles). Every pack's own `License.txt` dedicates it to
  the public domain under <http://creativecommons.org/publicdomain/zero/1.0/>.
  kenney.nl only produces its download URL through JavaScript, so
  `fetch-audio.sh` pulls the identical files from the Godot-addon mirrors
  (`Calinou/kenney-interface-sounds`,
  `Boyquotes/kenney-{impact,sci-fi,music-jingles}-*-for-godot`).
- "Space Dungeon" — <https://opengameart.org/content/space-dungeon>, CC0, tagged
  `synth` / `dark` / `loopable`.

## Encoding

Sources are `.wav`/`.ogg`; everything was re-encoded to AAC `.m4a` with
`afconvert` — **mono, ~64 kbps** for the one-shots, **stereo, ~96 kbps** for the
music. No content was altered: no trimming, no gain, no normalization. All
twenty effects together come to ~165 KB; the music is 1.3 MB.

Standing per-clip mix trims are **not** baked into the files. They live in
`SFX_GAIN` in `src/game/audio/sfx.ts`, so the balance can be re-tuned without
touching an asset. `fetch-audio.sh` prints each clip's measured peak *and*
loudness (via `scripts/audio-levels.py`); the trims are computed from the
**loudness** column, and the music bed they are balanced against is
`MUSIC_MIX_LEVEL` in `src/game/audio/engine.ts`.

## Why the music is 115.2 s exactly

At its stated 100 BPM that is 192 beats — 48 bars of 4/4, landing the loop
point precisely on a bar line. The source page also advertises the track as
loopable, so `expo-audio`'s plain `loop = true` is seamless with no crossfade
or trimming needed on our side.

## Why loudness and not peak

Every pack here masters to roughly -1 dBFS no matter what the sound is, so peak
says nothing about whether a clip will be heard. `click_001.wav` — the obvious
pick for `ui-click`, and the original one — peaks at -1.4 dBFS but carries only
-27 dBFS of actual energy: it is a 0.11 s tick. Against a music bed at -11 dBFS
it was 21 dB down and completely inaudible, and it could not be fixed with gain
either, because a clip with a 26 dB crest factor clips long before it gets
loud. `select_002.wav` is 9 dB hotter in energy at the same peak, which is why
it is the click.

`tower-hit` was the same story (`impact_metal_heavy_001` at -33 dBFS loudness,
the quietest thing in the set, for the one cue the player most needs to hear);
`impact_plate_heavy_002` carries 13 dB more.

## Notes on two more picks

`enemy-death` and `boss-spawn` are deliberately **short** (0.47 s / 0.70 s).
Both retrigger while the previous instance is still ringing — a wave wipe can
kill a dozen enemies inside a second — and anything with a long tail stacks
into mud rather than reading as a dozen separate deaths. The first candidates
for these slots (`explosion_crunch_003` at 1.55 s and `computer_noise_002` at
5.0 s) were rejected on exactly that basis.
