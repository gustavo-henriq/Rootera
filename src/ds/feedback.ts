/**
 * Non-visual feedback in one place, so the same event always feels the same:
 *  - haptics: `select` for choosing an option, `success` for a saved record,
 *    `error` for a failed save, `bloom` for a celebration.
 *  - announce: speaks a status message with VoiceOver. Android reads
 *    accessibilityLiveRegion on its own; iOS needs an explicit announcement.
 * Both are silent on the web and never throw.
 */
import { AccessibilityInfo, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const native = Platform.OS === 'ios' || Platform.OS === 'android';
const safe = (p: Promise<unknown>) => { p.catch(() => undefined); };

export const haptic = {
  select: () => { if (native) safe(Haptics.selectionAsync()); },
  tap: () => { if (native) safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); },
  success: () => { if (native) safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); },
  error: () => { if (native) safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)); },
  bloom: () => { if (native) safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); },
};

export function announce(message: string) {
  if (Platform.OS === 'ios' && message) AccessibilityInfo.announceForAccessibility(message);
}
