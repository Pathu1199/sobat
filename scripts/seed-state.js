// Prints an AppState JSON with ten days of history. Paste the output into the
// browser console as:  localStorage.setItem('sobat.state.v1', <paste>); location.reload()
// Or run:  npm run seed | pbcopy
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x.toISOString(); };
const days = [];
for (let i = 9; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); d.setHours(12, 0, 0, 0); days.push(d); }
const today = days[days.length - 1];
const item = (foodId, name_en, name_mr, grams, kcal, protein, carbs, fat) => ({ foodId, name_en, name_mr, grams, kcal, protein, carbs, fat, estimated: false });
const B = [[item('poha', 'Poha', 'पोहे', 150, 240, 4, 45, 6), item('chai', 'Tea with milk', 'चहा', 150, 60, 2, 8, 2)], [item('upma', 'Upma', 'उपमा', 150, 260, 6, 42, 8)], [item('idli', 'Idli', 'इडली', 120, 180, 6, 36, 1), item('sambar', 'Sambar', 'सांबार', 150, 110, 5, 14, 3)]];
const L = [[item('chapati', 'Chapati', 'चपाती', 80, 238, 8, 42, 4), item('dal-tadka', 'Dal Tadka', 'डाळ', 150, 170, 9, 20, 5), item('bhendi', 'Bhendi Bhaji', 'भेंडीची भाजी', 100, 120, 2, 10, 8)], [item('jowar-bhakri', 'Jowar Bhakri', 'ज्वारीची भाकरी', 120, 390, 10, 80, 3), item('pithla', 'Pithla', 'पिठलं', 150, 190, 9, 20, 8)], [item('steamed-rice', 'Steamed Rice', 'शिजवलेला भात', 150, 195, 4, 42, 0), item('varan', 'Varan', 'वरण', 150, 150, 8, 22, 3), item('curd', 'Curd', 'दही', 100, 60, 3, 4, 3)]];
const S = [[item('chai', 'Tea with milk', 'चहा', 150, 60, 2, 8, 2), item('biscuit', 'Marie Biscuit', 'बिस्किट', 20, 90, 1, 15, 3)], [item('banana', 'Banana', 'केळं', 100, 90, 1, 23, 0)], [item('chivda', 'Chivda', 'चिवडा', 40, 190, 3, 22, 10)]];
const D = [[item('chapati', 'Chapati', 'चपाती', 80, 238, 8, 42, 4), item('paneer-bhurji', 'Paneer Bhurji', 'पनीर भुर्जी', 120, 290, 16, 6, 22)], [item('khichdi', 'Moong Dal Khichdi', 'खिचडी', 250, 330, 12, 55, 6), item('curd', 'Curd', 'दही', 100, 60, 3, 4, 3)], [item('steamed-rice', 'Steamed Rice', 'शिजवलेला भात', 150, 195, 4, 42, 0), item('egg-curry', 'Egg Curry', 'अंडा करी', 150, 280, 14, 8, 20)]];
const sum = (items, k) => Math.round(items.reduce((a, x) => a + x[k], 0));
const meal = (d, type, items, h, m) => ({ id: `${iso(d)}-${type}`, at: at(d, h, m), date: iso(d), type, items, kcal: sum(items, 'kcal'), protein: sum(items, 'protein') });
const meals = [], water = [], moods = [], workouts = [], sleep = [], weights = [], usage = [], breaks = [];
const hourNow = new Date().getHours();
days.forEach((d, i) => {
  const isToday = i === days.length - 1;
  meals.push(meal(d, 'breakfast', B[i % 3], 8, 40));
  if (!isToday || hourNow >= 13) meals.push(meal(d, 'lunch', L[i % 3], 13, 20));
  if (!isToday || hourNow >= 17) meals.push(meal(d, 'snack', S[i % 3], 17, 10));
  if (!isToday || hourNow >= 21) meals.push(meal(d, 'dinner', D[i % 3], i === 2 || i === 6 ? 22 : 21, 15));
  const glasses = isToday ? Math.min(12, Math.max(2, Math.floor(hourNow / 2))) : 7 + (i % 4);
  for (let g = 0; g < glasses; g++) water.push({ id: `${iso(d)}-w${g}`, at: at(d, 8 + g, 15), date: iso(d), ml: 250 });
  moods.push({ id: `${iso(d)}-m`, at: at(d, 10, 5), date: iso(d), score: [3, 4, 3, 2, 4, 4, 3, 4, 3, 4][i], note: i === 3 ? 'Tired, long meeting day' : i === 7 ? 'Walk felt good' : undefined });
  if ([0, 1, 3, 4, 6, 7, 8].includes(i)) workouts.push({ id: iso(d), date: iso(d), exerciseIds: [], minutes: 18 + ((i * 3) % 12), status: 'done', felt: 3 + (i % 2), pain: false });
  if (i === 5) workouts.push({ id: iso(d), date: iso(d), exerciseIds: [], minutes: 0, status: 'skipped' });
  const bed = ['23:30', '00:10', '23:45', '00:40', '23:20', '23:55', '23:30', '00:05', '23:40', '23:35'][i];
  const wake = ['07:00', '07:10', '06:50', '07:30', '06:45', '07:20', '07:00', '07:15', '06:55', '07:05'][i];
  const [bh, bm] = bed.split(':').map(Number); const [wh, wm] = wake.split(':').map(Number);
  const minutes = wh * 60 + wm - (bh * 60 + bm) + (bh >= 12 ? 1440 : 0);
  const quality = [4, 3, 4, 2, 4, 3, 4, 3, 4, 4][i], wakeups = [0, 1, 0, 2, 0, 1, 0, 1, 0, 0][i], energy = [4, 3, 4, 2, 4, 3, 4, 3, 4, 4][i];
  const score = Math.max(30, Math.min(95, Math.round(40 + (minutes - 360) / 3 + quality * 6 - wakeups * 5 + energy * 3)));
  sleep.push({ date: iso(d), bed, wake, quality, wakeups, energy, minutes, score });
  if (i % 2 === 0 || isToday) weights.push({ date: iso(d), kg: Math.round((100.2 - i * 0.17) * 10) / 10 });
  const hours = isToday ? [9, 10, 11, 12, 13, 14, 15, 16, 17, 18].filter((h) => h <= hourNow) : [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  hours.forEach((h) => usage.push({ date: iso(d), hour: h, activeMinutes: h === 13 ? 20 : 38 + ((h * 7 + i) % 20) }));
  const nb = isToday ? Math.max(1, Math.min(6, Math.floor((hourNow - 9) / 1.5))) : 8;
  for (let b = 0; b < nb; b++) breaks.push({ id: `${iso(d)}-b${b}`, date: iso(d), at: at(d, 9 + b, 20), action: b % 4 === 3 ? 'skipped' : 'taken', workedMinutes: 20 });
});
const state = {
  version: 1,
  profile: { name: 'Varad', sex: 'male', birthYear: 1998, heightCm: 172, weightKg: weights[weights.length - 1].kg, activity: 'sedentary', goalWeightKg: 80, rateKgPerWeek: 0.5, lang: process.env.LANG_OVERRIDE || 'mr', onboarded: true },
  settings: { ollamaUrl: 'http://192.168.1.10:11434', ollamaFallbackUrl: '', textModel: 'qwen3:8b', visionModel: 'qwen2.5vl:7b', nudgeMinutes: 30, nudgesEnabled: true, quietStartHour: 22, quietEndHour: 7, waterGoalMl: 3000, glassMl: 250 },
  meals, water, weights, sleep, moods, workouts, nudges: [], customFoods: [], memory: [], usage, breaks,
  breakSettings: { enabled: true, workMinutes: 20, breakSeconds: 60, allowSkip: true, quietStartHour: 22, quietEndHour: 7 },
  tips: [{ date: iso(today), text: 'तू सलग ९ दिवस लॉग करतो आहेस. आज दुपारी १५ मिनिटं चाल. प्रोटीन थोडं कमी आहे, संध्याकाळी दही किंवा अंडं घे.', lang: 'mr' }],
  photoQueue: [], steps: [{ date: iso(today), count: 4180 }],
  chat: [
    { id: 'c1', role: 'user', text: 'आता काय खाऊ?', at: at(today, 12, 30) },
    { id: 'c2', role: 'assistant', text: 'तुझ्याकडे आज अजून ~९०० kcal शिल्लक आहेत आणि प्रोटीन कमी आहे. दुपारी २ चपाती + १ वाटी डाळ + थोडं दही घे.', at: at(today, 12, 31), options: [{ foodId: 'chapati', name_en: 'Chapati', name_mr: 'चपाती', grams: 80, kcal: 238, protein: 8 }, { foodId: 'dal-tadka', name_en: 'Dal Tadka', name_mr: 'डाळ', grams: 150, kcal: 170, protein: 9 }, { foodId: 'curd', name_en: 'Curd', name_mr: 'दही', grams: 100, kcal: 60, protein: 3 }] },
  ],
};
process.stdout.write(JSON.stringify(JSON.stringify(state)));
