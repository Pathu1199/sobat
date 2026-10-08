import type { Advice } from './coach';
import type { DayPlan } from './dayPlan';
import type { Budget } from './nutrition';
import { planVerdict, type Plan } from './plan';
import type { Journey } from './review';
import type { ChatOption, MealType } from './types';

/**
 * The coach that answers without any model: it reads the question for what
 * is being asked, then writes the answer from the person's own numbers.
 * Calories left, the plate laid for the next meal, the weekly verdict with
 * its evidence, water, sleep, protein, a bad day. It is what everyone gets
 * when the PC is off, and what everyone but the admin gets always. Every
 * sentence comes from the i18n table through `t`, so it reads naturally in
 * Marathi and Hindi rather than as a translation of English.
 */
export type Intent =
  | 'eat_now'
  | 'fits_kcal'
  | 'left'
  | 'why_not_dropping'
  | 'overate'
  | 'water'
  | 'sleep'
  | 'motivation'
  | 'protein'
  | 'weigh'
  | 'walk'
  | 'meal'
  | 'plan_day'
  | 'unknown';

export type Parsed = { intent: Intent; kcal?: number; meal?: MealType };

const RX: [Intent, RegExp][] = [
  ['why_not_dropping', /(not|n't|nahi|nahin|नाही|नहीं).{0,25}(drop|los|कमी|घट|utar|utr)|(drop|los|kami|कमी|घट|utar).{0,20}(not|n't|nahi|nahin|नाही|नहीं)|(why|ka\b|का|क्यों).{0,30}(weight|wajan|वजन|वज़न)|(weight|wajan|वजन|वज़न).{0,20}(why|ka\b|का|क्यों)|stall|plateau/i],
  ['overate', /overate|over ?ate|too much|binge|cheat|jast khal|jaast|khup khal|khoop|खूप खाल्ल|जास्त खा|ज़्यादा खा|ज्यादा खा|zyada kha/i],
  ['fits_kcal', /\b(\d{2,4})\s*(k?cal|kcal|कॅल|कैल|calor)/i],
  ['left', /\b(left|remaining|baki|baaki|बाकी|शिल्लक|kiti|कितना|कित(ी|्या))\b.{0,20}(cal|kcal|कॅल|कैल|खा)|how (much|many).{0,20}(left|more|eat)|\bleft\b|\bbaki\b|बाकी/i],
  ['protein', /protein|प्रथिन|प्रोटीन/i],
  ['water', /\bwater\b|pani\b|paani|पाणी|पानी|hydrat/i],
  ['sleep', /sleep|insomnia|zop|झोप|नींद|neend|jhop/i],
  ['walk', /walk|steps|chal(ne|a|u)|चाल|कदम|पावल|exercise|workout|vyayam|व्यायाम|कसरत/i],
  ['motivation', /motivat|kantala|कंटाळा|मन नाही|मन नहीं|lazy|tired|thak|थक|give up|sodun|hopeless|bore/i],
  ['weigh', /weigh|scale|wajan|वजन|वज़न|kilo/i],
  ['plan_day', /full day|whole day|diet plan|meal plan|aaj ka plan|पूर्ण दिवस|पूरा दिन|दिवसभर|din bhar|time ?table/i],
  ['meal', /breakfast|nashta|नाश्ता|lunch|dupar|दुपार|जेवण|dinner|ratri|रात्री|रात का|snack|chaha|चहा|चाय|tea/i],
  ['eat_now', /eat|khau|khav|khaw|खाऊ|खाव|khana|खाना|खाय|suggest|option|hungry|bhook|भूक|कुछ|kahi/i],
];

