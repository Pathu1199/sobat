import { describe, expect, it } from 'vitest';
import { asksAboutFasting, guardAdvice, isCrisisText, HELPLINES } from '../guardrails';
import { dailyTipPrompt, dayReviewPrompt, decisionPrompt, weeklyReportPrompt } from '../../ai/prompts';
import { decide } from '../decide';

describe('isCrisisText', () => {
  it('catches English phrasing', () => {
    expect(isCrisisText('sometimes I want to die')).toBe(true);
    expect(isCrisisText('I think about suicide')).toBe(true);
  });

  it('catches Devanagari phrasing', () => {
    expect(isCrisisText('मला आत्महत्या करावी वाटते')).toBe(true);
  });

  it('does not fire on ordinary sadness', () => {
    expect(isCrisisText('I am feeling low and tired today')).toBe(false);
    expect(isCrisisText('this diet is killing me')).toBe(false);
  });

  it('ships real helpline numbers', () => {
    expect(HELPLINES.map((h) => h.number)).toContain('14416');
  });
});

describe('isCrisisText, per language', () => {
  const crisis: [lang: string, text: string][] = [
    ['en', 'I keep thinking about self-harm'],
    ['en', 'i want to self harm again'],
    ['en', 'i wanna die'],
    ['en', "I don't want to live anymore"],
    ['en', 'i dont want to live anymore'],
    ['en', 'I’d be better off dead'],
    ['en', 'I just want to end it all.'],
    ['en', 'honestly i want to kms'],
    ['en', 'KMS'],
    ['en', 'I am thinking of killing myself'],
    ['en', 'I want to hurt myself'],
    ['en', 'I want to take my own life'],
    ['hi', 'मैं मरना चाहती हूँ'],
    ['hi', 'मैं मरना चाहता हूं'],
    ['hi', 'अब जीने का मन नहीं'],
    ['hi', 'अब जीने का मन नहीं करता'],
    ['hi', 'ख़ुदकुशी के बारे में सोचती हूँ'],
    ['hi', 'ख़ुदकुशी के बारे में सोचती हूँ'],
    ['hi', 'मैं अपनी ज़िंदगी ख़त्म करना चाहता हूँ'],
    ['hi', 'मुझे अब जीना नहीं है'],
    ['mr', 'मला आयुष्य संपवायचं आहे'],
    ['mr', 'संपवायचं आयुष्य आता'],
    ['mr', 'मला आयुष्य संपवायचे आहे'],
    ['mr', 'मला मरायचं आहे'],
    ['mr', 'मला आता जगायचं नाही'],
    ['mr', 'जीव द्यावासा वाटतो'],
    ['hi-Latn', 'mujhe marna hai'],
    ['hi-Latn', 'Mujhe marna hai yaar'],
    ['hi-Latn', 'main marna chahti hu'],
    ['hi-Latn', 'jeene ka man nahi karta'],
    ['hi-Latn', 'khudkushi kar lunga'],
    ['mr-Latn', 'mala marayche ahe'],
    ['mr-Latn', 'mala maraycha aahe'],
    ['mr-Latn', 'aatmahatya karavishi vatate'],
    ['mr-Latn', 'atmahatya'],
  ];
  it.each(crisis)('%s: "%s" shows the helpline', (_lang, text) => {
    expect(isCrisisText(text)).toBe(true);
  });

  const benign: [lang: string, text: string][] = [
    ['en', 'I walked 3 kms today'],
    ['en', 'did 5kms on the treadmill'],
    ['en', 'I could die for some vada pav'],
    ["en", "I'm dying to eat biryani"],
    ['en', 'how do I kill my sugar cravings'],
    ['en', 'deadlift and dead hang done'],
    ['en', 'I want to end my sugar habit'],
    ['en', 'self harmony through yoga'],
    ['en', 'I want to give up sugar'],
    ['mr', 'मला मराठी जेवण आवडतं'],
    ['mr', 'आज खूप थकलो आहे'],
    ['mr', 'आयुष्यात पहिल्यांदा ५ किलो कमी झाले'],
    ['hi', 'मैं थक गई हूँ'],
    ['hi', 'आज मन नहीं है कसरत का'],
    ['mr-Latn', 'mala marathi jevan aavadta'],
    ['hi-Latn', 'aaj marathi khana khaya'],
  ];
  it.each(benign)('%s: "%s" is not a crisis', (_lang, text) => {
    expect(isCrisisText(text)).toBe(false);
  });
});

