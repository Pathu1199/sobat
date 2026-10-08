import type { Lang } from './types';

/**
 * The one line under a notification: a small, warm, slightly funny thing
 * in the person's language, chosen so the same reminder does not read the
 * same twice in a row, and shaped by where the day's calories stand. A
 * water nudge at 20% of the budget eaten is not the water nudge at 110%.
 */
export type StoryKind = 'water' | 'break' | 'eyes' | 'posture' | 'walk' | 'meal' | 'stop' | 'sleep' | 'log' | 'weigh' | 'mantra';

/** Where the day stands: how much of the target has been eaten. */
export type Standing = 'fresh' | 'room' | 'steady' | 'close' | 'over';

export function standing(consumed: number, target: number): Standing {
  const pct = target > 0 ? consumed / target : 0;
  if (pct <= 0.15) return 'fresh';
  if (pct < 0.55) return 'room';
  if (pct < 0.85) return 'steady';
  if (pct <= 1.02) return 'close';
  return 'over';
}

type Pool = Record<Lang, string[]>;

const LINES: Record<StoryKind, Pool> = {
  water: {
    en: [
      'Your kidneys sent a thank-you note in advance.',
      'Plants get watered. You deserve the same.',
      'Thirst wears a hunger costume after 4 pm. Unmask it.',
      'One glass now beats three glasses at 11 pm.',
      'Water is the only drink with zero calories and zero regret.',
      'The climber on your mountain carries a bottle. So should you.',
      'Half the tiredness you feel is a glass of water away.',
      'Sip, do not gulp. Your stomach is not a bucket.',
    ],
    mr: [
      'किडनीने आधीच थँक्यू पाठवलंय.',
      'झाडांना पाणी घालता, स्वतःलाही घाला.',
      '४ नंतरची तहान भुकेचा वेष घालून येते. ओळखा.',
      'आता एक ग्लास, रात्री ११ चे तीन ग्लास वाचतात.',
      'पाणी: शून्य कॅलरी, शून्य पश्चात्ताप.',
      'डोंगरावरचा गिर्यारोहक बाटली घेऊन चालतो. तुम्हीही.',
      'अर्धा थकवा एका ग्लासाच्या अंतरावर असतो.',
      'घोट घोट, गटागट नाही. पोट म्हणजे बादली नाही.',
    ],
    hi: [
      'किडनी ने पहले ही थैंक्यू भेज दिया.',
      'पौधों को पानी देते हो, खुद को भी दो.',
      '4 बजे के बाद की प्यास भूख का भेस पहनकर आती है. पहचानो.',
      'अभी एक गिलास, रात 11 के तीन गिलास बच जाते हैं.',
      'पानी: शून्य कैलोरी, शून्य पछतावा.',
      'पहाड़ पर चढ़ने वाला बोतल साथ रखता है. आप भी.',
      'आधी थकान एक गिलास दूर होती है.',
      'घूँट-घूँट, गटागट नहीं. पेट बाल्टी नहीं है.',
    ],
  },
  break: {
    en: [
      'The screen will still be there in two minutes. Your spine wants a word.',
      'Stand up. Even the chair needs a break from you.',
      'Twenty seconds at the window counts as travel.',
      'Shoulders down from your ears. They climbed up again.',
      'A short walk now is cheaper than a physio later.',
      'The email can wait. The neck cannot.',
    ],
    mr: [
      'स्क्रीन दोन मिनिटांनी तिथेच असेल. पाठीला बोलायचंय.',
      'उभे राहा. खुर्चीलाही तुमच्यापासून ब्रेक हवाय.',
      'खिडकीत वीस सेकंद म्हणजे छोटा प्रवास.',
      'खांदे कानापासून खाली. परत वर चढले होते.',
      'आता छोटी फेरी, नंतरचा फिजिओ स्वस्त.',
      'ईमेल थांबेल. मान थांबणार नाही.',
    ],
    hi: [
      'स्क्रीन दो मिनट बाद भी वहीं रहेगी. रीढ़ को कुछ कहना है.',
      'खड़े हो जाओ. कुर्सी को भी आपसे ब्रेक चाहिए.',
      'खिड़की पर बीस सेकंड, छोटी यात्रा मान लो.',
      'कंधे कानों से नीचे. फिर ऊपर चढ़ गए थे.',
      'अभी छोटी वॉक, बाद का फ़िज़ियो सस्ता.',
      'ईमेल रुक सकता है. गर्दन नहीं.',
    ],
  },
  eyes: {
    en: ['Look at something far. The far thing missed you.', 'Blink ten times, slowly. Your eyes are drier than they admit.', 'Twenty feet, twenty seconds. The oldest trick that works.'],
    mr: ['लांब काहीतरी बघा. त्यालाही तुमची आठवण आली.', 'दहा वेळा हळू डोळे मिचका. डोळे कबूल करतात त्यापेक्षा कोरडे असतात.', 'वीस फूट, वीस सेकंद. जुनी पण खरी युक्ती.'],
    hi: ['दूर कुछ देखो. उसे भी आपकी याद आई.', 'दस बार धीरे पलकें झपकाओ. आँखें जितना मानती हैं उससे ज़्यादा सूखी हैं.', 'बीस फ़ीट, बीस सेकंड. सबसे पुरानी और सच्ची तरकीब.'],
  },
  posture: {
    en: ['Sit back. The chair has a backrest for a reason.', 'Chin in, chest up. You just grew a centimetre.'],
    mr: ['मागे टेका. खुर्चीला पाठ उगाच नाही.', 'हनुवटी आत, छाती वर. एक सेंटीमीटर उंच झालात.'],
    hi: ['पीछे टिको. कुर्सी की पीठ यूँ ही नहीं है.', 'ठुड्डी अंदर, सीना ऊपर. एक सेंटीमीटर लंबे हो गए.'],
  },
  walk: {
    en: ['Fifteen minutes on foot is the cheapest dessert you can afford today.', 'Steps are calories leaving quietly. Let them.', 'The walk after dinner is where the weight actually moves.'],
    mr: ['पंधरा मिनिटं चालणं हा आज परवडणारा स्वस्त गोड पदार्थ.', 'पावलं म्हणजे गुपचूप बाहेर जाणाऱ्या कॅलरी. जाऊ द्या.', 'रात्रीच्या जेवणानंतरची फेरी, तिथेच वजन खरं हलतं.'],
    hi: ['पंद्रह मिनट पैदल, आज की सबसे सस्ती मिठाई.', 'कदम यानी चुपचाप निकलती कैलोरी. निकलने दो.', 'रात के खाने के बाद की वॉक, वहीं वज़न सच में हिलता है.'],
  },
  meal: {
    en: ['Dal first, then the rest. The plate behaves after that.', 'Eat slowly. The stomach reports twenty minutes late.', 'Half the plate vegetables, and the maths does itself.'],
    mr: ['आधी डाळ, मग बाकी. मग ताट शहाण्यासारखं वागतं.', 'हळू खा. पोट वीस मिनिटं उशिरा कळवतं.', 'अर्धं ताट भाजी, आणि हिशेब आपोआप जुळतो.'],
    hi: ['पहले दाल, फिर बाकी. उसके बाद थाली समझदारी से चलती है.', 'धीरे खाओ. पेट बीस मिनट देर से बताता है.', 'आधी थाली सब्ज़ी, और हिसाब खुद हो जाता है.'],
  },
  stop: {
    en: ['Kitchen closed. The chef has gone home.', 'What is left is water, buttermilk or a fruit. That is the whole menu.', 'Tomorrow is a fresh page. Tonight, close the book.'],
    mr: ['स्वयंपाकघर बंद. आचारी घरी गेला.', 'आता पाणी, ताक किंवा एक फळ. एवढाच मेन्यू.', 'उद्या नवं पान. आज रात्री पुस्तक मिटा.'],
    hi: ['रसोई बंद. रसोइया घर चला गया.', 'अब पानी, छाछ या एक फल. बस इतना ही मेन्यू.', 'कल नया पन्ना. आज रात किताब बंद करो.'],
  },
  sleep: {
    en: ['Screens off. The phone will survive the night without you.', 'Seven hours of sleep burns more fat than one hour of worry.', 'Water by the bed, lights low, same wake time. Boring works.'],
    mr: ['स्क्रीन बंद. फोन तुमच्याशिवाय रात्र काढेल.', 'सात तास झोप एका तासाच्या काळजीपेक्षा जास्त चरबी जाळते.', 'पाणी जवळ, दिवे मंद, तीच उठायची वेळ. कंटाळवाणं पण चालतं.'],
    hi: ['स्क्रीन बंद. फ़ोन आपके बिना रात निकाल लेगा.', 'सात घंटे की नींद एक घंटे की चिंता से ज़्यादा चर्बी जलाती है.', 'पानी पास, रोशनी कम, वही उठने का समय. बोरिंग ही काम करता है.'],
  },
  log: {
    en: ['A meal not logged still counts. It just counts against you.', 'Thirty seconds to log it, thirty days to see the pattern.', 'The coach can only coach what it can see.'],
    mr: ['न नोंदवलेलं जेवणही मोजलं जातं. फक्त तुमच्या विरुद्ध.', 'नोंदवायला तीस सेकंद, पॅटर्न दिसायला तीस दिवस.', 'कोचला जे दिसतं तेच तो सुधारू शकतो.'],
    hi: ['बिना दर्ज खाना भी गिना जाता है. बस आपके खिलाफ़.', 'दर्ज करने में तीस सेकंड, पैटर्न दिखने में तीस दिन.', 'कोच वही सुधार सकता है जो उसे दिखता है.'],
  },
  weigh: {
    en: ['Morning, after the toilet, before chai. Then the climber moves.', 'One number a week tells the truth. Seven numbers a week tell stories.'],
    mr: ['सकाळी, शौचानंतर, चहाआधी. मग गिर्यारोहक पुढे जातो.', 'आठवड्याला एक आकडा खरं सांगतो. सात आकडे गोष्टी सांगतात.'],
    hi: ['सुबह, शौच के बाद, चाय से पहले. फिर पर्वतारोही आगे बढ़ता है.', 'हफ़्ते में एक नंबर सच बताता है. सात नंबर कहानियाँ.'],
  },
  mantra: {
    en: ['Small today. Fit always.'],
    mr: ['रोज थोडं, फिट सदा.'],
    hi: ['रोज़ थोड़ा, फ़िट सदा.'],
  },
};

