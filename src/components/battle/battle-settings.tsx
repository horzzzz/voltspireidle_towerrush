import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog } from './confirm-dialog';
import { Toggle } from '@/components/settings/toggle';
import { Fonts, MenuColors } from '@/constants/theme';

type Settings = { music: boolean; sound: boolean; vibration: boolean; notification: boolean };
const DEFAULTS: Settings = { music: true, sound: false, vibration: true, notification: false };

type BattleSettingsProps = {
  visible: boolean;
  onClose: () => void;
  onRetire: () => void;
  /** Ends the run (if still active, banking whatever it earned) and leaves the battle screen. */
  onExit: () => void;
};

/**
 * In-battle settings overlay (Figma node 1:1606) — same toggle set and panel
 * chrome as the main menu's `src/app/settings.tsx`, plus Retire Run and
 * Exit to menu, which only exist here. Kept as its own local state rather
 * than wiring into a shared settings store — that unification is follow-up
 * work for when the other screens get their pass, not part of the battle
 * engine.
 *
 * A plain absolute-fill overlay, not RN's `<Modal>` — the battle screen
 * (`battle.tsx`) is itself presented as a `fullScreenModal` route, and
 * stacking RN's own native Modal window inside an already-modal route is
 * exactly what caused "start a new run and every button is dead": leaving
 * while that inner Modal was still open could strand its native
 * presentation as an invisible layer over whatever screen came next. A
 * plain View has no native lifecycle of its own to strand — it unmounts
 * with the rest of the screen, same as everything else here.
 */
export function BattleSettings({ visible, onClose, onRetire, onExit }: BattleSettingsProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
  const set = (key: keyof Settings) => (next: boolean) => setSettings((s) => ({ ...s, [key]: next }));

  // Without a native Modal there's no built-in `onRequestClose` for the
  // Android hardware back button — wire it up ourselves so it still closes
  // this overlay (or its confirm prompt) instead of falling through to
  // whatever's behind it.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitConfirmVisible) setExitConfirmVisible(false);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, exitConfirmVisible, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <View style={styles.panelInner}>
          <Row label="Music" value={settings.music} onChange={set('music')} />
          <Row label="Sound" value={settings.sound} onChange={set('sound')} />
          <View style={styles.groupGap} />
          <Row label="Vibration" value={settings.vibration} onChange={set('vibration')} />
          <Row label="Notification" value={settings.notification} onChange={set('notification')} />

          <Pressable onPress={onRetire} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Retire run</Text>
          </Pressable>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
          <Pressable
            onPress={() => setExitConfirmVisible(true)}
            style={({ pressed }) => [styles.button, styles.retireButton, pressed && styles.pressed]}>
            <Text style={[styles.buttonText, styles.retireText]}>To menu</Text>
          </Pressable>
        </View>
      </View>

      <ConfirmDialog
        visible={exitConfirmVisible}
        title="Exit to menu?"
        message="You'll keep everything earned so far, same as a defeat."
        confirmLabel="Exit"
        onCancel={() => setExitConfirmVisible(false)}
        onConfirm={() => {
          setExitConfirmVisible(false);
          onExit();
        }}
      />
    </View>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Toggle value={value} onChange={onChange} />
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
    maxWidth: 340,
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
    paddingTop: 28,
    paddingBottom: 24,
  },
  row: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontFamily: Fonts.grenzeMedium,
    fontSize: 22,
    lineHeight: 26,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  groupGap: { height: 20 },
  button: {
    height: 44,
    borderRadius: 10,
    marginTop: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(127,233,255,0.5)',
    backgroundColor: 'rgba(20,60,72,0.5)',
  },
  retireButton: {
    borderColor: 'rgba(255,138,30,0.6)',
    backgroundColor: 'rgba(80,40,10,0.4)',
  },
  pressed: { opacity: 0.75 },
  buttonText: {
    fontFamily: Fonts.grenzeSemiBold,
    fontSize: 15,
    color: MenuColors.text,
    textTransform: 'uppercase',
  },
  retireText: { color: '#ff8a1e' },
});
