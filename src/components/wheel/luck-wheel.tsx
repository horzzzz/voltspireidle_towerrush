import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { WHEEL_SECTOR_DEGREES } from '@/game/data/wheel';

const SECTORS = require('@/assets/images/wheel/sectors.png');
const RING = require('@/assets/images/wheel/ring.png');
const HUB = require('@/assets/images/wheel/hub.png');
const POINTER = require('@/assets/images/wheel/pointer.png');

/** How far the pointer is flicked aside at full spin speed, in degrees. */
const POINTER_KICK_DEGREES = 15;
/** Spin speed (deg/s) at which the pointer flick reaches full strength. */
const POINTER_KICK_FULL_SPEED = 500;

type Props = {
  rotation: SharedValue<number>;
  /** Enables the pointer's per-sector flick — off, the frame callback doesn't run. */
  spinning?: boolean;
};

/**
 * Wheel of Luck (Figma node 1:1475). Only the `sectors` layer (wedges + numbers
 * + prize icons, one baked image) rotates; the ring, hub and pointer are static.
 *
 * One procedural touch sits on top of that baked art: the pointer is flicked
 * aside as each sector edge passes under it, so a fast wheel visibly *ticks*.
 */
export function LuckWheel({ rotation, spinning }: Props) {
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pointerAngle = useSharedValue(0);
  const previousRotation = useSharedValue(0);

  useFrameCallback((info) => {
    const dt = Math.max(0.001, (info.timeSincePreviousFrame ?? 16) / 1000);
    const current = rotation.value;
    const speed = Math.abs(current - previousRotation.value) / dt;
    previousRotation.value = current;

    // Where we are inside the current sector, 0..1 — the flick peaks mid-sector
    // and returns to rest exactly on the boundary.
    const phase = (((current % WHEEL_SECTOR_DEGREES) + WHEEL_SECTOR_DEGREES) % WHEEL_SECTOR_DEGREES) /
      WHEEL_SECTOR_DEGREES;
    const strength = Math.min(1, speed / POINTER_KICK_FULL_SPEED);
    pointerAngle.value = -POINTER_KICK_DEGREES * strength * Math.sin(phase * Math.PI);
  }, spinning === true);

  const pointerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${pointerAngle.value}deg` }],
  }));

  return (
    <View style={styles.wheel}>
      <View style={styles.layer}>
        <Animated.View style={[styles.sectorsWrap, spinStyle]}>
          <Image source={SECTORS} style={styles.sectors} contentFit="contain" />
        </Animated.View>
      </View>

      <View style={styles.layer} pointerEvents="none">
        <Image source={RING} style={styles.ring} contentFit="contain" />
      </View>

      <View style={styles.layer} pointerEvents="none">
        <Image source={HUB} style={styles.hub} contentFit="contain" />
      </View>

      <View style={styles.pointerLayer} pointerEvents="none">
        <Animated.View style={[styles.pointerPivot, pointerStyle]}>
          <Image source={POINTER} style={styles.pointer} contentFit="contain" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wheel: { width: '100%', aspectRatio: 1 },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointerLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sectorsWrap: { width: '90%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  sectors: { width: '100%', height: '100%' },
  ring: { width: '100%', aspectRatio: 604 / 587 },
  hub: { width: '18%', aspectRatio: 169 / 171 },
  // The pointer pivots about its own top edge, so a flick swings the tip.
  pointerPivot: { width: '19%', aspectRatio: 209 / 181, marginTop: '-3%' },
  pointer: { width: '100%', height: '100%' },
});
