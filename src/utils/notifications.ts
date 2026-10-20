import { NAMI_LOGO_PATH } from '../types/nami.ts';

export type BrowserNotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as BrowserNotificationPermission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result as BrowserNotificationPermission;
  } catch {
    return Notification.permission as BrowserNotificationPermission;
  }
}

/**
 * Plays a subtle futuristic Web Audio completion chime when a Node Run completes
 */
export function playCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18); // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Ignore audio context restriction errors
  }
}

/**
 * Triggers a browser Notification API alert (with chime fallback).
 * Returns true if native Notification was dispatched.
 */
export function triggerNodeRunCompletionNotification(options: {
  title: string;
  body: string;
  tag?: string;
  onFocusClick?: () => void;
}): boolean {
  playCompletionChime();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    try {
      const notif = new Notification(options.title, {
        body: options.body,
        icon: NAMI_LOGO_PATH,
        badge: NAMI_LOGO_PATH,
        tag: options.tag || 'nami-node-run-complete',
      });

      notif.onclick = () => {
        window.focus();
        if (options.onFocusClick) {
          options.onFocusClick();
        }
        notif.close();
      };
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
