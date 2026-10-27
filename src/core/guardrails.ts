export const HELPLINES = [
  { name: 'Tele-MANAS', number: '14416', note: 'Government of India, 24x7, many languages' },
  { name: 'KIRAN', number: '1800-599-0019', note: 'Ministry of Social Justice, 24x7' },
  { name: 'iCall', number: '9152987821', note: 'TISS, Mon to Sat, 10am to 8pm' },
];

/**
 * One spelling for every way the same words reach us: Devanagari digits as
 * ASCII, the nukta dropped (so ख़ and ख, typed precomposed or not, match the
 * same pattern), invisible joiners gone, curly quotes straight, lower case.
 */
export function foldText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/़/g, '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[‘’`´]/g, "'")
    .toLowerCase();
}

// Devanagari is not a \w character in JavaScript, so \b never matches next to
// it. Devanagari patterns are written without word boundaries, and every
// pattern is matched against the folded text, so none of them carry a nukta.
const CRISIS_PATTERNS = [
  /\bkill(ing)? my ?self\b/, /\bsuicid/, /\b(end|ending|take|taking) my (own )?life\b/, /\bend(ing)? it all\b/,
  /\b(want|wanna|wanting) (to )?die\b/, /\bwish i (was|were) dead\b/, /\bbetter off dead\b/,
  /\bself ?harm(ing|ed)?\b/, /\b(hurt|hurting|harm|harming|cut|cutting) my ?self\b/,
  /\bno reason to live\b/, /\b(dont|do not|never) want to (live|be alive|exist|wake up)\b/, /\bnot worth living\b/,
  /\bkms\b/,
  // Marathi
  /आत्महत्या/, /जीव\s*द्याव/, /जीव\s*देण/, /मरून\s*जाव/, /मरायच\S*\s*आहे/, /मरावंसं|मरावसं|मरावेसे/,
  /आयुष्य\s*संपव/, /संपव\S*\s*आयुष्य/, /जीवन\s*संपव/, /जगायच\S*\s*नाही/, /जगण्याची\s*इच्छा\s*नाही/,
  // Hindi
  /खुदकुशी/, /खुदखुशी/, /मरना\s*चाहत/, /मर\s*जाना\s*चाहत/, /मरना\s*है/, /जीने\s*का\s*मन\s*(नही|नाही)/,
  /जीना\s*नही/, /जिंदगी\s*खत्म\s*कर/, /जान\s*दे\s*द/, /अपनी\s*जान\s*ले/, /खुद\s*को\s*(नुकसान|चोट)/,
  // Hindi and Marathi in English letters
  /\bmarna (hai|chahta|chahti|chahte|chahata)\b/, /\bmar jaa?na (hai|chahta|chahti)\b/, /\bmara[iy]?a?ch[aeiy]* a?ahe\b/,
  /\ba+tm(a)?hatya/, /\bkhud ?kh?u(s|sh)i\b/, /\bj(ee|i)ne ka man nahi/, /\bj(ee|i)na nahi/, /\bj(ee|i)v dya/,
  /\b(zindagi|jindagi) (khatam|khatm|khtm)/, /\ba?ayushya? samp(a)?v/, /\bjagay?ch[a-z]* nahi\b/,
];

/** Runs before the model, so the helpline never depends on what an LLM decides to say. */
export function isCrisisText(text: string): boolean {
  // Hyphens and punctuation become spaces, so "self-harm" reads as "self harm"
  // and "don't" as "dont". A distance like "3 kms" is not "kms".
  const s = foldText(text)
    .replace(/'/g, '')
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\d+\s*kms\b/g, ' ')
    .trim();
  return CRISIS_PATTERNS.some((p) => p.test(s));
}

/* ---------- Model output ---------- */

