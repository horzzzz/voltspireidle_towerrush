import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BattleSettings } from '@/components/battle/battle-settings';
import { GameOver } from '@/components/battle/game-over';
import { HudTop } from '@/components/battle/hud-top';
import { UpgradeBar } from '@/components/battle/upgrade-bar';
import { MenuColors } from '@/constants/theme';
import type { RunSummary } from '@/game/core/types';
import { buildRunLoadout } from '@/game/economy/loadout';
import { useBattleStore } from '@/game/state/battle-store';
import { useMetaStore } from '@/game/state/meta-store';
import { BattleCanvas } from '@/game/render/battle-canvas';
import { useBattleEngine } from '@/game/render/use-battle-engine';

/** Battle screen — the whole "Tap Battle" loop (Figma nodes 1:1512/1:1559). */
export default function BattleScreen() {
  // Built once per screen mount from the player's persisted Coilworks levels
  // and selected Voltage — a run's loadout never changes mid-run even if the
  // player somehow altered meta state elsewhere (they can't, but this keeps
  // the sim's own state as the only source of truth once it starts).
  const coilworks = useMetaStore((s) => s.coilworks);
  const coilworksUnlocked = useMetaStore((s) => s.coilworksUnlocked);
  const voltage = useMetaStore((s) => s.voltage);
  const chips = useMetaStore((s) => s.chips);
  const loadout = useMemo(
    () => buildRunLoadout(coilworks, voltage, coilworksUnlocked, chips.equipped, chips.levels),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadout is intentionally frozen for the run's lifetime
    [],
  );

  const { frame, actions } = useBattleEngine(loadout);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const result = useBattleStore((s) => s.result);
  const bankRun = useMetaStore((s) => s.bankRun);

  // Bank the run's Scrap/Gems into the persisted meta total the moment the
  // run ends — not on "Restart" — so it survives even if the player backs
  // out of the game-over overlay instead of tapping through it. Shared by
  // the reactive effect below and handleExitToMenu (which needs the bank to
  // have happened *before* it navigates away, not on the next render).
  const bankedResultRef = useRef<RunSummary | null>(null);
  const bankResult = useCallback(
    (r: RunSummary | null) => {
      if (r && r !== bankedResultRef.current) {
        bankedResultRef.current = r;
        bankRun(r);
      }
    },
    [bankRun],
  );

  useEffect(() => {
    bankResult(result);
  }, [result, bankResult]);

  // Retires the run (a no-op if it already ended) and banks its Scrap
  // synchronously — not via the reactive effect above, which wouldn't run
  // before this screen unmounts — then leaves. Used by both the mid-run
  // settings overlay and the post-run game-over overlay; both are plain
  // View overlays (not RN's `<Modal>`, see battle-settings.tsx for why), so
  // there's no native modal lifecycle to wait out before navigating away.
  const handleExitToMenu = useCallback(() => {
    actions.retire();
    bankResult(useBattleStore.getState().result);
    router.back();
  }, [actions, bankResult]);

  return (
    <View style={styles.container}>
      <BattleCanvas frame={frame} />

      <View style={styles.overlay} pointerEvents="box-none">
        <HudTop onSettingsPress={() => setSettingsVisible(true)} onSetSpeed={actions.setSpeed} />
        <View style={styles.spacer} pointerEvents="none" />
        <UpgradeBar onBuy={actions.buyUpgrade} />
      </View>

      <BattleSettings
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onRetire={() => {
          setSettingsVisible(false);
          actions.retire();
        }}
        onExit={handleExitToMenu}
      />

      <GameOver result={result} onRestart={actions.restart} onExit={handleExitToMenu} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MenuColors.bg },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-start' },
  spacer: { flex: 1 },
});
