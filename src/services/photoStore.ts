import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Where a queued food photo's bytes live: one storage key per photo, never
 * inside the app state.
 *
 * A camera image at picker quality 0.6 is two to four megabytes as base64.
 * Kept in the state it went into the same AsyncStorage row as everything
 * else, and Android can write such a row but not read it back, so one
 * photo taken while the PC was off meant the whole store failed to load on
 * the next launch. Here each photo is first shrunk to what the model needs
 * and then kept on its own, so the worst a bad photo can do is lose itself.
 */

const PREFIX = 'sobat.photo.';
/** Longest side the vision model is given. Plenty for a plate; a tenth of the bytes. */
export const MAX_SIDE = 1024;
export const JPEG_QUALITY = 0.7;

export type Shrunk = { base64: string; uri: string; width: number; height: number };

/** A JPEG no larger than MAX_SIDE on its longest side, with its base64. */
export async function shrink(uri: string, width?: number, height?: number): Promise<Shrunk> {
  const ctx = ImageManipulator.manipulate(uri);
  // Only one side is given so the other follows the aspect ratio; an image
  // already small enough is re-encoded as JPEG without resizing.
  if (width && height && (width > MAX_SIDE || height > MAX_SIDE)) {
    ctx.resize(width >= height ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  } else if (!width || !height) {
    ctx.resize({ width: MAX_SIDE, height: null });
  }
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
  if (!out.base64) throw new Error('no base64');
  return { base64: out.base64, uri: out.uri, width: out.width, height: out.height };
}

export async function savePhoto(id: string, base64: string): Promise<void> {
  await AsyncStorage.setItem(PREFIX + id, base64);
}

export async function loadPhoto(id: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PREFIX + id);
  } catch {
    return null;
  }
}

export async function removePhoto(id: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + id).catch(() => {});
}

/** Drop any photo the queue no longer knows: a crash between two steps can leave one behind. */
export async function prunePhotos(keepIds: string[]): Promise<void> {
  try {
    const keep = new Set(keepIds.map((id) => PREFIX + id));
    const stale = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX) && !keep.has(k));
    if (stale.length) await AsyncStorage.multiRemove(stale);
  } catch {
    // Housekeeping only; nothing depends on it.
  }
}