/** Words that undo a risky phrase near them: "do not skip", "जेवण टाळू नका", "खाना न छोड़ें". */
const NEG_BEFORE = /\b(dont|don't|do not|never|no need to|not|avoid|avoiding|stop|without|instead of|rather than|shouldnt|shouldn't|should not|wont|won't|cant|can't|cannot|nor)\b|(^|\s)(न|मत|नका|नको|नये)(?=\s|$)|\b(mat|nako|naka)\b/;
const NEG_INSIDE = /(^|\s)(न|मत|नका|नको|नये|नाही|नही|नहीं)(?=\s|$)|\b(not|mat|nako|naka|nahi|nahin)\b/;
const NEG_AFTER = /^\s*(?:(?:is|are|was|were|does|do)\s+(?:not|never)\b|(?:isn't|isnt|aren't|arent|doesn't|doesnt|won't|wont)\b)|^\S*?\s*(?:\S+\s+)?(?:नका|नको|नये|नाही|नहीं|नही|न|मत|nako|naka|nahi|nahin|nai|mat)(?=\s|$|[,.!?।])/;

/** "Avoid late, outside or heavy meals" names a kind of meal to avoid; it is not skipping one. */
const MEAL_KIND = /उशिर|उशीर|बाहेर|हॉटेल|(^|\s)जड|तेलकट|तळलेल|जास्त|जंक|देर|बाहर|तल[ाीे]\s|भारी|ज्यादा|\b(?:late|heavy|oily|outside|junk|jaast|ushira|der|bahar)\b/;

/** `kind`: the match starts with a meal word that a word before it can qualify. */
type Risk = { rx: RegExp; negatable: boolean; kind?: boolean };

