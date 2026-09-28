import { Platform } from 'react-native';
import type { ForegroundState } from '../core/breaks';

/**
 * The few things that differ per platform. Everything else in the app is
 * written once. In a browser the app can only see activity inside its own
 * window; the Windows shell reports real system idle time instead.
 */

type TauriGlobal = { __TAURI__?: unknown };

export function isDesktopShell(): boolean {
  return Platform.OS === 'web' && typeof globalThis !== 'undefined' && '__TAURI__' in (globalThis as TauriGlobal);
}

export async function systemIdleSeconds(): Promise<number | null> {
  if (!isDesktopShell()) return null;
  try {
    const mod = await import('@tauri-apps/api/core');
    return await mod.invoke<number>('get_idle_seconds');
  } catch {
    return null;
  }
}

export async function enableAutostart(): Promise<boolean> {
  if (!isDesktopShell()) return false;
  try {
    const mod = await import('@tauri-apps/plugin-autostart');
    await mod.enable();
    return true;
  } catch {
    return false;
  }
}

export async function isAutostartEnabled(): Promise<boolean> {
  if (!isDesktopShell()) return false;
  try {
    const mod = await import('@tauri-apps/plugin-autostart');
    return await mod.isEnabled();
  } catch {
    return false;
  }
}

/**
 * What a plain browser tab can work out about itself. A tab cannot see other
 * programs, so `exe` is always empty and the app list never matches here.
 */
export function browserForegroundState(): ForegroundState | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const doc = document as Document & { pictureInPictureElement?: Element | null };
  const fullscreen = document.fullscreenElement !== null || !!doc.pictureInPictureElement;
  return { fullscreen, exe: '', onCall: false };
}

/**
 * What the Windows shell can see about the window in front. Falls back to
 * what a plain browser tab can see about itself when the shell is absent.
 */
export async function foregroundState(): Promise<ForegroundState | null> {
  if (!isDesktopShell()) return browserForegroundState();
  try {
    const mod = await import('@tauri-apps/api/core');
    const raw = await mod.invoke<{ fullscreen: boolean; exe: string; onCall: boolean }>('foreground_state');
    return { fullscreen: !!raw.fullscreen, exe: String(raw.exe ?? ''), onCall: !!raw.onCall };
  } catch {
    // The command is missing or failed; fall back to what the page can see.
    return browserForegroundState();
  }
}
