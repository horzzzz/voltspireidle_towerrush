import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GamePressable } from '@/components/ui/game-pressable';
import { ADS_ENABLED } from '@/constants/features';
import { Fonts, MenuColors } from '@/constants/theme';
import { useFxStore, type FxAnchor } from '@/game/state/fx-store';

const SCRAP_ICON = require('@/assets/images/menu/icon-scrap.png');
const GEM_ICON = require('@/assets/images/menu/icon-gem.png');
const ENERGY_PILL = require('@/assets/images/menu/energy-pill.png');

type TopBarProps = {
  scrap?: string;
  gems?: string;
  onEnergyPress?: () => void;
};

/**
 * One currency readout. Two jobs beyond showing a number: it publishes its own
 * on-screen position so a reward burst anywhere in the app can fly into it
 * (see game/state/fx-store.ts), and it pops when the value changes, so the
 * payout lands on something rather than silently re-rendering.
 */
function Balance({ anchor, value, children }: { anchor: FxAnchor; value: string; children: ReactNode }) {
  const ref = useRef<View>(null);
  const setAnchor = useFxStore((s) => s.setAnchor);
  const scale = useSharedValue(1);
  const previous = useRef(value);

  const onLayout = useCallback(() => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        setAnchor(anchor, { x: x + width / 2, y: y + height / 2 });
      }
    });
  }, [anchor, setAnchor]);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    scale.value = withSequence(withTiming(1.28, { duration: 110 }), withSpring(1, { damping: 9, stiffness: 220 }));
  }, [value, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View ref={ref} onLayout={onLayout} style={[styles.balance, style]}>
      {children}
      <Text style={styles.value}>{value}</Text>
    </Animated.View>
  );
}

/** Top HUD row: scrap + gem balances, energy pill (Figma node 1:114, y40). */
export function TopBar({ scrap = '0', gems = '0', onEnergyPress }: TopBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.balances}>
        <Balance anchor="scrap" value={scrap}>
          <Image source={SCRAP_ICON} style={styles.scrapIcon} contentFit="contain" />
        </Balance>
        <Balance anchor="gems" value={gems}>
          <Image source={GEM_ICON} style={styles.gemIcon} contentFit="contain" />
        </Balance>
      </View>
      { ADS_ENABLED &&
          <GamePressable onPress={onEnergyPress} hitSlop={8}>
            <Image source={ENERGY_PILL} style={styles.energy} contentFit="contain" />
          </GamePressable>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    height: 44,
  },
  balances: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scrapIcon: { width: 20, height: 24 },
  gemIcon: { width: 24, height: 22 },
  value: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 20,
    color: MenuColors.text,
  },
  energy: { width: 92, height: 31 },
});
