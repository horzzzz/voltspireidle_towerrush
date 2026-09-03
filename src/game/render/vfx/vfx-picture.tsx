import {
  BlendMode,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  StrokeJoin,
  TileMode,
  createPicture,
  useFont,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { ARENA_HEIGHT, ARENA_WIDTH, TOWER_X, TOWER_Y } from '@/game/data/arena';
import { BEAM_CAP, BR, G, NR, NUMBER_CAP, RING_CAP, RR } from '@/game/vfx/layout';
import { VfxColors } from '@/game/vfx/palette';
import { RING_RADIUS } from '../tower-health-ring';

const FONT = require('@expo-google-fonts/grenze/600SemiBold/Grenze_600SemiBold.ttf');
/** Base size of a normal damage number; the buffer's `scale` grows it from here. */
const NUMBER_FONT_SIZE = 21;
const BOUNDS = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
/** Segments in a bolt's jittered polyline — enough to read as lightning, cheap to build. */
const BEAM_SEGMENTS = 6;
/** Where the wave banner sits — clear of both the tower and the top HUD. */
const BANNER_Y = 300;
/** The banner reuses the damage-number typeface, scaled up by the canvas. */
const BANNER_SCALE = 2;

/** Cheap deterministic noise so a bolt's jitter is stable for its whole life. */
function hash(n: number): number {
  'worklet';
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

type Props = {
  numbers: SharedValue<Float32Array>;
  numberLabels: SharedValue<string[]>;
  beams: SharedValue<Float32Array>;
  rings: SharedValue<Float32Array>;
  globals: SharedValue<Float32Array>;
  banner: SharedValue<string>;
};

/**
 * The "few but expressive" half of the VFX layer, drawn procedurally into a
 * single `SkPicture` rebuilt on the UI thread each frame: lightning bolts with
 * per-segment jitter, shockwave rings, floating damage numbers, the hurt
 * vignette and the full-screen flash.
 *
 * Everything the mass-particle `<Atlas>` layers can't express (arbitrary
 * paths, text, gradients) lives here, and everything they *can* express stays
 * there — this pool never exceeds ~70 primitives, so one recorded picture is
 * cheaper than the equivalent tree of declarative nodes and their mappers.
 */
/** Memoized — same rationale as `EnemyAtlas`/`ParticleLayer`: every prop here is a stable SharedValue. */
export const VfxPicture = memo(function VfxPicture({ numbers, numberLabels, beams, rings, globals, banner }: Props) {
  const font = useFont(FONT, NUMBER_FONT_SIZE);

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

    const textOutline = Skia.Paint();
    textOutline.setAntiAlias(true);
    textOutline.setStyle(PaintStyle.Stroke);
    textOutline.setStrokeWidth(3.5);
    textOutline.setStrokeJoin(StrokeJoin.Round);

    const overlay = Skia.Paint();
    overlay.setAntiAlias(false);

    return { stroke, textFill, textOutline, overlay, scratch: Float32Array.of(0, 0, 0, 0) };
  }, []);

  const picture = useDerivedValue(() => {
    const numberData = numbers.value;
    const labels = numberLabels.value;
    const beamData = beams.value;
    const ringData = rings.value;
    const g = globals.value;
    const bannerText = banner.value;
    const { stroke, textFill, textOutline, overlay, scratch } = paints;

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
      for (let i = 0; i < RING_CAP; i++) {
        const base = i * RR.STRIDE;
        const alpha = ringData[base + RR.a];
        if (alpha <= 0.004) continue;
        setColor(stroke, ringData[base + RR.r], ringData[base + RR.g], ringData[base + RR.b], alpha);
        stroke.setStrokeWidth(ringData[base + RR.width]);
        canvas.drawCircle(ringData[base + RR.x], ringData[base + RR.y], ringData[base + RR.radius], stroke);
      }

      // ---- tower HP ring struck -------------------------------------------
      // Lights up the same ring `tower-health-ring.tsx` draws, so the bar the
      // player watches is itself what flinches when the tower is hit.
      const hurt = g[G.hurt];
      if (hurt > 0.02) {
        setColor(stroke, 1, 0.55, 0.55, Math.min(1, hurt) * 0.85);
        stroke.setStrokeWidth(6);
        canvas.drawCircle(TOWER_X, TOWER_Y, RING_RADIUS, stroke);
      }

      // ---- lightning ------------------------------------------------------
      for (let i = 0; i < BEAM_CAP; i++) {
        const base = i * BR.STRIDE;
        const alpha = beamData[base + BR.a];
        if (alpha <= 0.01) continue;

        const x1 = beamData[base + BR.x1];
        const y1 = beamData[base + BR.y1];
        const dx = beamData[base + BR.x2] - x1;
        const dy = beamData[base + BR.y2] - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const seed = beamData[base + BR.seed];
        const isCrit = beamData[base + BR.crit] > 0.5;
        // The arc snaps straighter as it dies, like a discharge settling.
        const amp = (isCrit ? 13 : 8) * (1 - beamData[base + BR.t] * 0.55);

        const path = Skia.Path.Make();
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
        setColor(stroke, tint[0], tint[1], tint[2], alpha * 0.22);
        stroke.setStrokeWidth(isCrit ? 11 : 8);
        canvas.drawPath(path, stroke);

        setColor(stroke, tint[0], tint[1], tint[2], alpha * 0.55);
        stroke.setStrokeWidth(isCrit ? 5 : 3.4);
        canvas.drawPath(path, stroke);

        setColor(stroke, 1, 1, 1, alpha);
        stroke.setStrokeWidth(isCrit ? 2 : 1.3);
        canvas.drawPath(path, stroke);
      }

      // ---- damage numbers -------------------------------------------------
      if (font !== null) {
        for (let i = 0; i < NUMBER_CAP; i++) {
          const base = i * NR.STRIDE;
          const alpha = numberData[base + NR.a];
          if (alpha <= 0.01) continue;
          const label = labels[i];
          if (label === undefined || label === '') continue;

          const width = font.measureText(label).width;
          canvas.save();
          canvas.translate(numberData[base + NR.x], numberData[base + NR.y]);
          const scale = numberData[base + NR.scale];
          canvas.scale(scale, scale);
          setColor(textOutline, 0, 0, 0, alpha * 0.8);
          canvas.drawText(label, -width / 2, 0, textOutline, font);
          setColor(
            textFill,
            numberData[base + NR.r],
            numberData[base + NR.g],
            numberData[base + NR.b],
            alpha,
          );
          canvas.drawText(label, -width / 2, 0, textFill, font);
          canvas.restore();
        }
      }

      // ---- wave / boss banner ---------------------------------------------
      const bannerAlpha = g[G.bannerAlpha];
      if (font !== null && bannerAlpha > 0.01 && bannerText !== '') {
        const width = font.measureText(bannerText).width;
        canvas.save();
        canvas.translate(ARENA_WIDTH / 2, BANNER_Y);
        const bannerScale = g[G.bannerScale] * BANNER_SCALE;
        canvas.scale(bannerScale, bannerScale);
        setColor(textOutline, 0, 0, 0, bannerAlpha * 0.85);
        canvas.drawText(bannerText, -width / 2, 0, textOutline, font);
        setColor(textFill, g[G.bannerR], g[G.bannerG], g[G.bannerB], bannerAlpha);
        canvas.drawText(bannerText, -width / 2, 0, textFill, font);
        canvas.restore();
      }

      // ---- screen-wide overlays -------------------------------------------
      // Drawn un-shaken: the camera shake is applied to the whole scene group
      // (battle-canvas.tsx), and a vignette that slid around with it would
      // read as a bug rather than as impact.
      const vignette = g[G.vignette];
      const flash = g[G.flash];
      if (vignette > 0.01 || flash > 0.01) {
        canvas.save();
        canvas.translate(-g[G.shakeX], -g[G.shakeY]);

        if (vignette > 0.01) {
          overlay.setBlendMode(BlendMode.SrcOver);
          overlay.setShader(
            Skia.Shader.MakeRadialGradient(
              { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 },
              ARENA_HEIGHT * 0.62,
              [
                Float32Array.of(g[G.vignetteR], g[G.vignetteG], g[G.vignetteB], 0),
                Float32Array.of(g[G.vignetteR], g[G.vignetteG], g[G.vignetteB], vignette * 0.75),
              ],
              [0.35, 1],
              TileMode.Clamp,
            ),
          );
          canvas.drawRect(Skia.XYWHRect(-40, -40, ARENA_WIDTH + 80, ARENA_HEIGHT + 80), overlay);
          overlay.setShader(null);
        }

        if (flash > 0.01) {
          overlay.setBlendMode(BlendMode.Plus);
          setColor(overlay, 1, 0.95, 0.85, flash * 0.5);
          canvas.drawRect(Skia.XYWHRect(-40, -40, ARENA_WIDTH + 80, ARENA_HEIGHT + 80), overlay);
        }

        canvas.restore();
      }
    }, BOUNDS);
  });

  return <Picture picture={picture} />;
});
