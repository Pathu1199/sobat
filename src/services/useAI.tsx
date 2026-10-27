import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { chat, chatJSON, isMixedContent, resolveRoute, type AIRoute, type OllamaMessage } from '../ai/ollama';
import { asksAboutFasting, guardAdvice } from '../core/guardrails';
import { KCAL_FLOOR } from '../core/nutrition';
import { fastingReply } from '../core/offlineCoach';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useAuth } from './useAuth';

/**
 * The one connection to Ollama. Mounted once; every badge, card and screen
 * reads the same status, and there is one re-check a minute for the whole
 * app rather than one per card.
 *
 * The PC is only asked at all when this person may use the AI (the admin,
 * or anyone when there is no sign-in) and the page is allowed to reach it:
 * an https site cannot fetch an http address, so on the hosted site a
 * localhost or LAN address is simply reported as off instead of being
 * tried, blocked and logged sixty times an hour.
 *
 * `ask` returns model text that has already been through the guardrails for
 * this person's calorie floor, so no screen can forget to check it. Unsafe
 * text is replaced, not annotated, and a question about fasting or skipping
 * meals is answered by the code without asking the model at all.
 */
export type AIState = { route: AIRoute; url: string; checking: boolean };
export type AIBlocked = null | 'not_allowed' | 'mixed_content';

type AI = {
  ai: AIState;
  online: boolean;
  /** Why the PC is not even asked, when it is not. */
  blocked: AIBlocked;
  check: () => Promise<{ route: AIRoute; url: string }>;
  /** Model text, checked against the guardrails. What every screen should use. */
  ask: (messages: OllamaMessage[]) => Promise<string>;
  /** Model text as it came. Only for callers that check it themselves. */
  askRaw: (messages: OllamaMessage[]) => Promise<string>;
  askJSON: <T>(messages: OllamaMessage[], schema: object, useVision?: boolean) => Promise<T>;
};

const CHECK_EVERY_MS = 60000;
const OFFLINE: AIState = { route: 'offline', url: '', checking: false };

const Ctx = createContext<AI | null>(null);

function pageProtocol(): string {
  return Platform.OS === 'web' && typeof location !== 'undefined' ? location.protocol : 'app:';
}

export function AIProvider({ children }: { children: React.ReactNode }) {
  const { state, targets } = useApp();
  const { canUseAI } = useAuth();
  const { ollamaUrl, ollamaFallbackUrl, textModel, visionModel } = state.settings;
  const floor = KCAL_FLOOR[state.profile.sex];
  const lang = state.profile.lang;
  const kcalTarget = targets.kcal;

  // Which of the two addresses this page may even try.
  const protocol = pageProtocol();
  const primary = isMixedContent(ollamaUrl, protocol) ? '' : ollamaUrl;
  const fallback = isMixedContent(ollamaFallbackUrl, protocol) ? '' : ollamaFallbackUrl;
  const blocked: AIBlocked = !canUseAI ? 'not_allowed' : !primary && !fallback && (ollamaUrl || ollamaFallbackUrl) ? 'mixed_content' : null;

  const [ai, setAI] = useState<AIState>({ route: 'checking', url: '', checking: true });
  const mounted = useRef(true);

  const check = useCallback(async () => {
    if (blocked) return { route: 'offline' as AIRoute, url: '' };
    // Nothing is set before the await: this runs straight from an effect,
    // and a silent re-check beats flickering the badge back to 'checking'.
    const r = await resolveRoute(primary, fallback);
    if (mounted.current) setAI({ route: r.route, url: r.url, checking: false });
    return r;
  }, [blocked, primary, fallback]);

  useEffect(() => {
    mounted.current = true;
    if (blocked) return;
    void check();
    const t = setInterval(check, CHECK_EVERY_MS);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [check, blocked]);

  const askRaw = useCallback(
    async (messages: OllamaMessage[]): Promise<string> => {
      if (blocked) throw new Error('offline');
      let url = ai.url;
      if (!url) url = (await check()).url;
      if (!url) throw new Error('offline');
      return chat(url, textModel, messages);
    },
    [blocked, ai.url, check, textModel],
  );

  const ask = useCallback(
    async (messages: OllamaMessage[]) => {
      const t = makeT(lang);
      const last = messages[messages.length - 1];
      if (last?.role === 'user' && asksAboutFasting(last.content)) return fastingReply(t, kcalTarget);
      const words = { food: fill(t('guard_food'), { floor }), medical: t('guard_medical') };
      return guardAdvice(await askRaw(messages), floor, words).text.trim();
    },
    [askRaw, floor, lang, kcalTarget],
  );

  const askJSON = useCallback(
    async <T,>(messages: OllamaMessage[], schema: object, useVision = false): Promise<T> => {
      if (blocked) throw new Error('offline');
      let url = ai.url;
      if (!url) url = (await check()).url;
      if (!url) throw new Error('offline');
      return chatJSON<T>(url, useVision ? visionModel : textModel, messages, schema);
    },
    [blocked, ai.url, check, textModel, visionModel],
  );

  const shown = blocked ? OFFLINE : ai;
  const value: AI = { ai: shown, online: shown.route === 'primary' || shown.route === 'fallback', blocked, check, ask, askRaw, askJSON };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAI(): AI {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAI must be used inside AIProvider');
  return c;
}