const SKIP_MEAL: Risk[] = [
  // "skip" and "skipping", not "skipped": "you skipped breakfast" reports the day, it does not advise.
  { rx: /\bskip(?:ping|s)?\s+(?:your\s+|the\s+|a\s+|my\s+|one\s+|tonight's\s+|today's\s+)?(?:dinner|lunch|breakfast|supper|meals?|food|eating|snacks?|nashta)\b/g, negatable: true },
  { rx: /\b(?:dinner|lunch|breakfast|meal|nashta|khana|jevan)\s+skip\b/g, negatable: true },
  { rx: /\bgo(?:ing)? without (?:food|eating|dinner|lunch|breakfast|meals?)\b/g, negatable: true },
  // "Starve yourself" advises; "you must be starving" only means hungry.
  { rx: /\bstarv(?:e|ing) (?:yourself|your body|for)\b|\bstay hungry\b/g, negatable: true },
  { rx: /\b(?:don't|dont|do not|no)\s+(?:eat\s+|have\s+)?(?:dinner|lunch|breakfast|supper)\b(?!\s+(?:after|late|past|later|beyond|in bed|in front))/g, negatable: false },
  { rx: /\b(?:don't|dont|do not)\s+eat\s+(?:anything|at all|for the (?:rest of the )?day|tonight|today|till|until)\b(?!\s+(?:after|late|past|later|fried|oily|sweet))/g, negatable: false },
  // A meal named as a whole word, then skip, avoid or leave it.
  { rx: /(?:^|\s)(?:जेवण|जेवणं|जेवणे|नाश्ता|न्याहारी|डबा|खाना|भोजन|नाश्ते|डिनर|लंच|ब्रेकफास्ट)\s+(?:\S+\s+)?(?:टाळ|वगळ|सोड|छोड|स्किप)/g, negatable: true, kind: true },
  { rx: /उपाशी\s*(?:\S+\s+)?राह|भूख(?:े|ा|ी)\s+(?:\S+\s+)?रह/g, negatable: true },
  { rx: /\b(?:jevan|jewan|nashta|khana|dinner|lunch|breakfast)\s+(?:\S+\s+)?(?:tala|taal|taala|talaa|chhod|chod|sod)/g, negatable: true, kind: true },
  { rx: /\bupashi raha|\bbhukhe? raho/g, negatable: true },
];

const FASTING: Risk[] = [
  { rx: /\bfasting\b/g, negatable: true },
  { rx: /\bfast(?:ed)?\s+(?:for|until|till|from|on|tomorrow|today|every|once|twice|one|a|\d|rakh|kar|kara|karo|theva|thev)/g, negatable: true },
  { rx: /\b(?:do|try|keep|observe|start|begin)\s+(?:a\s+|an\s+|the\s+|your\s+)?(?:water\s+|juice\s+|dry\s+|religious\s+)?fast\b/g, negatable: true },
  { rx: /\b(?:water|juice|dry|24 ?hours?|48 ?hours?|day[- ]long|weekly)\s+fast\b/g, negatable: true },
  { rx: /\bomad\b|\bone meal (?:a|per) day\b|\b(?:only|just) one meal\b|\beat(?:ing)? (?:only |just )?once a day\b/g, negatable: true },
  { rx: /\b(?:16\s*[:/]\s*8|18\s*[:/]\s*6|20\s*[:/]\s*4|5\s*[:/]\s*2)\b/g, negatable: true },
  { rx: /उपवास|व्रत|उपोषण|निर्जल|निराहार|एकभुक्त|दिवसातून\s*एकदाच\s*जेव|दिन\s*में\s*(?:सिर्फ\s*|केवल\s*)?एक\s*(?:ही\s*)?बार\s*(?:खा|भोजन)/g, negatable: true },
  { rx: /\bup(?:a)?[vw](?:a)?as\b|\bvrat\b/g, negatable: true },
];

const MEDICAL: Risk[] = [
  { rx: /\bdiagnos(?:is|ed|e)\b/g, negatable: false },
  { rx: /\bcure[sd]?\b/g, negatable: false },
  { rx: /\bstop taking\b.*\b(?:medicine|medication|tablet)/g, negatable: true },
  { rx: /\b(?:stop|reduce|skip|lower|increase|change)\s+(?:your\s+)?(?:\w+\s+)?(?:medicines?|medications?|tablets?|insulin|dose|metformin|thyroxine|pills?)\b/g, negatable: true },
  { rx: /(?:गोळ्या|गोळी|औषध|दवा|दवाई|दवाइयां|दवाइयाँ|इन्सुलिन|इंसुलिन)\S*\s+(?:\S+\s+)?(?:बंद|कमी|सोड|छोड|घटा)/g, negatable: true },
];

const CONDITIONS_EN = '(?:pre-?diabet\\w*|diabet\\w*|thyroid|hypothyroid\\w*|hyperthyroid\\w*|pcos|pcod|depression|anxiety disorder|cancer|insulin resistance|hormonal (?:imbalance|issues?|problems?)|fatty liver|hypertension|high blood pressure|ana?emi\\w*|eating disorder|bulimi\\w*|anorexi\\w*|sleep apno?ea|cushing\\w*|metabolic syndrome|heart disease|kidney disease|\\w+ deficiency)';
const CONDITIONS_IN = '(?:मधुमेह|डायबिटीज|डायबेटीस|डायबिटीस|थायरॉईड|थायरॉइड|थायराइड|थायरोइड|पीसीओएस|पीसीओडी|पीसीओस|नैराश्य|डिप्रेशन|कर्करोग|कॅन्सर|कैंसर|कैन्सर|रक्तदाब|एनीमिया|अॅनिमिया)';
const DIAGNOSIS: RegExp[] = [
  new RegExp(`\\byou(?:'ve| have)?\\s+(?:may|might|could|probably|likely|must|seem to|appear to)?\\s*(?:have|has|be having|are having|got|have got|be suffering from|are suffering from|suffer from|are)\\s+(?:a |an |some |signs of |symptoms of )?(?:\\w+\\s+){0,2}?${CONDITIONS_EN}`),
  new RegExp(`\\b(?:sounds|looks|seems)\\s+like\\s+(?:you\\s+(?:have|might have|may have)\\s+)?(?:a |an )?(?:\\w+\\s+){0,2}?${CONDITIONS_EN}`),
  new RegExp(`\\b(?:this|it|that)\\s+(?:could|might|may|must)\\s+be\\s+(?:a |an )?(?:\\w+\\s+){0,2}?${CONDITIONS_EN}`),
  new RegExp(`(?:तुम्हाला|तुला|आपल्याला|तुम्हांला|आपको|तुम्हें|तुम्हे|तुझे)\\s+(?:\\S+\\s+){0,3}?${CONDITIONS_IN}\\S*\\s*(?:\\S+\\s+){0,2}?(?:आहे|असेल|असू|असावा|असावी|असण्याची|झाला|झाली|है|हो\\s*सकत|होगा|होगी|हो\\s*गया|हो\\s*गई)`),
];
/** "If you have diabetes, ask your doctor" is good advice, not a diagnosis; nor is "get a thyroid test". */
const CONDITIONAL = /\bif\b|\bagar\b|अगर|(^|\s)जर(\s|$)|तपास|चाचणी|टेस्ट|जांच|जाँच/;

/** Phrases that carry a risky word but say something harmless. */
const HARMLESS = /\bfasting (?:blood )?(?:sugar|glucose|test|lipid\w*|insulin)\b|\bovernight fast(?:ing)?\b|रात्री\S*\s+(?:\S+\s+)?उपवास|रात\s+का\s+(?:\S+\s+)?उपवास/g;

/** Splits on sentence ends, never on the dot in "1.5 kg". */
function sentences(s: string): string[] {
  return s.split(/[!?।;\n]+|\.(?=\s|$)/);
}

/** Clauses, so "Don't skip breakfast, skip dinner" is two thoughts, not one negated one. */
function clauses(s: string): string[] {
  return s.split(/[,—–]|\s-\s|\bbut\b|\bthough\b|\bhowever\b|\bpan\b|पण|परंतु|लेकिन|मगर|\bmagar\b/);
}

function hits(clause: string, risks: Risk[]): boolean {
  for (const { rx, negatable, kind } of risks) {
    for (const m of clause.matchAll(rx)) {
      if (!negatable) return true;
      const at = m.index ?? 0;
      const before = clause.slice(Math.max(0, at - 14), at);
      if (kind && MEAL_KIND.test(before)) continue;
      const after = clause.slice(at + m[0].length, at + m[0].length + 18);
      if (NEG_BEFORE.test(before) || NEG_INSIDE.test(m[0]) || NEG_AFTER.test(after)) continue;
      return true;
    }
  }
  return false;
}

function anyClause(s: string, risks: Risk[]): boolean {
  return sentences(s).some((sentence) => clauses(sentence).some((c) => hits(c, risks)));
}

function claimsDiagnosis(s: string): boolean {
  return sentences(s).some((sentence) =>
    clauses(sentence).some((c) => !CONDITIONAL.test(c) && DIAGNOSIS.some((rx) => rx.test(c))),
  );
}

/* Calories. The floor is a DAILY figure: a 500 kcal meal is perfectly normal,
 * so a number only counts as too low when it is a day's total. */
const KCAL = /(\d{2,5})(?:\s*(?:-|–|to|ते|से|or)\s*(\d{2,5}))?\s*(?:k\s?cals?|kilo\s?calories|calories|calorie|calory|cals?|किलो\s?कॅलरी\S*|कॅलरी\S*|कैलोरी\S*|कैलरी\S*|कॅल(?=\s|$)|कैल(?=\s|$))(?![a-z])/g;
/** Said of the day as a whole, right next to the number or anywhere in its sentence. */
const PER_DAY = /\ba day\b|\bper day\b|\/\s?d(?:ay)?\b|\bdaily\b|\bevery ?day\b|\beach day\b|\bin a day\b|\b(?:whole|entire|full) day\b|रोज|प्रतिदिन|प्रति\s*दिन|दिवसाला|दिवसात|दिवसभर|दिवसाच|दिन\s*में|दिनभर|दिन\s*भर|पूरे\s*दिन|हर\s*दिन|\broj\b|\broz\b|\brozana?\b|\bdin (?:me|mein|bhar)\b|\bdivsala\b|\bdivasbhar\b/;
/** "Today" or "tomorrow" alone could be one meal; with "only" or a big number it is the day. */
const TODAYISH = /\btoday\b|\btomorrow\b|\bthis week\b|आज|उद्या|(^|\s)कल(\s|$)|\baaj\b|\budya\b/;
const RESTRICT = /\b(?:only|just|under|below|less than|no more than|at most|max(?:imum)?|limit|cap|stay)\b|फक्त|केवळ|पेक्षा\s*कमी|च्या\s*आत|सिर्फ|केवल|(^|\s)बस(\s|$)|से\s*कम|तक|\bfakt\b|\bsirf\b/;
/** The number is what is left, eaten or burned, not a target. */
const NOT_A_TARGET = /\b(?:left|remaining|remain|more|extra|eaten|ate|had|so far|burn(?:ed|t|s)?|earned|earn|room|spare|already|logged|reached|intake)\b|\byou(?:'re| are) at\b|बाकी|शिल्लक|उरल|खाल्ल|झाल|घेतल|अजून|आणखी|जा?ळल|बची|बचे|बचा|खा\s*चुके|खा\s*लिए|खाई(?![ँं])|खाए(?![ँं])|हो\s*ग|हुई|हुए|जलाई|जलाए|जलाया|बर्न/;
/** A sentence that reports an average describes the past, it does not set a target. */
const AVERAGE = /\baverag|\bavg\b|सरासरी|औसत/;
const MEALISH = /\b(?:breakfast|lunch|dinner|supper|snacks?|meals?|plate|thali|tiffin|katori|bowl|roti|chapati|nashta|jevan|serving|portion|piece|glass|cup|biscuit|chai|tea)\b|नाश्त|जेवण|डबा|थाळी|वाटी|ताट|खाना|भोजन|थाली|कटोरी|डिनर|लंच|स्नॅक|स्नैक|दुपार|रात्री|रात\s+का/;

function belowFloor(s: string, kcalFloor: number): boolean {
  return sentences(s).some((sentence) => {
    if (AVERAGE.test(sentence)) return false;
    for (const m of sentence.matchAll(KCAL)) {
      const low = Math.min(Number(m[1]), m[2] ? Number(m[2]) : Infinity);
      if (!(low > 0 && low < kcalFloor)) continue;
      const at = m.index ?? 0;
      const end = at + m[0].length;
      const near = sentence.slice(Math.max(0, at - 20), at) + ' ' + sentence.slice(end, end + 25);
      if (NOT_A_TARGET.test(near)) continue;
      const mealNear = MEALISH.test(sentence.slice(Math.max(0, at - 15), at) + ' ' + sentence.slice(end, end + 12));
      if (PER_DAY.test(sentence) && !mealNear) return true;
      if (TODAYISH.test(sentence) && !MEALISH.test(sentence) && (RESTRICT.test(sentence) || low >= 700)) return true;
    }
    return false;
  });
}

export type GuardReason = 'medical_claim' | 'below_floor' | 'skip_meal' | 'fasting';
export type GuardResult = { ok: boolean; reasons: GuardReason[]; text: string };
/** The code-written wording that replaces unsafe model text, in the person's language. */
export type GuardWords = { food: string; medical: string };

export function guardWordsEn(kcalFloor: number): GuardWords {
  return {
    food: `Sobat will not suggest skipping meals, fasting, or eating under ${kcalFloor} kcal a day. Keep to today's plan: eat your meals, protein first. If you keep a religious fast, break it with a proper meal, and ask a doctor first if you have diabetes or take medicines.`,
    medical: 'Sobat cannot tell what a symptom or a report means. If something about your health worries you, please show it to a doctor.',
  };
}

/**
 * Last line of defence on model output. A small local model will sometimes
 * suggest a 900 kcal day, a fast, or play doctor. When it does, none of its
 * text is shown: the reply is replaced with wording the code wrote.
 */
export function guardAdvice(text: string, kcalFloor: number, words: GuardWords = guardWordsEn(kcalFloor)): GuardResult {
  const s = foldText(text).replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
  const risky = s.replace(HARMLESS, ' ');
  const reasons: GuardReason[] = [];
  if (claimsDiagnosis(s) || anyClause(s, MEDICAL)) reasons.push('medical_claim');
  if (belowFloor(s, kcalFloor)) reasons.push('below_floor');
  if (anyClause(risky, SKIP_MEAL)) reasons.push('skip_meal');
  if (anyClause(risky, FASTING)) reasons.push('fasting');
  if (reasons.length === 0) return { ok: true, reasons, text };

  const parts: string[] = [];
  if (reasons.some((r) => r !== 'medical_claim')) parts.push(words.food);
  if (reasons.includes('medical_claim')) parts.push(words.medical);
  return { ok: false, reasons, text: parts.join('\n\n') };
}

/**
 * The person is asking about fasting or skipping a meal. The answer to that is
 * decided by the code, so the model is never asked. Only short text counts:
 * what a person types is short, while the app's own prompts (which may say
 * "do not fast") are long.
 */
export function asksAboutFasting(text: string): boolean {
  if (text.length > 280) return false;
  const s = foldText(text).replace(HARMLESS, ' ');
  // search(), not test(): test() on a /g pattern moves its lastIndex, and
  // matchAll() in hits() would then start part-way through the next text.
  return [...FASTING, ...SKIP_MEAL].some(({ rx }) => s.search(rx) !== -1);
}
