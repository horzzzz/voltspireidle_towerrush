import {
  PaintStyle,
  Skia,
  StrokeJoin,
  createPicture,
  useFont,
  usePictureAsTexture,
  type SkFont,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { useBattleStore } from '@/game/state/battle-store';
import { VfxColors } from '@/game/vfx/palette';

const FONT = require('@expo-google-fonts/grenze/600SemiBold/Grenze_600SemiBold.ttf');
/** Baked well above the on-screen size (see BANNER_DRAW_SCALE in vfx-picture.tsx) so the punch-in overshoot never upscales past native res. */
const FONT_SIZE = 46;
const PADDING_X = 10;
const STROKE_WIDTH = 7;

/**
 * Bakes the wave/boss banner text — with its outline already burned in — into
 * a small texture whenever the wave (or boss-ness) actually changes, instead
 * of drawing stroked text under a constantly-changing `canvas.scale` every
 * single frame it's visible.
 *
 * A scaling text stroke defeats Skia's glyph cache (every frame asks for a
 * differently-sized rasterisation of the same ~14 glyphs); a static texture
 * scaled by the GPU at draw time costs nothing beyond a sampled blit.
 */
export function useWaveBannerTexture(): {
  texture: ReturnType<typeof usePictureAsTexture>;
  width: number;
  height: number;
} {
  const wave = useBattleStore((s) => s.wave);
  const isBossWave = useBattleStore((s) => s.isBossWave);
  const font = useFont(FONT, FONT_SIZE);

  const text = isBossWave ? `BOSS · WAVE ${wave}` : `WAVE ${wave}`;
  const color = isBossWave ? VfxColors.boss : VfxColors.waveScan;

  const { picture, width, height } = useMemo(() => {
    if (!font) return { picture: null, width: 1, height: 1 };
    return bakeBanner(font, text, color);
  }, [font, text, color]);

  const texture = usePictureAsTexture(picture, { width, height });
  return { texture, width, height };
}

function bakeBanner(font: SkFont, text: string, color: readonly [number, number, number]) {
  const textWidth = font.measureText(text).width;
  const width = Math.ceil(textWidth + PADDING_X * 2);
  const height = Math.ceil(FONT_SIZE * 1.6);
  const baseline = height * 0.7;

  const outline = Skia.Paint();
  outline.setAntiAlias(true);
  outline.setStyle(PaintStyle.Stroke);
  outline.setStrokeWidth(STROKE_WIDTH);
  outline.setStrokeJoin(StrokeJoin.Round);
  outline.setColor(Float32Array.of(0, 0, 0, 0.85));

  const fill = Skia.Paint();
  fill.setAntiAlias(true);
  fill.setColor(Float32Array.of(color[0], color[1], color[2], 1));

  const picture = createPicture(
    (canvas) => {
      canvas.drawText(text, PADDING_X, baseline, outline, font);
      canvas.drawText(text, PADDING_X, baseline, fill, font);
    },
    { width, height },
  );

  return { picture, width, height };
}
