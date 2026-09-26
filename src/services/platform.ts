import { Platform } from 'react-native';

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