/** The calorie-aware tail: a few words on where the day stands. */
const TAIL: Record<Standing, Pool> = {
  fresh: { en: ['Whole day ahead: {left} kcal to spend well.'], mr: ['अख्खा दिवस पुढे: {left} kcal नीट वापरायच्या.'], hi: ['पूरा दिन आगे: {left} kcal समझदारी से खर्च करनी हैं.'] },
  room: { en: ['{left} kcal left. Plenty of room, no hurry.'], mr: ['{left} kcal बाकी. भरपूर जागा, घाई नाही.'], hi: ['{left} kcal बाकी. काफ़ी जगह, कोई जल्दी नहीं.'] },
  steady: { en: ['{left} kcal left. Right on track.'], mr: ['{left} kcal बाकी. अगदी ट्रॅकवर.'], hi: ['{left} kcal बाकी. बिल्कुल ट्रैक पर.'] },
  close: { en: ['{left} kcal left. Land it gently.'], mr: ['{left} kcal बाकी. हळूच उतरवा.'], hi: ['{left} kcal बाकी. आराम से उतारो.'] },
  over: { en: ['{over} kcal over. Water and a walk, not a verdict.'], mr: ['{over} kcal जास्त. पाणी आणि फेरी, निकाल नाही.'], hi: ['{over} kcal ज़्यादा. पानी और वॉक, फ़ैसला नहीं.'] },
};

/** A stable number for the day plus a counter, so the line changes between nudges but not between renders. */
export function storySeed(date: string, n: number): number {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h + n * 7) >>> 0;
}

export function storyLine(kind: StoryKind, lang: Lang, seed: number, kcal?: { consumed: number; target: number }): string {
  const pool = LINES[kind][lang] ?? LINES[kind].en;
  const line = pool[seed % pool.length];
  if (!kcal || kind === 'mantra') return line;
  const st = standing(kcal.consumed, kcal.target);
  const tailPool = TAIL[st][lang] ?? TAIL[st].en;
  const tail = tailPool[seed % tailPool.length].replace('{left}', String(Math.max(0, kcal.target - kcal.consumed))).replace('{over}', String(Math.max(0, kcal.consumed - kcal.target)));
  return `${line} ${tail}`;
}