describe('guardAdvice', () => {
  it('passes normal advice through untouched', () => {
    const text = 'Have a katori of dal and a chapati, then walk for 20 minutes.';
    const r = guardAdvice(text, 1500);
    expect(r.ok).toBe(true);
    expect(r.text).toBe(text);
  });

  it('catches a calorie target under the floor', () => {
    const r = guardAdvice('Eat only 900 calories tomorrow to make up for today.', 1500);
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('below_floor');
  });

  it('catches meal skipping', () => {
    const r = guardAdvice('Just skip dinner tonight.', 1500);
    expect(r.reasons).toContain('skip_meal');
  });

  it('catches a diagnosis', () => {
    const r = guardAdvice('Based on this you have diabetes.', 1500);
    expect(r.reasons).toContain('medical_claim');
  });

  it('leaves a sensible number alone', () => {
    const r = guardAdvice('Aim for about 1800 kcal today.', 1500);
    expect(r.ok).toBe(true);
  });
});

describe('guardAdvice calorie context', () => {
  it('allows a normal meal-sized number', () => {
    const r = guardAdvice('Your next meal can be 500 to 700 kcal, something like dal and rice.', 1500);
    expect(r.ok).toBe(true);
  });

  it('still catches a low number meant for the whole day', () => {
    expect(guardAdvice('Try to stay under 900 kcal per day this week.', 1500).reasons).toContain('below_floor');
    expect(guardAdvice('Eat only 1200 calories today to make up for it.', 1500).reasons).toContain('below_floor');
  });

  it('catches a low daily figure written in Devanagari', () => {
    expect(guardAdvice('आज फक्त 800 कॅलरी खा.', 1500).reasons).toContain('below_floor');
  });

  it('leaves a 400 kcal snack suggestion alone', () => {
    expect(guardAdvice('A 400 kcal snack is fine here.', 1500).ok).toBe(true);
  });
});

describe('guardAdvice, per language: unsafe advice is caught', () => {
  const unsafe: [lang: string, text: string, reason: string][] = [
    ['en', 'Skip your dinner tonight.', 'skip_meal'],
    ['en', 'Try skipping dinner for a week.', 'skip_meal'],
    ['en', 'Just skip breakfast and have tea.', 'skip_meal'],
    ['en', "Don't eat dinner tonight, drink water instead.", 'skip_meal'],
    ['en', 'You could try intermittent fasting.', 'fasting'],
    ['en', 'A 16:8 eating window works for many people.', 'fasting'],
    ['en', 'Try OMAD, one meal a day.', 'fasting'],
    ['en', 'Fast for a day to reset.', 'fasting'],
    ['en', 'Starve yourself for a day and it resets.', 'skip_meal'],
    ['en', 'Intermittent fasting is not for everyone, but you can try 16:8.', 'fasting'],
    ['en', 'You might have thyroid issues.', 'medical_claim'],
    ['en', 'It sounds like PCOS.', 'medical_claim'],
    ['en', 'Stay around 1,000 kcal a day.', 'below_floor'],
    ['en', '800 cal per day is enough for now.', 'below_floor'],
    ['en', 'Go for 900 kcal/day this week.', 'below_floor'],
    ['en', 'Aim for 300 calories a day.', 'below_floor'],
    ['en', 'Eat 1000-1200 kcal daily.', 'below_floor'],
    ['mr', 'उपवास करा.', 'fasting'],
    ['mr', 'आठवड्यातून एकदा उपवास ठेवा.', 'fasting'],
    ['mr', 'आज रात्रीचे जेवण टाळा.', 'skip_meal'],
    ['mr', 'नाश्ता टाळा आणि फक्त चहा घ्या.', 'skip_meal'],
    ['mr', 'उद्या दिवसभर उपाशी राहा.', 'skip_meal'],
    ['mr', 'रोज ९०० कॅलरी खा.', 'below_floor'],
    ['mr', 'दिवसाला १,००० कॅलरी पुरे.', 'below_floor'],
    ['mr', 'तुम्हाला थायरॉईड असू शकतो.', 'medical_claim'],
    ['hi', 'एक दिन में 900 कैलोरी खाएँ.', 'below_floor'],
    ['hi', 'रोज़ ८०० कैलोरी काफ़ी है.', 'below_floor'],
    ['hi', 'रात का खाना छोड़ दें.', 'skip_meal'],
    ['hi', 'हफ़्ते में दो दिन व्रत रखें.', 'fasting'],
    ['hi', 'उपवास करने से वज़न जल्दी घटेगा.', 'fasting'],
    ['hi', 'आपको थायराइड हो सकता है.', 'medical_claim'],
    ['hi-Latn', 'aaj raat ka khana chhod do', 'skip_meal'],
    ['hi-Latn', 'dinner skip kar do', 'skip_meal'],
    ['hi-Latn', 'vrat rakho, jaldi wajan ghatega', 'fasting'],
    ['mr-Latn', 'upvas kara, wajan kami hoil', 'fasting'],
    ['mr-Latn', 'ratriche jevan tala', 'skip_meal'],
    ['mr-Latn', 'roj 900 calories kha', 'below_floor'],
  ];
  it.each(unsafe)('%s: "%s" -> %s', (_lang, text, reason) => {
    const r = guardAdvice(text, 1500);
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain(reason);
  });
});

