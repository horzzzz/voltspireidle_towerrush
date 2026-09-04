import { StyleSheet, Text, View } from 'react-native';

import { GamePressable } from '@/components/ui/game-pressable';
import { Fonts, MenuColors } from '@/constants/theme';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * In-theme stand-in for `Alert.alert` — same panel chrome (indigo border,
 * dark blue-grey fill) as `battle-settings.tsx`'s own panel, so a confirm
 * prompt reads as part of the game rather than the OS.
 *
 * Deliberately not RN's `<Modal>` — the whole battle screen has moved away
 * from native Modals entirely (see `battle-settings.tsx`, `game-over.tsx`):
 * stacking one inside `battle.tsx`'s `fullScreenModal` route was what
 * caused every button on the *next* run to stop responding after leaving
 * through it. This is a plain absolute-fill overlay, meant to be rendered
 * as a layer inside whatever screen/overlay opened it (currently
 * `battle-settings.tsx`), no native window involved at all.
 */
export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!visible) return null;

  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <View style={styles.panelInner}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.row}>
            <GamePressable
              onPress={onCancel}
              sfx="ui-back"
              style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>Cancel</Text>
            </GamePressable>
            <GamePressable
              onPress={onConfirm}
              style={({ pressed }) => [styles.button, styles.confirmButton, pressed && styles.pressed]}>
              <Text style={[styles.buttonText, styles.confirmText]}>{confirmLabel}</Text>
            </GamePressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(6,8,14,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3b19ff',
    backgroundColor: '#3b19ff',
    padding: 3,
  },
  panelInner: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: '#131c2e',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  title: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 19,
    color: MenuColors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    fontFamily: Fonts.grenzeMedium,
    fontSize: 15,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    borderColor: 'rgba(127,233,255,0.5)',
    backgroundColor: 'rgba(20,60,72,0.5)',
  },
  confirmButton: {
    borderColor: 'rgba(255,138,30,0.6)',
    backgroundColor: 'rgba(80,40,10,0.4)',
  },
  pressed: { opacity: 0.75 },
  buttonText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 14,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  confirmText: { color: '#ff8a1e' },
});
