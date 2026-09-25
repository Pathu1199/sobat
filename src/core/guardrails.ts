export const HELPLINES = [
  { name: 'Tele-MANAS', number: '14416', note: 'Government of India, 24x7, many languages' },
  { name: 'KIRAN', number: '1800-599-0019', note: 'Ministry of Social Justice, 24x7' },
  { name: 'iCall', number: '9152987821', note: 'TISS, Mon to Sat, 10am to 8pm' },
];

// Devanagari is not a \w character in JavaScript, so \b never matches next to
// it. These patterns are deliberately written without word boundaries.
const CRISIS_PATTERNS = [
  /\bkill myself\b/i, /\bsuicid/i, /\bend my life\b/i, /\bwant to die\b/i,
  /\bself harm\b/i, /\bcut myself\b/i, /\bno reason to live\b/i, /\bhurt myself\b/i,
  /आत्महत्या/, /खुदकुशी/, /जीव\s*द्याव/, /मरून\s*जाव/, /मरना\s*चाहता/,
  /जीने\s*का\s*मन\s*नाही/, /मरायच\S*\s*आहे/, /संपव\S*\s*आयुष्य/,
];

/** Runs before the model, so the helpline never depends on what an LLM decides to say. */
export function isCrisisText(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text));
}

const MEDICAL_CLAIM_PATTERNS = [
  /\byou have (diabetes|cancer|thyroid|pcos|depression)\b/i,
  /\bdiagnos(is|ed|e)\b/i,
  /\bstop taking\b.*\b(medicine|medication|tablet)\b/i,
  /\bcure[sd]?\b/i,
];

export type GuardResult = { ok: boolean; reasons: string[]; text: string };

/**
 * Last line of defence on model output. A small local model will sometimes
 * suggest a 900 kcal day or play doctor; this catches both.
 */
export function guardAdvice(text: string, kcalFloor: number): GuardResult {
  const reasons: string[] = [];
  let out = text;

  for (const p of MEDICAL_CLAIM_PATTERNS) {
    if (p.test(text)) {
      reasons.push('medical_claim');
      break;
    }
  }

  const kcalMentions = [...text.matchAll(/(\d{3,4})\s*(?:kcal|calorie|calories)/gi)].map((m) => Number(m[1]));
  const suggestsTooLow = kcalMentions.some((n) => n >= 400 && n < kcalFloor);
  if (suggestsTooLow) reasons.push('below_floor');

  if (/\b(fast(ing)? for|skip (dinner|lunch|breakfast)|don'?t eat|starve)\b/i.test(text)) {
    reasons.push('skip_meal');
  }

  if (reasons.length > 0) {
    out = text + '\n\n---\nSobat note: ignore any advice above that suggests skipping meals, eating under ' + kcalFloor + ' kcal, or that sounds like a diagnosis. Ask a doctor for those.';
  }
  return { ok: reasons.length === 0, reasons, text: out };
}