describe('guardAdvice, per language: ordinary coaching passes', () => {
  const fine: [lang: string, text: string][] = [
    ['en', 'Have a katori of dal and a chapati, then walk for 20 minutes.'],
    ['en', 'You have 640 kcal left today; dinner can be about 500 kcal.'],
    ['en', 'You have eaten 900 kcal today, so dinner can be a full plate.'],
    ['en', 'Aim for 1,800 kcal a day.'],
    ['en', 'Do not skip dinner; eat something light like dal and a roti.'],
    ['en', "Don't fast tomorrow, eat normally."],
    ['en', 'Never skip breakfast, it keeps the evening hunger down.'],
    ['en', 'Eat slowly, not fast, and stop when you are 80% full.'],
    ['en', 'Avoid fried snacks today, have a fruit instead.'],
    ['en', 'Your morning walk burned 250 kcal today.'],
    ['en', 'If you have diabetes, ask your doctor before changing your meals.'],
    ['en', 'Ask your doctor about a fasting blood sugar test.'],
    ['en', 'Thyroid problems can slow weight loss; a doctor can test for it.'],
    ['en', 'Breakfast can be 300 to 400 kcal, like poha with peanuts.'],
    ['en', 'Today, add a 120 kcal katori of curd to lunch.'],
    ['en', 'You averaged 1250 kcal a day over the last week, which is under your floor; please eat a bit more.'],
    ["en", "Today you're at 1100 kcal, so there is room for a proper dinner."],
    ['en', 'No dinner after 9 pm, it helps sleep.'],
    ['en', 'You skipped breakfast today, so have a proper lunch.'],
    ['en', 'You must be starving after that walk, have a full plate of dal rice.'],
    ['mr', 'आज तुमच्या 600 कॅलरी बाकी आहेत. रात्रीचे जेवण हलके ठेवा.'],
    ['mr', 'काहीतरी हलके खा, जेवण टाळू नका.'],
    ['mr', 'उद्या नेहमीसारखे खा, उपाशी राहू नका.'],
    ['mr', 'उपवास करू नका, नेहमीसारखे जेवा.'],
    ['mr', 'तळलेले पदार्थ टाळा, भाकरी आणि भाजी खा.'],
    ['mr', 'सकाळी उपाशीपोटी एक ग्लास पाणी प्या.'],
    ['mr', 'दुपारचे जेवण ५०० कॅलरीचे ठेवा.'],
    ['mr', 'शरीराला रात्रीचा खरा उपवास मिळतो.'],
    ['mr', 'रात्रीचे जेवण ८ च्या आत करा. उशिरा जेवण टाळा.'],
    ['mr', 'बाहेरचे जेवण टाळा, घरचा डबा न्या.'],
    ['mr', 'आज 1100 कॅलरी झाल्या, अजून 600 कॅलरी बाकी आहेत.'],
    ['mr', 'तुमचे सरासरी सेवन दिवसाला 1250 कॅलरी होते.'],
    ['hi', 'कुछ हल्का खाएँ, खाना न छोड़ें.'],
    ['hi', 'कल सामान्य खाएँ, भूखे न रहें.'],
    ['hi', 'आज आपकी 700 कैलोरी बची हैं, रात का खाना 500 कैलोरी तक रखें.'],
    ['hi', 'तली हुई चीज़ें छोड़ दें, दाल और रोटी लें.'],
    ['hi', 'उपवास न करें, समय पर खाना खाएँ.'],
    ['hi', 'गहरी साँस लें और धीरे से साँस छोड़ें.'],
    ['hi', 'आपने आज 1100 कैलोरी खाई हैं, रात का खाना भरपेट लें.'],
    ['hi', 'हफ़्ते का औसत रोज़ 1250 कैलोरी रहा.'],
    ['hi', 'देर रात का खाना छोड़ दें, 8 बजे तक खा लें.'],
    ['hi-Latn', 'khana mat chhodo, thoda halka khao'],
    ['mr-Latn', 'jevan tala nako, halka kha'],
  ];
  it.each(fine)('%s: "%s"', (_lang, text) => {
    const r = guardAdvice(text, 1500);
    expect(r.reasons).toEqual([]);
    expect(r.text).toBe(text);
  });
});

