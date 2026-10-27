import { FOOD_PHOTO_SCHEMA } from './prompts';

export type AIRoute = 'primary' | 'fallback' | 'offline' | 'checking';

export type OllamaMessage = { role: 'system' | 'user' | 'assistant'; content: string; images?: string[] };

const HEALTH_TIMEOUT = 2500;
const CHAT_TIMEOUT = 120000;

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
  return u;
}

/**
 * An https page may not fetch an http address: the browser blocks it as
 * mixed content before a request is made. The hosted site is https and
 * Ollama is http on a LAN, so this is the normal case for everyone but the
 * admin at home, and it is better said than tried.
 */
export function isMixedContent(url: string, pageProtocol: string): boolean {
  if (pageProtocol !== 'https:') return false;
  const u = normalizeUrl(url);
  return !!u && /^http:\/\//i.test(u);
}

export async function listModels(url: string): Promise<string[]> {
  const base = normalizeUrl(url);
  if (!base) return [];
  const res = await withTimeout((signal) => fetch(`${base}/api/tags`, { signal }), HEALTH_TIMEOUT);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { models?: { name: string }[] };
  return (json.models ?? []).map((m) => m.name);
}

export async function isUp(url: string): Promise<boolean> {
  try {
    await listModels(url);
    return true;
  } catch {
    return false;
  }
}

/** Try the home address first, then the remote one. Returns which worked. */
export async function resolveRoute(primary: string, fallback: string): Promise<{ route: AIRoute; url: string }> {
  if (primary && (await isUp(primary))) return { route: 'primary', url: normalizeUrl(primary) };
  if (fallback && (await isUp(fallback))) return { route: 'fallback', url: normalizeUrl(fallback) };
  return { route: 'offline', url: '' };
}

export async function chat(
  url: string,
  model: string,
  messages: OllamaMessage[],
  opts: { json?: object; temperature?: number } = {},
): Promise<string> {
  const base = normalizeUrl(url);
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    options: { temperature: opts.temperature ?? 0.6 },
  };
  if (opts.json) body.format = opts.json;
  // qwen3 thinks out loud before answering unless told not to: slower, and the
  // thinking can leak into the reply. `think` sits at the top level of /api/chat.
  if (/^qwen3/i.test(model)) body.think = false;

  const res = await withTimeout(
    (signal) =>
      fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
    CHAT_TIMEOUT,
  );
  if (!res.ok) throw new Error(`Ollama returned HTTP ${res.status}`);
  const json = (await res.json()) as { message?: { content?: string } };
  const content = json.message?.content ?? '';
  return opts.json ? content : plainText(content);
}

/**
 * Chat replies are shown as plain text, so markdown asterisks would show up
 * as asterisks. Bullets become "•"; an older Ollama that puts the thinking in
 * the content gets it removed.
 */
export function plainText(reply: string): string {
  return reply
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/^(\s*)\*\s+/gm, '$1• ')
    .replace(/\*+/g, '')
    .trim();
}

/** Ask for JSON and parse it, tolerating a model that wraps output in prose or fences. */
export async function chatJSON<T>(url: string, model: string, messages: OllamaMessage[], schema: object): Promise<T> {
  const raw = await chat(url, model, messages, { json: schema, temperature: 0.2 });
  const parsed = parseLooseJSON<unknown>(raw);
  return (schema === FOOD_PHOTO_SCHEMA ? cleanFoodPhoto(parsed) : parsed) as T;
}

export type FoodPhotoItem = { name_en: string; name_mr: string; portion: string; grams_est: number | null; confidence: number };
export type FoodPhoto = { items: FoodPhotoItem[]; notes?: string };

const PHOTO_GRAMS = { min: 20, max: 800 };

/**
 * The vision model's answer, made safe to use: items without a name are
 * dropped, and grams are a number clamped to 20-800 or null when the model
 * gave no number. Null lets the screens fall back to the food's normal
 * portion, so "a plate" can never turn into NaN kcal in the day's budget.
 */
export function cleanFoodPhoto(raw: unknown): FoodPhoto {
  const obj = raw && typeof raw === 'object' ? (raw as { items?: unknown; notes?: unknown }) : {};
  const list = Array.isArray(obj.items) ? obj.items : [];
  const items: FoodPhotoItem[] = [];
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    const v = it as Record<string, unknown>;
    const name = typeof v.name_en === 'string' ? v.name_en.trim() : '';
    if (!name) continue;
    items.push({
      name_en: name,
      name_mr: typeof v.name_mr === 'string' ? v.name_mr : '',
      portion: typeof v.portion === 'string' ? v.portion : '',
      grams_est: photoGrams(v.grams_est),
      confidence: typeof v.confidence === 'number' && Number.isFinite(v.confidence) ? Math.min(1, Math.max(0, v.confidence)) : 0.5,
    });
  }
  return typeof obj.notes === 'string' ? { items, notes: obj.notes } : { items };
}

function photoGrams(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(PHOTO_GRAMS.max, Math.max(PHOTO_GRAMS.min, Math.round(n)));
}

export function parseLooseJSON<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error('Model did not return JSON');
  }
}