export function parseQuestion(q: string): Parsed {
  const s = q.toLowerCase();
  for (const [intent, rx] of RX) {
    const m = s.match(rx);
    if (!m) continue;
    if (intent === 'fits_kcal') return { intent, kcal: Number(m[1]) };
    if (intent === 'meal') {
      const meal: MealType = /breakfast|nashta|नाश्ता/.test(s) ? 'breakfast' : /dinner|ratri|रात्री|रात का/.test(s) ? 'dinner' : /snack|chaha|चहा|चाय|tea/.test(s) ? 'snack' : 'lunch';
      return { intent, meal };
    }
    return { intent };
  }
  return { intent: 'unknown' };
}

export type OfflineCtx = {
  budget: Budget;
  hour: number;
  plan: Plan;
  journey: Journey;
  dayPlan: DayPlan;
  advice: Advice[];
  waterMl: number;
  waterGoalMl: number;
  streakDays: number;
  lastSleepMinutes: number | null;
  stepsToday: number;
  kcalTarget: number;
  proteinTarget: number;
  /** Foods that fit a given number of calories, best protein first. */
  optionsFor: (kcalMax: number) => ChatOption[];
  foodName: (foodId: string) => string;
  mealName: (m: MealType) => string;
};

type T = (k: string) => string;
function f(s: string, p: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? ''));
}

function plateLine(ctx: OfflineCtx, t: T, type?: MealType): string | null {
  const slot = type ? ctx.dayPlan.slots.find((s) => s.type === type) : ctx.dayPlan.slots.find((s) => s.type === ctx.dayPlan.now) ?? ctx.dayPlan.slots[0];
  if (!slot || slot.picks.length === 0) return null;
  return f(t('oc_plate'), { meal: ctx.mealName(slot.type), kcal: slot.budget, items: slot.picks.map((p) => `${ctx.foodName(p.food.id)} (${p.kcal})`).join(', '), total: slot.kcal, protein: slot.protein });
}

