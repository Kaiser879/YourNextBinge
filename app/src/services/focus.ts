import {findNodeHandle} from 'react-native';
import {FocusManager} from '@amazon-devices/react-native-kepler';

/**
 * Safe wrapper around FocusManager.focus.
 *
 * Native focus primitives are unavailable in the Jest environment (and can be
 * missing on some builds), so every call goes through this guard instead of
 * assuming findNodeHandle/FocusManager exist.
 */
export function focusNode(node: unknown): boolean {
  if (!node || typeof findNodeHandle !== 'function') {
    return false;
  }

  const handle = findNodeHandle(node as never);
  if (handle == null) {
    return false;
  }

  try {
    FocusManager?.focus?.(handle);
    return true;
  } catch {
    return false;
  }
}

export function setNextFocus(
  from: unknown,
  to: unknown,
  direction: 'up' | 'down' | 'left' | 'right',
): void {
  if (
    !from ||
    !to ||
    typeof findNodeHandle !== 'function' ||
    typeof FocusManager?.setNextFocus !== 'function'
  ) {
    return;
  }

  const fromHandle = findNodeHandle(from as never);
  const toHandle = findNodeHandle(to as never);
  if (fromHandle == null || toHandle == null) {
    return;
  }

  try {
    FocusManager.setNextFocus(fromHandle, toHandle, direction);
  } catch {
    // Focus hints are best-effort; navigation still works without them.
  }
}
