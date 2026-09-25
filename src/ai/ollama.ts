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
  return json.message?.content ?? '';
}

/** Ask for JSON and parse it, tolerating a model that wraps output in prose or fences. */
export async function chatJSON<T>(url: string, model: string, messages: OllamaMessage[], schema: object): Promise<T> {
  const raw = await chat(url, model, messages, { json: schema, temperature: 0.2 });
  return parseLooseJSON<T>(raw);
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