export function answerOffline(question: string, ctx: OfflineCtx, t: T): { text: string; options: ChatOption[] } {
  const p = parseQuestion(question);
  const b = ctx.budget;
  const lines: string[] = [];
  let options: ChatOption[] = [];
  const left = Math.max(0, b.remaining);

  switch (p.intent) {
    case 'eat_now':
    case 'meal': {
      if (b.remaining < 80) {
        lines.push(b.remaining <= 0 ? f(t('oc_over'), { over: -b.remaining }) : f(t('oc_stop'), { kcal: left }));
        break;
      }
      lines.push(f(t('oc_left'), { kcal: left, eaten: b.consumed, target: b.target }));
      const plate = plateLine(ctx, t, p.meal);
      if (plate) lines.push(plate);
      if (b.proteinConsumed < b.proteinTarget * 0.5) lines.push(f(t('oc_protein_push'), { g: Math.round(b.proteinTarget - b.proteinConsumed) }));
      const slot = p.meal ? ctx.dayPlan.slots.find((s) => s.type === p.meal) : undefined;
      options = ctx.optionsFor(Math.min(left, slot?.budget ?? Math.max(300, b.perMeal)));
      lines.push(t('oc_tap_option'));
      break;
    }
    case 'fits_kcal': {
      const k = Math.min(p.kcal ?? left, Math.max(0, left || p.kcal || 0));
      options = ctx.optionsFor(p.kcal ?? left);
      lines.push(f(t('oc_fits_kcal'), { kcal: p.kcal ?? left, n: options.length }));
      if ((p.kcal ?? 0) > left) lines.push(f(t('oc_more_than_left'), { kcal: left }));
      void k;
      break;
    }
    case 'left': {
      lines.push(f(t('oc_left'), { kcal: left, eaten: b.consumed, target: b.target }));
      lines.push(f(t('oc_left_split'), { n: b.mealsLeft, per: b.perMeal }));
      const plate = plateLine(ctx, t);
      if (plate) lines.push(plate);
      lines.push(f(t('oc_protein_status'), { have: b.proteinConsumed, target: b.proteinTarget }));
      break;
    }
    case 'why_not_dropping': {
      const v = planVerdict(ctx.plan);
      lines.push(t(`verdict_${v}`));
      lines.push(f(t('oc_evidence'), { logged: ctx.journey.loggedDays, days: ctx.journey.days, avg: ctx.journey.avgKcal, target: ctx.kcalTarget, over: ctx.journey.overDays, heavy: ctx.journey.heavyDays }));
      lines.push(f(t('oc_evidence2'), { protein: ctx.journey.avgProtein, ptarget: ctx.proteinTarget, water: Math.round(ctx.journey.avgWaterMl / 250), late: ctx.journey.lateDinners, weighs: ctx.journey.weighIns }));
      if (ctx.journey.loggedDays < ctx.journey.days * 0.6) lines.push(t('oc_patchy'));
      else if (ctx.journey.heavyDays >= 2) lines.push(t('oc_heavy_days'));
      else if (ctx.journey.avgKcal > ctx.kcalTarget) lines.push(f(t('oc_avg_over'), { diff: ctx.journey.avgKcal - ctx.kcalTarget }));
      else if (ctx.journey.weighIns < 2) lines.push(t('oc_need_weighins'));
      else lines.push(t('oc_patience'));
      lines.push(f(t('oc_pace'), { start: ctx.plan.startKg, now: ctx.plan.currentKg, goal: ctx.plan.goalKg, lost: ctx.plan.lostKg }));
      break;
    }
    case 'overate': {
      lines.push(b.remaining < 0 ? f(t('oc_overate_over'), { over: -b.remaining }) : f(t('oc_overate_ok'), { kcal: left }));
      lines.push(t('oc_overate_do'));
      lines.push(t('oc_overate_tomorrow'));
      break;
    }
    case 'water': {
      const glasses = Math.round(ctx.waterMl / 250);
      const goal = Math.round(ctx.waterGoalMl / 250);
      lines.push(f(t('oc_water'), { have: glasses, goal, togo: Math.max(0, goal - glasses) }));
      lines.push(t('oc_water_do'));
      break;
    }
    case 'sleep': {
      lines.push(ctx.lastSleepMinutes !== null ? f(t('oc_sleep_last'), { h: Math.floor(ctx.lastSleepMinutes / 60), m: ctx.lastSleepMinutes % 60 }) : t('oc_sleep_none'));
      lines.push(t('oc_sleep_do'));
      break;
    }
    case 'motivation': {
      lines.push(f(t('oc_motivation'), { lost: ctx.plan.lostKg, streak: ctx.streakDays }));
      lines.push(t('oc_motivation_do'));
      break;
    }
    case 'protein': {
      lines.push(f(t('oc_protein_status'), { have: b.proteinConsumed, target: b.proteinTarget }));
      lines.push(t('oc_protein_sources'));
      options = ctx.optionsFor(Math.max(150, left));
      break;
    }
    case 'weigh': {
      lines.push(f(t('oc_pace'), { start: ctx.plan.startKg, now: ctx.plan.currentKg, goal: ctx.plan.goalKg, lost: ctx.plan.lostKg }));
      lines.push(t('oc_weigh_how'));
      break;
    }
    case 'walk': {
      lines.push(f(t('oc_walk'), { steps: ctx.stepsToday }));
      lines.push(t('oc_walk_do'));
      break;
    }
    case 'plan_day': {
      lines.push(f(t('oc_day_plan'), { kcal: ctx.kcalTarget }));
      for (const s of ctx.dayPlan.slots) {
        const l = plateLine(ctx, t, s.type);
        if (l) lines.push(l);
      }
      lines.push(t('oc_day_plan_tip'));
      break;
    }
    default: {
      lines.push(f(t('oc_unknown'), { kcal: left }));
      const top = ctx.advice.slice(0, 2);
      if (top.length) lines.push(t('oc_right_now'));
      // The caller appends the advice sentences; they already have their own wording.
      break;
    }
  }
  return { text: lines.join('\n\n'), options: options.slice(0, 3) };
}
