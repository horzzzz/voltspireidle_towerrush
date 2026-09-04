import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { playSfx } from '@/game/audio/engine';
import type { SfxId } from '@/game/audio/sfx';

type GamePressableProps = PressableProps & {
  /**
   * Which clip a successful press plays. Defaults to `ui-click`; the usual
   * override is `ui-back` on a Back/Close button, or `ui-toggle` on a switch.
   * Ignored when the press is rejected — that always plays `ui-denied`.
   */
  sfx?: SfxId;
  /**
   * Skips the press sound entirely — for a Pressable that already fires its
   * own dedicated sound, or one that shouldn't click at all (a backdrop
   * wrapping a panel that is itself pressable).
   */
  silent?: boolean;
};

/**
 * Drop-in `Pressable` that plays the shared UI sounds on press. Every button
 * in the app uses this instead of the raw RN component, so the feedback is
 * consistent and can't be forgotten on a new one.
 *
 * Fires on `onPressIn`, not `onPress`: finger-down is what reads as an instant
 * response, and `onPress` doesn't land until finger-up, which would make the
 * click lag the button's own visual press state — most buttons here already
 * scale down on `onPressIn`.
 *
 * `disabled` is handled here rather than handed to `Pressable`, which would
 * stop dispatching touches entirely and leave a locked button completely
 * silent — a tap that does nothing *and* says nothing reads as the app being
 * broken. Instead a disabled press plays the rejection blip and goes no
 * further: the caller's own handlers never run, `pressed` is forced false so
 * the button doesn't animate as though it worked, and `accessibilityState`
 * still reports the button as disabled the way `Pressable` used to do for us.
 */
export const GamePressable = forwardRef<ComponentRef<typeof Pressable>, GamePressableProps>(
  function GamePressable(
    {
      onPressIn,
      onPress,
      onPressOut,
      onLongPress,
      disabled,
      sfx = 'ui-click',
      silent,
      style,
      children,
      accessibilityState,
      ...props
    },
    ref,
  ) {
    const handlePressIn = (event: GestureResponderEvent) => {
      if (!silent) playSfx(disabled ? 'ui-denied' : sfx);
      if (!disabled) onPressIn?.(event);
    };

    const enabledOnly = <T,>(handler: T): T | undefined => (disabled ? undefined : handler);

    // `style` and `children` may be render functions of `{ pressed }`. Since
    // Pressable no longer knows this button is disabled, mask `pressed` here.
    const notPressed = (state: PressableStateCallbackType): PressableStateCallbackType =>
      disabled ? { ...state, pressed: false } : state;

    return (
      <Pressable
        ref={ref}
        onPressIn={handlePressIn}
        onPress={enabledOnly(onPress)}
        // Always forwarded, unlike the others: it only ever resets a visual
        // press state, and a disabled press never set one (its `onPressIn`
        // wasn't forwarded), so letting it through is harmless — while
        // blocking it could strand a button mid-press if it happened to become
        // disabled between finger-down and finger-up.
        onPressOut={onPressOut}
        onLongPress={enabledOnly(onLongPress)}
        accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
        style={
          typeof style === 'function'
            ? (state: PressableStateCallbackType): StyleProp<ViewStyle> => style(notPressed(state))
            : style
        }
        {...props}>
        {typeof children === 'function'
          ? (state: PressableStateCallbackType): ReactNode => children(notPressed(state))
          : children}
      </Pressable>
    );
  },
);