describe('guardAdvice replaces unsafe text instead of annotating it', () => {
  it('drops the model text entirely and returns the code-written wording', () => {
    const r = guardAdvice('Great work! Now skip dinner tonight to speed things up.', 1500);
    expect(r.ok).toBe(false);
    expect(r.text).not.toMatch(/skip dinner tonight/i);
    expect(r.text).toContain('1500');
  });

  it('uses the wording the caller gives, in the person’s language', () => {
    const words = { food: 'FOOD', medical: 'MEDICAL' };
    expect(guardAdvice('उपवास करा.', 1200, words).text).toBe('FOOD');
    expect(guardAdvice('आपको थायराइड हो सकता है.', 1200, words).text).toBe('MEDICAL');
    expect(guardAdvice('You might have PCOS, so skip breakfast.', 1200, words).text).toBe('FOOD\n\nMEDICAL');
  });
});

describe('asksAboutFasting', () => {
  it('recognises the coach quick prompts about fasting, in every language', () => {
    expect(asksAboutFasting('उपवासाने वजन कमी होते का?')).toBe(true);
    expect(asksAboutFasting('उपवास से वज़न घटता है क्या?')).toBe(true);
    expect(asksAboutFasting('Does fasting help weight loss?')).toBe(true);
  });

  it('recognises other ways of asking', () => {
    expect(asksAboutFasting('Should I try intermittent fasting?')).toBe(true);
    expect(asksAboutFasting('can I skip dinner tonight')).toBe(true);
    expect(asksAboutFasting('upvas kela tar chalel ka')).toBe(true);
    expect(asksAboutFasting('vrat rakhu kya')).toBe(true);
    expect(asksAboutFasting('रात्रीचे जेवण टाळले तर चालेल का?')).toBe(true);
  });

  it('leaves ordinary questions to the model', () => {
    expect(asksAboutFasting('What should I pack for office lunch?')).toBe(false);
    expect(asksAboutFasting('What should I eat for breakfast?')).toBe(false);
    expect(asksAboutFasting('I eat too fast, how do I slow down?')).toBe(false);
  });

  it('a meal already missed, or being very hungry, is a food question', () => {
    expect(asksAboutFasting('I skipped lunch, what should I eat now?')).toBe(false);
    expect(asksAboutFasting("I'm starving, what can I eat?")).toBe(false);
  });

  it('never fires on the app’s own prompts, even when they say "do not fast"', () => {
    const budget = { target: 1800, consumed: 2400, remaining: -600, earned: 0, perMeal: 0, mealsLeft: 1, proteinTarget: 100, proteinConsumed: 60, proteinLeft: 40, pct: 133 };
    const d = decide({ budget, hour: 20, waterMl: 1000, waterGoalMl: 3000, movedToday: false, lateMealDays: 0 });
    for (const actions of [['Eat normally tomorrow, do not fast'], ['उद्या नेहमीसारखे खा, उपाशी राहू नका'], ['कल सामान्य खाएँ, भूखे न रहें']]) {
      expect(asksAboutFasting(decisionPrompt(d, 'en', actions))).toBe(false);
    }
    expect(asksAboutFasting(dailyTipPrompt('en', ['Ate under the floor two days running, do not fast']))).toBe(false);
    expect(asksAboutFasting(dayReviewPrompt('en', ['Skipped breakfast']))).toBe(false);
    expect(asksAboutFasting(weeklyReportPrompt('en', ['Fasted on Ekadashi']))).toBe(false);
  });
});
