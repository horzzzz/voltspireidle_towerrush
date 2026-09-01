import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

const SECTORS = require('@/assets/images/wheel/sectors.png');
const RING = require('@/assets/images/wheel/ring.png');
const HUB = require('@/assets/images/wheel/hub.png');
const POINTER = require('@/assets/images/wheel/pointer.png');

/**
 * Wheel of Luck (Figma node 1:1475). Only the `sectors` layer (wedges + numbers
 * + prize icons, one baked image) rotates; the ring, hub and pointer are static.
 */
export function LuckWheel({ rotation }: { rotation: SharedValue<number> }) {
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
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
        <Image source={POINTER} style={styles.pointer} contentFit="contain" />
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
  pointer: { width: '19%', aspectRatio: 209 / 181, marginTop: '-3%' },
});
