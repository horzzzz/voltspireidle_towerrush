import { Image } from 'expo-image';
import { useTabTrigger } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuColors } from '@/constants/theme';

const ACTIVE_FRAME = require('@/assets/images/menu/nav-active.png');

type NavItem = { name: string; icon: number };

// Order matches Figma node 1:114 with the two locked slots removed.
const ITEMS: NavItem[] = [
  { name: 'game', icon: require('@/assets/images/menu/nav-game.png') },
  { name: 'upgrades', icon: require('@/assets/images/menu/nav-upgrades.png') },
  { name: 'chips', icon: require('@/assets/images/menu/nav-chips.png') },
  { name: 'milestones', icon: require('@/assets/images/menu/nav-milestones.png') },
  { name: 'missions', icon: require('@/assets/images/menu/nav-missions.png') },
  { name: 'relics', icon: require('@/assets/images/menu/nav-relics.png') },
];

const ICON_SIZE = 30;
const ACTIVE_SIZE = 48;

/** Bottom navigation bar (Figma node 1:114). Custom game art, headless tabs. */
export function BottomNav() {
  const { bottom } = useSafeAreaInsets();
  const { switchTab, getTrigger } = useTabTrigger({ name: 'game' });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottom, 8) }]}>
      {ITEMS.map((item) => {
        const focused = Boolean(getTrigger(item.name)?.isFocused);
        return (
          <Pressable
            key={item.name}
            onPress={() => switchTab(item.name, {})}
            style={styles.item}
            hitSlop={6}>
            {focused && (
              <Image
                source={ACTIVE_FRAME}
                style={styles.activeFrame}
                contentFit="contain"
                pointerEvents="none"
              />
            )}
            <Image
              source={item.icon}
              style={[styles.icon, focused && styles.iconFocused]}
              contentFit="contain"
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 12,
    paddingHorizontal: 8,
    backgroundColor: MenuColors.navBar,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: MenuColors.navBorder,
  },
  item: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    opacity: 0.85,
  },
  iconFocused: {
    opacity: 1,
  },
  activeFrame: {
    position: 'absolute',
    width: ACTIVE_SIZE,
    height: ACTIVE_SIZE,
  },
});
