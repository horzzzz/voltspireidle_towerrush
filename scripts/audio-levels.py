#!/usr/bin/env python3
"""Reports the level of a 16-bit PCM WAV. Helper for scripts/fetch-audio.sh.

Prints `<peak dBFS> <loudness dBFS>`, where loudness is RMS over the loudest
300 ms window (the whole file, if it is shorter).

**Loudness, not peak, is what the mix trims in SFX_GAIN are picked from.**
Peak alone is actively misleading here, and getting that wrong is what buried
the UI clicks under the music the first time around: source packs master
everything to roughly -1 dBFS regardless of what the sound is, so a 0.1 s tick
and a two-second explosion arrive at the *same peak* while being 25 dB apart in
audibility. A 300 ms window is about the integration time of the ear, so it
ranks a transient against a sustained music bed the way a listener would.

The corollary is that gain cannot fix a clip with a high crest factor: raising
a thin tick until it is heard over the music clips it long before it gets
there. When this script shows a big peak-to-loudness gap on something that has
to cut through, the fix is a different source clip, not a bigger number in
SFX_GAIN.

Deliberately stdlib-only — the whole point of the audio pipeline is that it
runs on a stock macOS box with no ffmpeg and no pip install. `audioop` is gone
in 3.13, and `wave` rejects the float formats afconvert would rather emit,
hence the raw struct work on plain PCM.

Usage: audio-levels.py <file.wav>
"""

import math
import struct
import sys
import wave

FULL_SCALE = 32767
WINDOW_SECONDS = 0.3


def db(value: float) -> float:
    return -math.inf if value <= 0 else 20 * math.log10(value)


def levels(path: str) -> tuple[float, float]:
    """Returns (peak dBFS, loudest-300ms RMS dBFS)."""
    with wave.open(path, "rb") as w:
        params = w.getparams()
        if params.sampwidth != 2:
            raise SystemExit(f"{path}: expected 16-bit samples, got {params.sampwidth * 8}-bit")
        raw = w.readframes(params.nframes)

    samples = struct.unpack(f"<{len(raw) // 2}h", raw)
    if params.nchannels == 2:
        samples = tuple((samples[i] + samples[i + 1]) / 2 for i in range(0, len(samples) - 1, 2))
    if not samples:
        return -math.inf, -math.inf

    peak = max(abs(s) for s in samples) / FULL_SCALE

    window = int(WINDOW_SECONDS * params.framerate)
    if len(samples) <= window:
        energy = sum(s * s for s in samples) / len(samples)
    else:
        # Rolling sum rather than a fresh sum per offset — the music theme is
        # five million samples and the naive version takes minutes.
        acc = sum(s * s for s in samples[:window])
        best = acc
        for i in range(window, len(samples)):
            acc += samples[i] * samples[i] - samples[i - window] * samples[i - window]
            if acc > best:
                best = acc
        energy = best / window

    return db(peak), db(math.sqrt(energy) / FULL_SCALE)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    peak, loudness = levels(sys.argv[1])
    print(f"{peak:.1f} {loudness:.1f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
