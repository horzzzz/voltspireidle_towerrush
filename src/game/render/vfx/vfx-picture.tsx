import {
  BlendMode,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  StrokeJoin,
  createPicture,
  useFont,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { ARENA_HEIGHT, ARENA_WIDTH, TOWER_X, TOWER_Y } from '@/game/data/arena';
import {
  BEAM_CAP,
  BR,
  G,
  KIND_TOWER,
  NR,
  NUMBER_CAP,
  RING_CAP,
  RR,
  VFX,
} from '@/game/vfx/layout';
import { VfxColors } from '@/game/vfx/palette';
import { RING_RADIUS } from '../tower-health-ring';
import { useVignetteTexture, VIGNETTE_TEX_SIZE } from './overlay-texture';
import { useWaveBannerTexture } from './wave-banner-texture';

const FONT = require('@expo-google-fonts/grenze/600SemiBold/Grenze_600SemiBold.ttf');
/** Base size of a normal damage number; the buffer's `scale` grows it from here. */
const NUMBER_FONT_SIZE = 21;
const BOUNDS = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
/** Segments in a bolt's jittered polyline — enough to read as lightning, cheap to build. */
const BEAM_SEGMENTS = 6;
/** Where the wave banner sits — clear of both the tower and the top HUD. */
const BANNER_Y = 300;
/** On-screen size of the baked banner texture at bannerScale 1. */
const BANNER_DRAW_SCALE = 0.9;
/** Damage-number scale is snapped to this step before `canvas.scale`, so the
 *  glyph cache sees a handful of discrete sizes instead of a continuum. */
const NUMBER_SCALE_STEP = 0.05;

/** Cheap deterministic noise so a bolt's jitter is stable for its whole life. */
function hash(n: number): number {
  'worklet';
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** amount/kind -> label text. Mirrors game/core/numbers.ts, kept self-contained since worklets can't call plain-module functions. */
function formatAmount(amount: number, kind: number): string {
  'worklet';
  if (kind === KIND_TOWER) return amount.toFixed(1);
  const rounded = Math.round(amount);
  if (rounded < 1000) return String(rounded);
  const tier = Math.floor(Math.log10(rounded) / 3);
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  const suffix = suffixes[Math.min(tier, suffixes.length - 1)];
  const scaled = rounded / Math.pow(1000, tier);
  const text = scaled.toFixed(scaled < 10 ? 1 : 0);
  return (text.endsWith('.0') ? text.slice(0, -2) : text) + suffix;
}

const NUMBER_COLORS = [
  Float32Array.of(1, 1, 1, 1),
  Float32Array.of(VfxColors.crit[0], VfxColors.crit[1], VfxColors.crit[2], 1),
  Float32Array.of(VfxColors.boss[0], VfxColors.boss[1], VfxColors.boss[2], 1),
  Float32Array.of(VfxColors.hurt[0], VfxColors.hurt[1], VfxColors.hurt[2], 1),
];

type Props = {
  /** Globals + numbers + beams + rings, packed at the VFX offsets (layout.ts). */
  vfx: SharedValue<Float32Array>;
};

/**
 * The "few but expressive" half of the VFX layer, drawn procedurally into a
 * single `SkPicture` rebuilt on the UI thread each frame: lightning bolts with
 * per-segment jitter, shockwave rings, floating damage numbers, the hurt
 * vignette, the wave banner and the tower HP ring.
 *
 * Everything the mass-particle `<Atlas>` layers can't express (arbitrary
 * paths, text, gradients) lives here, and everything they *can* express stays
 * there — this pool never exceeds ~70 primitives, so one recorded picture is
 * cheaper than the equivalent tree of declarative nodes and their mappers.
 */
/** Memoized — same rationale as `EnemyAtlas`/`ParticleLayer`: `vfx` is a stable SharedValue. */
export const VfxPicture = memo(function VfxPicture({ vfx }: Props) {
  const font = useFont(FONT, NUMBER_FONT_SIZE);
  const vignette = useVignetteTexture();
  const banner = useWaveBannerTexture();

  // Skia host objects are shared with the UI runtime rather than cloned, so
  // these are created once and mutated in the worklet instead of per frame.
  const paints = useMemo(() => {
    const stroke = Skia.Paint();
    stroke.setAntiAlias(true);
    stroke.setStyle(PaintStyle.Stroke);
    stroke.setStrokeCap(StrokeCap.Round);
    stroke.setStrokeJoin(StrokeJoin.Round);
    stroke.setBlendMode(BlendMode.Plus);

    const textFill = Skia.Paint();
    textFill.setAntiAlias(true);

    const textShadow = Skia.Paint();
    textShadow.setAntiAlias(true);
    textShadow.setColor(Float32Array.of(0, 0, 0, 0.55));

    const image = Skia.Paint();
    image.setAntiAlias(true);

    // The HP ring is a plain solid-colour bar, not a glow — it needs normal
    // (SrcOver) blending, unlike every other stroke in this picture, so it
    // can't share the additive `stroke` paint below.
    const hpRing = Skia.Paint();
    hpRing.setAntiAlias(true);
    hpRing.setStyle(PaintStyle.Stroke);
    hpRing.setStrokeCap(StrokeCap.Round);
    hpRing.setStrokeJoin(StrokeJoin.Round);

    const flash = Skia.Paint();
    flash.setAntiAlias(false);
    flash.setBlendMode(BlendMode.Plus);

    // A builder, not a Path: `SkPath.lineTo()` et al are deprecated in favour
    // of building through `SkPathBuilder` and snapshotting with `.build()`.
    const path = Skia.PathBuilder.Make();

    return { stroke, textFill, textShadow, image, hpRing, flash, path, scratch: Float32Array.of(0, 0, 0, 0) };
  }, []);

  const picture = useDerivedValue(() => {
    const data = vfx.value;
    const g = VFX.globals;
    const { stroke, textFill, textShadow, image, hpRing, flash: flashPaint, path, scratch } = paints;
    const vignetteTex = vignette.value;
    const bannerTex = banner.texture.value;

    const setColor = (paint: typeof stroke, r: number, gc: number, b: number, a: number) => {
      'worklet';
      scratch[0] = r;
      scratch[1] = gc;
      scratch[2] = b;
      scratch[3] = a;
      paint.setColor(scratch);
    };

    return createPicture((canvas) => {
      // ---- shockwave rings ------------------------------------------------
      const ringBase = VFX.rings;
      for (let i = 0; i < RING_CAP; i++) {
        const base = ringBase + i * RR.STRIDE;
        const alpha = data[base + RR.a];
        if (alpha <= 0.004) continue;
        setColor(stroke, data[base + RR.r], data[base + RR.g], data[base + RR.b], alpha);
        stroke.setStrokeWidth(data[base + RR.width]);
        canvas.drawCircle(data[base + RR.x], data[base + RR.y], data[base + RR.radius], stroke);
      }

      // ---- tower HP ring ----------------------------------------------------
      const hpFraction = data[g + G.hp];
      if (hpFraction > 0) {
        setColor(hpRing, 1, 1, 1, 0.12);
        hpRing.setStrokeWidth(5);
        canvas.drawCircle(TOWER_X, TOWER_Y, RING_RADIUS, hpRing);

        const hpColor =
          hpFraction > 0.5 ? VfxColors.waveScan : hpFraction > 0.25 ? VfxColors.upgrade : VfxColors.hurt;
        setColor(hpRing, hpColor[0], hpColor[1], hpColor[2], 1);
        path.reset();
        path.addArc(
          Skia.XYWHRect(TOWER_X - RING_RADIUS, TOWER_Y - RING_RADIUS, RING_RADIUS * 2, RING_RADIUS * 2),
          -90,
          360 * hpFraction,
        );
        canvas.drawPath(path.build(), hpRing);
      }

      // Struck flash on the same ring the "hurt" glow shows on.
      const hurt = data[g + G.hurt];
      if (hurt > 0.02) {
        setColor(stroke, 1, 0.55, 0.55, Math.min(1, hurt) * 0.85);
        stroke.setStrokeWidth(6);
        canvas.drawCircle(TOWER_X, TOWER_Y, RING_RADIUS, stroke);
      }

      // ---- lightning ------------------------------------------------------
      const beamBase = VFX.beams;
      for (let i = 0; i < BEAM_CAP; i++) {
        const base = beamBase + i * BR.STRIDE;
        const alpha = data[base + BR.a];
        if (alpha <= 0.01) continue;

        const x1 = data[base + BR.x1];
        const y1 = data[base + BR.y1];
        const dx = data[base + BR.x2] - x1;
        const dy = data[base + BR.y2] - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const seed = data[base + BR.seed];
        const isCrit = data[base + BR.crit] > 0.5;
        // The arc snaps straighter as it dies, like a discharge settling.
        const amp = (isCrit ? 13 : 8) * (1 - data[base + BR.t] * 0.55);

        path.reset();
        path.moveTo(x1, y1);
        for (let s = 1; s < BEAM_SEGMENTS; s++) {
          const p = s / BEAM_SEGMENTS;
          // sin() pins the jitter to zero at both ends, so the bolt still
          // starts on the tower and lands exactly on the target.
          const offset = (hash(seed + s * 7.13) - 0.5) * 2 * amp * Math.sin(Math.PI * p);
          path.lineTo(x1 + dx * p + nx * offset, y1 + dy * p + ny * offset);
        }
        path.lineTo(x1 + dx, y1 + dy);

        if (isCrit) {
          // One short fork off the middle — reads as extra voltage.
          const p = 0.45 + hash(seed) * 0.25;
          const bx = x1 + dx * p;
          const by = y1 + dy * p;
          const spread = (hash(seed + 3.1) - 0.5) * 1.4;
          const forkLen = len * 0.28;
          path.moveTo(bx, by);
          path.lineTo(
            bx + (dx / len) * forkLen * Math.cos(spread) - (dy / len) * forkLen * Math.sin(spread),
            by + (dy / len) * forkLen * Math.cos(spread) + (dx / len) * forkLen * Math.sin(spread),
          );
        }

        const tint = isCrit ? VfxColors.crit : VfxColors.bolt;
        const boltPath = path.build();

        // Two passes (glow + bright core) instead of three — the third,
        // barely-visible white-hot pass cost a third of every bolt's fill
        // for almost no read difference.
        setColor(stroke, tint[0], tint[1], tint[2], alpha * 0.3);
        stroke.setStrokeWidth(isCrit ? 11 : 8);
        canvas.drawPath(boltPath, stroke);

        setColor(stroke, 1, 1, 1, alpha * 0.85);
        stroke.setStrokeWidth(isCrit ? 3.5 : 2.2);
        canvas.drawPath(boltPath, stroke);
      }

      // ---- damage numbers -------------------------------------------------
      if (font !== null) {
        const numBase = VFX.numbers;
        for (let i = 0; i < NUMBER_CAP; i++) {
          const base = numBase + i * NR.STRIDE;
          const alpha = data[base + NR.a];
          if (alpha <= 0.01) continue;

          const kind = data[base + NR.kind];
          const label = formatAmount(data[base + NR.amount], kind);
          const width = font.measureText(label).width;

          canvas.save();
          canvas.translate(data[base + NR.x], data[base + NR.y]);
          // Quantized so nearby frames reuse the same rasterised glyph size.
          const rawScale = data[base + NR.scale];
          const scale = Math.round(rawScale / NUMBER_SCALE_STEP) * NUMBER_SCALE_STEP;
          canvas.scale(scale, scale);

          textShadow.setAlphaf(alpha * 0.55);
          canvas.drawText(label, -width / 2 + 1.5, 1.5, textShadow, font);

          const color = NUMBER_COLORS[kind] ?? NUMBER_COLORS[0];
          scratch[0] = color[0];
          scratch[1] = color[1];
          scratch[2] = color[2];
          scratch[3] = alpha;
          textFill.setColor(scratch);
          canvas.drawText(label, -width / 2, 0, textFill, font);
          canvas.restore();
        }
      }

      // ---- wave / boss banner ----------------------------------------------
      const bannerAlpha = data[g + G.bannerAlpha];
      if (bannerTex !== null && bannerAlpha > 0.01) {
        const bannerScale = data[g + G.bannerScale] * BANNER_DRAW_SCALE;
        const w = banner.width * bannerScale;
        const h = banner.height * bannerScale;
        image.setAlphaf(bannerAlpha);
        canvas.drawImageRect(
          bannerTex,
          Skia.XYWHRect(0, 0, banner.width, banner.height),
          Skia.XYWHRect(ARENA_WIDTH / 2 - w / 2, BANNER_Y - h / 2, w, h),
          image,
        );
        image.setAlphaf(1);
      }

      // ---- screen-wide overlays -------------------------------------------
      // Drawn un-shaken: the camera shake is applied to the whole scene group
      // (battle-canvas.tsx), and a vignette that slid around with it would
      // read as a bug rather than as impact.
      const vig = data[g + G.vignette];
      const flash = data[g + G.flash];
      if ((vig > 0.01 && vignetteTex !== null) || flash > 0.01) {
        canvas.save();
        canvas.translate(-data[g + G.shakeX], -data[g + G.shakeY]);

        if (vig > 0.01 && vignetteTex !== null) {
          image.setAlphaf(vig * 0.75);
          canvas.drawImageRect(
            vignetteTex,
            Skia.XYWHRect(0, 0, VIGNETTE_TEX_SIZE.width, VIGNETTE_TEX_SIZE.height),
            Skia.XYWHRect(-40, -40, ARENA_WIDTH + 80, ARENA_HEIGHT + 80),
            image,
          );
          image.setAlphaf(1);
        }

        if (flash > 0.01) {
          setColor(flashPaint, 1, 0.95, 0.85, flash * 0.5);
          canvas.drawRect(Skia.XYWHRect(-40, -40, ARENA_WIDTH + 80, ARENA_HEIGHT + 80), flashPaint);
        }

        canvas.restore();
      }
    }, BOUNDS);
  });

  return <Picture picture={picture} />;
});
