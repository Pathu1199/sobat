/**
 * Every activity a person might do, with its energy cost in METs for an
 * easy, a normal and a hard effort. A MET is the work metabolic rate over
 * the resting rate; 1 MET is about 1 kcal per kg of body weight per hour.
 * Values follow the 2024 Adult Compendium of Physical Activities
 * (pacompendium.com); where the Compendium has no exact line, the nearest
 * one is used and marked `approx`. Names are what people in Pune say.
 */
export type ActivityCategory = 'walk' | 'run' | 'cycle' | 'swim' | 'yoga' | 'gym' | 'sport' | 'dance' | 'home' | 'other';
export type Impact = 'low' | 'high';

export type Activity = {
  id: string;
  name_en: string;
  name_mr: string;
  name_hi: string;
  category: ActivityCategory;
  icon: string;
  /** METs at easy, normal and hard effort. */
  met: [number, number, number];
  impact: Impact;
  approx?: boolean;
  /** Compendium lines the three METs come from, for the guide. */
  note?: string;
};

export const ACTIVITIES: Activity[] = [
  // Walking
  { id: 'walk', name_en: 'Walking', name_mr: 'चालणे', name_hi: 'पैदल चलना', category: 'walk', icon: '🚶', met: [3.0, 3.8, 4.8], impact: 'low', note: 'walking 2.5 mph 3.0 · 3 mph 3.8 · brisk 4.8' },
  { id: 'walk-fast', name_en: 'Fast walking', name_mr: 'भरभर चालणे', name_hi: 'तेज़ चलना', category: 'walk', icon: '🏃‍♂️', met: [4.8, 5.3, 7.0], impact: 'low', note: 'brisk 4.8 · nordic 5.3 · very brisk 7.0' },
  { id: 'stairs', name_en: 'Climbing stairs', name_mr: 'जिने चढणे', name_hi: 'सीढ़ियाँ चढ़ना', category: 'walk', icon: '🪜', met: [4.5, 6.8, 9.3], impact: 'high', note: 'stair climbing slow 4.5 · general 6.8 · fast 9.3' },
  { id: 'trek', name_en: 'Trekking / hiking', name_mr: 'ट्रेक', name_hi: 'ट्रेकिंग', category: 'walk', icon: '⛰️', met: [5.3, 6.0, 7.8], impact: 'high', approx: true },
  // Running
  { id: 'jog', name_en: 'Jogging', name_mr: 'जॉगिंग', name_hi: 'जॉगिंग', category: 'run', icon: '🏃', met: [6.0, 7.5, 8.5], impact: 'high', note: 'jogging general 7.5 · 5 mph 8.5' },
  { id: 'run', name_en: 'Running', name_mr: 'धावणे', name_hi: 'दौड़ना', category: 'run', icon: '🏃‍♀️', met: [8.5, 9.3, 11.0], impact: 'high', note: '5 mph 8.5 · 6 mph 9.3 · 7 mph 11.0' },
  // Cycling
  { id: 'cycle', name_en: 'Cycling', name_mr: 'सायकल', name_hi: 'साइकिल', category: 'cycle', icon: '🚴', met: [4.0, 6.8, 8.0], impact: 'low', approx: true },
  { id: 'cycle-static', name_en: 'Gym cycle', name_mr: 'जिम सायकल', name_hi: 'जिम साइकिल', category: 'cycle', icon: '🚲', met: [3.5, 6.8, 8.8], impact: 'low', approx: true },
  // Swimming
  { id: 'swim', name_en: 'Swimming', name_mr: 'पोहणे', name_hi: 'तैराकी', category: 'swim', icon: '🏊', met: [4.8, 5.8, 9.8], impact: 'low', approx: true },
  // Yoga and stretching
  { id: 'yoga', name_en: 'Yoga (hatha)', name_mr: 'योग', name_hi: 'योग', category: 'yoga', icon: '🧘', met: [2.3, 2.7, 4.0], impact: 'low', note: 'hatha 2.3 · vinyasa 2.7 · power 4.0' },
  { id: 'surya-namaskar', name_en: 'Surya namaskar', name_mr: 'सूर्यनमस्कार', name_hi: 'सूर्य नमस्कार', category: 'yoga', icon: '🌅', met: [2.7, 3.5, 4.0], impact: 'low', note: 'surya namaskar 3.5' },
  { id: 'pranayam', name_en: 'Pranayam / breathing', name_mr: 'प्राणायाम', name_hi: 'प्राणायाम', category: 'yoga', icon: '🌬️', met: [1.3, 1.5, 1.8], impact: 'low', approx: true },
  { id: 'stretch', name_en: 'Stretching', name_mr: 'स्ट्रेचिंग', name_hi: 'स्ट्रेचिंग', category: 'yoga', icon: '🤸', met: [2.3, 2.3, 2.8], impact: 'low', note: 'stretching mild 2.3' },
  { id: 'pilates', name_en: 'Pilates', name_mr: 'पिलाटेस', name_hi: 'पिलाटेस', category: 'yoga', icon: '🧎', met: [1.8, 2.8, 3.5], impact: 'low', note: 'mat 1.8 · general 2.8' },
  // Gym and home workouts
  { id: 'weights', name_en: 'Weight training', name_mr: 'वेट ट्रेनिंग', name_hi: 'वेट ट्रेनिंग', category: 'gym', icon: '🏋️', met: [3.5, 5.0, 6.0], impact: 'low', note: '8-15 reps 3.5 · vigorous 6.0' },
  { id: 'bodyweight', name_en: 'Bodyweight (push-ups, squats)', name_mr: 'बॉडीवेट व्यायाम', name_hi: 'बॉडीवेट कसरत', category: 'gym', icon: '💪', met: [3.8, 5.0, 7.5], impact: 'low', note: 'calisthenics moderate 3.8 · vigorous 7.5' },
  { id: 'circuit', name_en: 'Circuit / HIIT', name_mr: 'सर्किट / HIIT', name_hi: 'सर्किट / HIIT', category: 'gym', icon: '⚡', met: [3.5, 5.0, 7.5], impact: 'high', note: 'circuit light 3.5 · moderate 5.0 · vigorous 7.5' },
  { id: 'elliptical', name_en: 'Elliptical / cross trainer', name_mr: 'क्रॉस ट्रेनर', name_hi: 'क्रॉस ट्रेनर', category: 'gym', icon: '🎿', met: [4.0, 5.0, 9.0], impact: 'low', note: 'moderate 5.0 · vigorous 9.0' },
  { id: 'treadmill', name_en: 'Treadmill', name_mr: 'ट्रेडमिल', name_hi: 'ट्रेडमिल', category: 'gym', icon: '🏃‍♂️', met: [3.8, 4.8, 8.5], impact: 'high', approx: true },
  { id: 'skipping', name_en: 'Skipping rope', name_mr: 'दोरीउड्या', name_hi: 'रस्सी कूदना', category: 'gym', icon: '🪢', met: [8.0, 9.0, 11.0], impact: 'high', note: '120 jumps/min 9.0 · general 11.0' },
  { id: 'session', name_en: 'Sobat session (joint-safe)', name_mr: 'सोबत सेशन', name_hi: 'सोबत सेशन', category: 'gym', icon: '✅', met: [3.0, 3.8, 5.0], impact: 'low', approx: true },
  // Sports
  { id: 'cricket', name_en: 'Cricket', name_mr: 'क्रिकेट', name_hi: 'क्रिकेट', category: 'sport', icon: '🏏', met: [3.5, 4.8, 6.0], impact: 'high', note: 'batting, bowling, fielding 4.8' },
  { id: 'badminton', name_en: 'Badminton', name_mr: 'बॅडमिंटन', name_hi: 'बैडमिंटन', category: 'sport', icon: '🏸', met: [4.5, 5.5, 7.0], impact: 'high', note: 'social 5.5 · competitive 7.0' },
  { id: 'football', name_en: 'Football', name_mr: 'फुटबॉल', name_hi: 'फ़ुटबॉल', category: 'sport', icon: '⚽', met: [5.5, 7.0, 9.5], impact: 'high', note: 'casual 7.0 · competitive 9.5' },
  { id: 'kabaddi', name_en: 'Kabaddi', name_mr: 'कबड्डी', name_hi: 'कबड्डी', category: 'sport', icon: '🤼', met: [5.0, 6.0, 8.0], impact: 'high', approx: true, note: 'as wrestling 6.0' },
  { id: 'volleyball', name_en: 'Volleyball', name_mr: 'व्हॉलीबॉल', name_hi: 'वॉलीबॉल', category: 'sport', icon: '🏐', met: [3.0, 4.0, 6.0], impact: 'high', note: 'non-competitive 3.0 · general 4.0 · competitive 6.0' },
  { id: 'basketball', name_en: 'Basketball', name_mr: 'बास्केटबॉल', name_hi: 'बास्केटबॉल', category: 'sport', icon: '🏀', met: [5.5, 7.5, 9.0], impact: 'high', note: 'general 7.5' },
  { id: 'table-tennis', name_en: 'Table tennis', name_mr: 'टेबल टेनिस', name_hi: 'टेबल टेनिस', category: 'sport', icon: '🏓', met: [3.0, 4.0, 5.0], impact: 'low', note: 'ping pong 4.0' },
  { id: 'tennis', name_en: 'Tennis', name_mr: 'टेनिस', name_hi: 'टेनिस', category: 'sport', icon: '🎾', met: [4.5, 6.8, 8.0], impact: 'high', note: 'doubles 4.5 · moderate 6.8 · competitive 8.0' },
  { id: 'carrom-chess', name_en: 'Carrom / chess (sitting)', name_mr: 'कॅरम / बुद्धिबळ', name_hi: 'कैरम / शतरंज', category: 'sport', icon: '♟️', met: [1.5, 1.5, 1.5], impact: 'low', approx: true },
  // Dance
  { id: 'dance', name_en: 'Dance', name_mr: 'नृत्य', name_hi: 'डांस', category: 'dance', icon: '💃', met: [3.0, 5.0, 7.3], impact: 'high', approx: true },
  { id: 'zumba', name_en: 'Zumba / aerobics', name_mr: 'झुंबा / एरोबिक्स', name_hi: 'ज़ुम्बा / एरोबिक्स', category: 'dance', icon: '🕺', met: [5.0, 6.5, 7.3], impact: 'high', approx: true },
  { id: 'garba', name_en: 'Garba / lezim', name_mr: 'गरबा / लेझीम', name_hi: 'गरबा', category: 'dance', icon: '🪘', met: [4.0, 5.5, 7.0], impact: 'high', approx: true },
  // Home and daily life
  { id: 'housework', name_en: 'Housework (sweeping, mopping)', name_mr: 'घरकाम (झाडू, लादी)', name_hi: 'घर का काम (झाड़ू, पोंछा)', category: 'home', icon: '🧹', met: [2.5, 3.3, 4.0], impact: 'low', approx: true },
  { id: 'gardening', name_en: 'Gardening', name_mr: 'बागकाम', name_hi: 'बागवानी', category: 'home', icon: '🌱', met: [2.5, 3.8, 5.0], impact: 'low', approx: true },
  { id: 'play-kids', name_en: 'Playing with kids', name_mr: 'मुलांसोबत खेळणे', name_hi: 'बच्चों के साथ खेलना', category: 'home', icon: '🧒', met: [2.5, 3.5, 5.8], impact: 'low', approx: true },
  { id: 'standing-work', name_en: 'Standing / shop work', name_mr: 'उभे राहून काम', name_hi: 'खड़े रहकर काम', category: 'home', icon: '🧍', met: [1.8, 2.3, 3.0], impact: 'low', approx: true },
];

export const CATEGORY_ORDER: ActivityCategory[] = ['walk', 'run', 'cycle', 'swim', 'yoga', 'gym', 'sport', 'dance', 'home', 'other'];

export function activityById(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

export function activityName(a: Activity, lang: 'en' | 'mr' | 'hi'): string {
  return lang === 'mr' ? a.name_mr : lang === 'hi' ? a.name_hi : a.name_en;
}

/** The starter set for someone who has not picked yet: what most people in a PG do. */
export const DEFAULT_PICKS = ['walk', 'stairs', 'yoga', 'surya-namaskar', 'bodyweight', 'cricket', 'session'];
