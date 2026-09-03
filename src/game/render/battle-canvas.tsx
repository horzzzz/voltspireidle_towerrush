import { Canvas, Circle, DashPathEffect, Group, Image, useCanvasSize, useImage } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { ARENA_HEIGHT, ARENA_WIDTH, ATTACK_RANGE, TOWER_X, TOWER_Y } from '@/game/data/arena';
import { ADDITIVE_CAP, G, NORMAL_CAP } from '@/game/vfx/layout';
import { EnemyAtlas } from './enemy-atlas';
import { TowerHealthRing } from './tower-health-ring';
import { ParticleLayer } from './vfx/particle-layer';
import { VfxPicture } from './vfx/vfx-picture';

const BG = require('@/assets/images/battle/bg.png');
const TOWER = require('@/assets/images/battle/tower.png');
const TOWER_SIZE = 132; // design px — matches the Figma tower_1 frame (~122×124)

type Props = {
  buffers: {
    scavenger: SharedValue<Float32Array>;
    hulk: SharedValue<Float32Array>;
    runner: SharedValue<Float32Array>;
    boss0: SharedValue<Float32Array>;
    boss1: SharedValue<Float32Array>;
    boss2: SharedValue<Float32Array>;
  };
  vfx: {
    additive: SharedValue<Float32Array>;
    normal: SharedValue<Float32Array>;
    numbers: SharedValue<Float32Array>;
    beams: SharedValue<Float32Array>;
    rings: SharedValue<Float32Array>;
    globals: SharedValue<Float32Array>;
    labels: SharedValue<string[]>;
    banner: SharedValue<string>;
  };
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
export function BattleCanvas({ buffers, vfx }: Props) {
  const { ref, size } = useCanvasSize();
  const bg = useImage(BG);
  const tower = useImage(TOWER);
  const scale = size.width > 0 ? size.width / ARENA_WIDTH : 0;

  // The tower alone carries the firing recoil, on top of whatever the scene
  // group is already doing.
  const towerTransform = useDerivedValue(() => [
    { translateX: vfx.globals.value[G.recoilX] },
    { translateY: vfx.globals.value[G.recoilY] },
  ]);

  const sceneTransform = useDerivedValue(
    () => [
      { scale },
      { translateX: vfx.globals.value[G.shakeX] },
      { translateY: vfx.globals.value[G.shakeY] },
    ],
    [scale],
  );

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

          <TowerHealthRing />

          <EnemyAtlas kind="scavenger" buffer={buffers.scavenger} />
          <EnemyAtlas kind="hulk" buffer={buffers.hulk} />
          <EnemyAtlas kind="runner" buffer={buffers.runner} />

          {/* Bosses draw on top of the regular swarm. */}
          <EnemyAtlas bossVariant={0} buffer={buffers.boss0} />
          <EnemyAtlas bossVariant={1} buffer={buffers.boss1} />
          <EnemyAtlas bossVariant={2} buffer={buffers.boss2} />

          {/* Debris sits behind the glow so smoke never washes out a spark. */}
          <ParticleLayer buffer={vfx.normal} capacity={NORMAL_CAP} />
          <ParticleLayer buffer={vfx.additive} capacity={ADDITIVE_CAP} additive />

          <VfxPicture
            numbers={vfx.numbers}
            numberLabels={vfx.labels}
            beams={vfx.beams}
            rings={vfx.rings}
            globals={vfx.globals}
            banner={vfx.banner}
          />
        </Group>
      )}
    </Canvas>
  );
}
