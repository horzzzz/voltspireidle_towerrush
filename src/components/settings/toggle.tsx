import { StyleSheet, Text, View } from 'react-native';

import { GamePressable } from '@/components/ui/game-pressable';
import { Fonts } from '@/constants/theme';

const TRACK_W = 54;
const TRACK_H = 28;
const KNOB = 20;
const PAD = 4;

type ToggleProps = {
  value: boolean;
  onChange: (next: boolean) => void;
};

/** On/off switch styled after Figma node 1:267 / 1:273. */
export function Toggle({ value, onChange }: ToggleProps) {
  return (
    <GamePressable
      onPress={() => onChange(!value)}
      sfx="ui-toggle"
      hitSlop={10}
      style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
      <Text style={[styles.label, value ? styles.labelOn : styles.labelOff]}>
        {value ? 'on' : 'off'}
      </Text>
      <View
        style={[
          styles.knob,
          value ? styles.knobOn : styles.knobOff,
          { left: value ? TRACK_W - KNOB - PAD : PAD },
        ]}
      />
    </GamePressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: '#2c80ff' },
  trackOff: { backgroundColor: '#474747' },
  knob: {
    position: 'absolute',
    top: (TRACK_H - KNOB) / 2,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB,
    borderWidth: 1,
  },
  knobOn: { backgroundColor: '#1f9fd6', borderColor: '#00123f' },
  knobOff: { backgroundColor: '#c2c2c2', borderColor: '#5b5b5b' },
  label: {
    position: 'absolute',
    fontFamily: Fonts.grenzeMedium,
    fontSize: 13,
    lineHeight: 15,
    color: '#ffffff',
    textTransform: 'lowercase',
  },
  labelOn: { left: 9 },
  labelOff: { right: 8 },
});
