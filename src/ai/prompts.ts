import type { Budget } from '../core/nutrition';
import type { Decision } from '../core/decide';
import type { Lang } from '../core/types';

const LANG_NAME: Record<Lang, string> = { en: 'simple English', mr: 'simple Marathi (Devanagari)', hi: 'simple Hindi (Devanagari)' };

export function systemPrompt(lang: Lang, facts: string[]): string {
  return [
    'You are Sobat, a warm, practical health companion for one person in India.',
    `Reply in ${LANG_NAME[lang]}. Keep it under 120 words. Talk like a friend, not a doctor or a coach app.`,
    '',
    'Hard rules you must never break:',
    '- Never diagnose any condition and never tell the person to stop or change a medicine.',
    '- Never tell them to skip a meal, fast, or eat under the calorie floor given to you.',
    '- Never invent calorie numbers. Use only numbers given to you in the context.',
    '- If they sound very low or hopeless, gently suggest talking to a person they trust or a helpline.',
    '- No shame, no guilt, no lecturing about willpower. One bad day is just one day.',
    '',
    'What you know about them right now:',
    ...facts.map((f) => `- ${f}`),
  ].join('\n');
}

export function factsFrom(input: {
  budget: Budget;
  weightKg: number;
  goalWeightKg: number;
  kcalFloor: number;
  waterMl: number;
  waterGoalMl: number;
  sleepMinutes?: number;
  moodScore?: number;
  streak: number;
}): string[] {
  const f = [
    `Calorie target today: ${input.budget.target} kcal. Eaten so far: ${input.budget.consumed} kcal. Remaining: ${input.budget.remaining} kcal.`,
    `Protein: ${input.budget.proteinConsumed} of ${input.budget.proteinTarget} g.`,
    `Calorie floor, never advise below this: ${input.kcalFloor} kcal.`,
    `Weight ${input.weightKg} kg, goal ${input.goalWeightKg} kg.`,
    `Water ${input.waterMl} of ${input.waterGoalMl} ml today.`,
    `Logging streak: ${input.streak} days.`,
  ];
  if (input.sleepMinutes) f.push(`Last night's sleep: ${Math.floor(input.sleepMinutes / 60)}h ${input.sleepMinutes % 60}m.`);
  if (input.moodScore) f.push(`Mood today: ${input.moodScore} out of 5.`);
  return f;
}

/** The rules already decided what to do. The model only puts it into words. */
export function decisionPrompt(d: Decision, lang: Lang, actionText: string[]): string {
  return [
    `Situation decided by the app: ${d.situation} (severity ${d.severity}).`,
    `Numbers: ${d.facts.map((f) => `${f.label} ${f.value}`).join(', ')}.`,
    `The actions the app chose, keep all of them and do not add new ones: ${actionText.join('; ')}.`,
    d.nextMealMin > 0 ? `Next meal should be between ${d.nextMealMin} and ${d.nextMealMax} kcal.` : 'No more meals today.',
    '',
    'Write 2 or 3 short sentences to the person about this. Warm, specific, no lecture. Do not repeat the numbers as a list.',
  ].join('\n');
}

export const FOOD_PHOTO_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name_en: { type: 'string' },
          name_mr: { type: 'string' },
          portion: { type: 'string' },
          grams_est: { type: 'number' },
          confidence: { type: 'number' },
        },
        required: ['name_en', 'grams_est', 'confidence'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['items'],
} as const;

export function foodPhotoPrompt(examples: { predicted: string; corrected: string }[]): string {
  const lines = [
    'You are looking at a photo of a meal, most likely Indian and often Maharashtrian home food.',
    'List every distinct food item you can see.',
    'For each item give: name_en (common English or transliterated name, e.g. "Poha", "Varan Bhaat"),',
    'name_mr (the Marathi name in Devanagari if you know it, else an empty string),',
    'portion (a short human portion like "1 plate", "2 chapati", "1 katori"),',
    'grams_est (your estimate of the cooked weight in grams),',
    'confidence (0 to 1).',
    '',
    'Do NOT estimate calories. The app looks those up itself. Only name the food and the portion.',
    'If you are unsure between two dishes, pick the more common one and lower the confidence.',
  ];
  if (examples.length > 0) {
    lines.push('', 'This person corrected you before on similar photos. Learn from these:');
    for (const e of examples.slice(-10)) lines.push(`- you said "${e.predicted}", it was actually "${e.corrected}"`);
  }
  return lines.join('\n');
}


/** Extract only durable facts from a conversation turn, never today's numbers. */
export const MEMORY_SCHEMA = {
  type: 'object',
  properties: {
    memories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          type: { type: 'string', enum: ['fact', 'preference', 'goal'] },
        },
        required: ['text', 'type'],
      },
    },
  },
  required: ['memories'],
} as const;

export function memoryExtractionPrompt(userText: string, assistantText: string): string {
  return [
    'Read this exchange and pull out anything worth remembering about the person for future days.',
    '',
    `Person: ${userText}`,
    `Assistant: ${assistantText}`,
    '',
    'Only keep things that stay true beyond today: diet rules, allergies, injuries, dislikes, ',
    'work patterns, equipment they own, goals they state.',
    "Never store today's calories, weight, mood or any number that changes daily.",
    'Write each one as a short first-person sentence, as the person would say it.',
    'If there is nothing durable, return an empty list. Do not invent anything.',
  ].join('\n');
}

export function dailyTipPrompt(lang: Lang, focus: string[]): string {
  return [
    'Give this person one small, specific thing to try today.',
    focus.length > 0 ? `What stands out in their data right now: ${focus.join('; ')}.` : '',
    '',
    'Rules: two sentences at most. Something they can do today with what they already have.',
    'No generic advice like "eat healthy" or "exercise more". No numbers you were not given.',
    'Do not repeat the calorie target back at them.',
  ]
    .filter(Boolean)
    .join('\n');
}
