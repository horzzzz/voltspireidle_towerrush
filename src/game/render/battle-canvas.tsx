import { Canvas, Circle, DashPathEffect, Group, Image, useCanvasSize, useImage } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { ARENA_HEIGHT, ARENA_WIDTH, ATTACK_RANGE, TOWER_X, TOWER_Y } from '@/game/data/arena';
import { getSkin } from '@/game/data/skins';
import { useMetaStore } from '@/game/state/meta-store';
import { BSec, secOffset } from '@/game/vfx/frame-buffer';
import { ADDITIVE_CAP, G, NORMAL_CAP } from '@/game/vfx/layout';
import { EnemyAtlas } from './enemy-atlas';
import { PerfFlags } from './perf-monitor';
import { ParticleLayer } from './vfx/particle-layer';
import { VfxPicture } from './vfx/vfx-picture';

const BG = require('@/assets/images/battle/bg.png');
const STOCK_TOWER = require('@/assets/images/battle/tower.png');
const TOWER_SIZE = 132; // design px — matches the Figma tower_1 frame (~122×124)

type Props = {
  /** Everything the scene draws this frame, in one buffer — see vfx/frame-buffer.ts. */
  frame: SharedValue<Float32Array>;
};

/**
 * The whole battle scene in one Skia canvas. Everything draws in fixed
 * 430×932 design-space coordinates (see data/arena.ts) inside a `<Group>`
 * scaled to the measured canvas size — the sim never needs to know the
 * device's actual pixel width.
 *
 * That same group carries the camera shake, so impact never disturbs the RN
 * HUD laid over this canvas — only the scene inside it moves.
 */
export function BattleCanvas({ frame }: Props) {
  const { ref, size } = useCanvasSize();
  const bg = useImage(BG);
  const skin = useMetaStore((s) => getSkin(s.selectedSkin));
  const tower = useImage(skin?.image ?? STOCK_TOWER);
  const scale = size.width > 0 ? size.width / ARENA_WIDTH : 0;

  // The tower alone carries the firing recoil, on top of whatever the scene
  // group is already doing.
  const towerTransform = useDerivedValue(() => {
    const data = frame.value;
    const g = secOffset(data, BSec.globals);
    return [{ translateX: data[g + G.recoilX] }, { translateY: data[g + G.recoilY] }];
  });

  const sceneTransform = useDerivedValue(() => {
    const data = frame.value;
    const g = secOffset(data, BSec.globals);
    return [{ scale }, { translateX: data[g + G.shakeX] }, { translateY: data[g + G.shakeY] }];
  }, [scale]);

  return (
    <Canvas ref={ref} style={StyleSheet.absoluteFill}>
      {scale > 0 && (
        <Group transform={sceneTransform}>
          {bg && <Image image={bg} x={0} y={0} width={ARENA_WIDTH} height={ARENA_HEIGHT} fit="cover" />}

          <Circle cx={TOWER_X} cy={TOWER_Y} r={ATTACK_RANGE} style="stroke" strokeWidth={1.5} color="#3fd0ff" opacity={0.35}>
            <DashPathEffect intervals={[6, 6]} />
          </Circle>

          {tower && (
            <Group transform={towerTransform}>
              <Image
                image={tower}
                x={TOWER_X - TOWER_SIZE / 2}
                y={TOWER_Y - TOWER_SIZE / 2}
                width={TOWER_SIZE}
                height={TOWER_SIZE}
                fit="contain"
              />
            </Group>
          )}

          <EnemyAtlas kind="scavenger" frame={frame} />
          <EnemyAtlas kind="hulk" frame={frame} />
          <EnemyAtlas kind="runner" frame={frame} />

          {/* Bosses draw on top of the regular swarm. */}
          <EnemyAtlas bossVariant={0} frame={frame} />
          <EnemyAtlas bossVariant={1} frame={frame} />
          <EnemyAtlas bossVariant={2} frame={frame} />

          {/* Debris sits behind the glow so smoke never washes out a spark. */}
          {PerfFlags.particles && (
            <>
              <ParticleLayer frame={frame} section={BSec.normal} capacity={NORMAL_CAP} />
              <ParticleLayer frame={frame} section={BSec.additive} capacity={ADDITIVE_CAP} additive />
            </>
          )}

          {PerfFlags.vfxPicture && <VfxPicture frame={frame} />}
        </Group>
      )}
    </Canvas>
  );
}
