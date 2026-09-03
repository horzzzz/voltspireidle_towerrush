import {
  BlendMode,
  PaintStyle,
  Skia,
  TileMode,
  createPicture,
  usePictureAsTexture,
  type SkCanvas,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { BRUSH_CELL, BRUSH_COUNT, Brush } from '@/game/vfx/layout';

const CELL = BRUSH_CELL;
const HALF = CELL / 2;
const ATLAS_SIZE = { width: CELL * BRUSH_COUNT, height: CELL };

const white = (alpha: number) => Float32Array.of(1, 1, 1, alpha);

/**
 * Every brush is drawn in plain white with only its *alpha* shaped — the
 * per-particle colour arrives at draw time through the Atlas's `colors`
 * buffer with `colorBlendMode="modulate"`, so one grayscale sheet serves
 * every tint in the game.
 */
function drawGlow(canvas: SkCanvas): void {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: HALF, y: HALF },
      HALF,
      [white(1), white(0.45), white(0.12), white(0)],
      [0, 0.3, 0.62, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(HALF, HALF, HALF, paint);
}

/**
 * A streak with its bright head at +x. Particles using this brush are spawned
 * rotated to their own velocity (see VfxSystem.spawn), so the head always
 * leads the direction of travel.
 */
function drawSpark(canvas: SkCanvas): void {
  const body = Skia.Paint();
  body.setAntiAlias(true);
  body.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: HALF },
      { x: CELL, y: HALF },
      [white(0), white(0.25), white(1), white(0.85)],
      [0, 0.45, 0.86, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(2, HALF - 3.5, CELL - 4, 7), 3.5, 3.5), body);

  const head = Skia.Paint();
  head.setAntiAlias(true);
  head.setShader(
    Skia.Shader.MakeRadialGradient(
      { x: CELL - 10, y: HALF },
      12,
      [white(1), white(0)],
      [0, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(CELL - 10, HALF, 12, head);
}

/** Soft irregular puff — three offset blobs so debris doesn't read as circles. */
function drawSmoke(canvas: SkCanvas): void {
  const blobs: [number, number, number][] = [
    [HALF - 7, HALF - 4, 22],
    [HALF + 8, HALF + 2, 19],
    [HALF - 1, HALF + 9, 16],
  ];
  for (const [cx, cy, r] of blobs) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setShader(
      Skia.Shader.MakeRadialGradient(
        { x: cx, y: cy },
        r,
        [white(0.55), white(0.28), white(0)],
        [0, 0.55, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawCircle(cx, cy, r, paint);
  }
}

/** Four-point sparkle for gems and level-ups. */
function drawStar(canvas: SkCanvas): void {
  const waist = CELL * 0.11;
  const path = Skia.Path.Make();
  path.moveTo(HALF, 1);
  path.quadTo(HALF + waist, HALF - waist, CELL - 1, HALF);
  path.quadTo(HALF + waist, HALF + waist, HALF, CELL - 1);
  path.quadTo(HALF - waist, HALF + waist, 1, HALF);
  path.quadTo(HALF - waist, HALF - waist, HALF, 1);
  path.close();

  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Fill);
  paint.setColor(white(0.95));
  canvas.drawPath(path, paint);

  const core = Skia.Paint();
  core.setAntiAlias(true);
  core.setBlendMode(BlendMode.Plus);
  core.setShader(
    Skia.Shader.MakeRadialGradient({ x: HALF, y: HALF }, 13, [white(0.9), white(0)], [0, 1], TileMode.Clamp),
  );
  canvas.drawCircle(HALF, HALF, 13, core);
}

const DRAWERS = [drawGlow, drawSpark, drawSmoke, drawStar];

/**
 * The particle sprite sheet, generated in code at mount — four 64×64 brush
 * cells laid out left to right in the order of `Brush`. No PNG ships for it;
 * it is a recorded `SkPicture` rasterised once into a GPU texture, which the
 * two `<Atlas>` layers then instance from.
 */
export function useBrushAtlas() {
  const picture = useMemo(
    () =>
      createPicture((canvas) => {
        for (let i = 0; i < DRAWERS.length; i++) {
          canvas.save();
          canvas.translate(i * CELL, 0);
          DRAWERS[i](canvas);
          canvas.restore();
        }
      }, ATLAS_SIZE),
    [],
  );
  return usePictureAsTexture(picture, ATLAS_SIZE);
}

/** Source rect of one brush cell — the Atlas sprite buffer writes this shape. */
export const brushCellX = (brush: number) => brush * CELL;

export { Brush, CELL as BRUSH_CELL_SIZE };
