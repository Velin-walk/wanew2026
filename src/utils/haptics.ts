/**
 * Safe haptic micro-cues utility for mobile browsers & PWA
 */
export const triggerHaptic = (pattern: number | number[] = 15): boolean => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }
  return false;
};
