import { useCallback, useEffect, useRef, useState } from 'react';
import { chat, chatJSON, resolveRoute, type AIRoute, type OllamaMessage } from '../ai/ollama';
import { useApp } from '../store/AppProvider';

export type AIState = { route: AIRoute; url: string; checking: boolean };

/**
 * Finds a reachable Ollama once, then re-checks in the background.
 * Every screen reads the same status so the badge is consistent.
 */
export function useAI() {
  const { state } = useApp();
  const { ollamaUrl, ollamaFallbackUrl, textModel, visionModel } = state.settings;
  const [ai, setAI] = useState<AIState>({ route: 'checking', url: '', checking: true });
  const mounted = useRef(true);

  const check = useCallback(async () => {
    // Nothing is set before the await. This runs straight from an effect, and
    // a synchronous setState there cascades renders; the badge already starts
    // on 'checking', and a silent re-check every minute beats flickering the
    // status back to 'checking' when the PC has been reachable all along.
    const r = await resolveRoute(ollamaUrl, ollamaFallbackUrl);
    if (!mounted.current) return r;
    setAI({ route: r.route, url: r.url, checking: false });
    return r;
  }, [ollamaUrl, ollamaFallbackUrl]);

  useEffect(() => {
    mounted.current = true;
    void check();
    const t = setInterval(check, 60000);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [check]);

  const ask = useCallback(
    async (messages: OllamaMessage[]): Promise<string> => {
      let url = ai.url;
      if (!url) {
        const r = await check();
        url = r.url;
      }
      if (!url) throw new Error('offline');
      return chat(url, textModel, messages);
    },
    [ai.url, check, textModel],
  );

  const askJSON = useCallback(
    async <T,>(messages: OllamaMessage[], schema: object, useVision = false): Promise<T> => {
      let url = ai.url;
      if (!url) {
        const r = await check();
        url = r.url;
      }
      if (!url) throw new Error('offline');
      return chatJSON<T>(url, useVision ? visionModel : textModel, messages, schema);
    },
    [ai.url, check, textModel, visionModel],
  );

  return { ai, check, ask, askJSON, online: ai.route === 'primary' || ai.route === 'fallback' };
}
