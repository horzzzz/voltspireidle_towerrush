import { Skia, TileMode, createPicture, usePictureAsTexture } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { VfxColors } from '@/game/vfx/palette';

/**
 * Baked at a fraction of the arena's real size — a radial gradient has no
 * detail to lose from being upscaled, and rasterising a small texture once
 * is what makes this free at runtime (see below).
 */
const TEX_WIDTH = 216;
const TEX_HEIGHT = 466;

/**
 * The low-HP / just-hurt vignette, baked into a texture once instead of
 * building a fresh `RadialGradient` shader (plus two throwaway `Float32Array`s)
 * every single frame it's visible — which, at low tower HP, is most frames of
 * the back half of a run.
 *
 * Always the tower's `hurt` red: the gradient no longer needs a tint at draw
 * time, so the render layer just modulates this texture's alpha
 * (`SkPaint.setAlphaf`) and blits it — one GPU sample instead of a shader
 * evaluated per pixel, with zero JS-thread allocation.
 */
export function useVignetteTexture() {
  const picture = useMemo(
    () =>
      createPicture((canvas) => {
        const paint = Skia.Paint();
        paint.setAntiAlias(true);
        const [r, g, b] = VfxColors.hurt;
        const c0 = Float32Array.of(r, g, b, 0);
        const c1 = Float32Array.of(r, g, b, 1);
        paint.setShader(
          Skia.Shader.MakeRadialGradient(
            { x: TEX_WIDTH / 2, y: TEX_HEIGHT / 2 },
            TEX_HEIGHT * 0.62,
            [c0, c1],
            [0.35, 1],
            TileMode.Clamp,
          ),
        );
        canvas.drawRect(Skia.XYWHRect(0, 0, TEX_WIDTH, TEX_HEIGHT), paint);
      }, { width: TEX_WIDTH, height: TEX_HEIGHT }),
    [],
  );
  return usePictureAsTexture(picture, { width: TEX_WIDTH, height: TEX_HEIGHT });
}

export const VIGNETTE_TEX_SIZE = { width: TEX_WIDTH, height: TEX_HEIGHT } as const;
