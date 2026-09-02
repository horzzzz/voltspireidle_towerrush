import { Canvas, Circle, DashPathEffect, Group, Image, useCanvasSize, useImage } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { ARENA_HEIGHT, ARENA_WIDTH, ATTACK_RANGE, TOWER_X, TOWER_Y } from '@/game/data/arena';
import { EffectsLayer } from './effects-layer';
import { EnemyAtlas } from './enemy-atlas';
import { TowerHealthRing } from './tower-health-ring';

const BG = require('@/assets/images/battle/bg.png');
const TOWER = require('@/assets/images/battle/tower.png');
const TOWER_SIZE = 132; // design px — matches the Figma tower_1 frame (~122×124)

type Props = {
  buffers: {
    scavenger: SharedValue<Float32Array>;
    hulk: SharedValue<Float32Array>;
    runner: SharedValue<Float32Array>;
  };
};

/**
 * The whole battle scene in one Skia canvas. Everything draws in fixed
 * 430×932 design-space coordinates (see data/arena.ts) inside a `<Group>`
 * scaled to the measured canvas size — the sim never needs to know the
 * device's actual pixel width.
 */
export function BattleCanvas({ buffers }: Props) {
  const { ref, size } = useCanvasSize();
  const bg = useImage(BG);
  const tower = useImage(TOWER);
  const scale = size.width > 0 ? size.width / ARENA_WIDTH : 0;

  return (
    <Canvas ref={ref} style={StyleSheet.absoluteFill}>
      {scale > 0 && (
        <Group transform={[{ scale }]}>
          {bg && <Image image={bg} x={0} y={0} width={ARENA_WIDTH} height={ARENA_HEIGHT} fit="cover" />}

          <Circle cx={TOWER_X} cy={TOWER_Y} r={ATTACK_RANGE} style="stroke" strokeWidth={1.5} color="#3fd0ff" opacity={0.35}>
            <DashPathEffect intervals={[6, 6]} />
          </Circle>

          {tower && (
            <Image
              image={tower}
              x={TOWER_X - TOWER_SIZE / 2}
              y={TOWER_Y - TOWER_SIZE / 2}
              width={TOWER_SIZE}
              height={TOWER_SIZE}
              fit="contain"
            />
          )}

          <TowerHealthRing />

          <EnemyAtlas kind="scavenger" buffer={buffers.scavenger} />
          <EnemyAtlas kind="hulk" buffer={buffers.hulk} />
          <EnemyAtlas kind="runner" buffer={buffers.runner} />

          <EffectsLayer />
        </Group>
      )}
    </Canvas>
  );
}
