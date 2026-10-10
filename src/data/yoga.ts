import type { Lang } from '../core/types';

/**
 * The asanas, with the names people use, how to do each one right, what it
 * is for, and who should skip it. Written for someone starting at home in
 * a PG room, not for a studio. Levels: 1 start, 2 some practice, 3 steady.
 * Each entry logs as the yoga activity when done.
 */
export type Asana = {
  id: string;
  sanskrit: string;
  name_en: string;
  name_mr: string;
  name_hi: string;
  level: 1 | 2 | 3;
  /** A sensible hold or rounds, in minutes, for the log. */
  minutes: number;
  category: 'standing' | 'seated' | 'lying' | 'backbend' | 'twist' | 'balance' | 'breath' | 'sequence';
  steps: Record<Lang, string[]>;
  benefits: Record<Lang, string>;
  caution: Record<Lang, string>;
  /** Flags that should hide it: knee, back, bp (blood pressure), neck, pregnancy. */
  avoidIf: ('knee' | 'back' | 'bp' | 'neck' | 'pregnancy')[];
};

export const ASANAS: Asana[] = [
  {
    id: 'tadasana', sanskrit: 'Tadasana', name_en: 'Mountain pose', name_mr: 'ताडासन', name_hi: 'ताड़ासन', level: 1, minutes: 2, category: 'standing',
    steps: {
      en: ['Stand with feet together, weight even on both feet.', 'Breathe in, interlock fingers, raise arms overhead, palms up.', 'Rise onto the toes and stretch the whole body up.', 'Hold 10 to 15 seconds breathing normally; come down slowly. Repeat 5 times.'],
      mr: ['पाय जुळवून उभे राहा, दोन्ही पायांवर सारखे वजन.', 'श्वास घेत बोटे गुंफून हात डोक्यावर न्या, तळवे वर.', 'टाचा उचलून चवड्यांवर या आणि पूर्ण शरीर वर ताणा.', '१० ते १५ सेकंद सामान्य श्वास घेत थांबा; हळू खाली या. ५ वेळा करा.'],
      hi: ['पैर मिलाकर खड़े हों, दोनों पैरों पर बराबर वज़न.', 'साँस लेते हुए उँगलियाँ फँसाकर हाथ सिर के ऊपर ले जाएँ, हथेलियाँ ऊपर.', 'एड़ियाँ उठाकर पंजों पर आएँ और पूरा शरीर ऊपर खींचें.', '10 से 15 सेकंड सामान्य साँस के साथ रुकें; धीरे नीचे आएँ. 5 बार.'],
    },
    benefits: { en: 'Posture, balance, and a full-body stretch after sitting. A good first pose every morning.', mr: 'ताठ उभे राहणे, तोल, आणि बसून आल्यावर पूर्ण शरीर ताणणे. रोज सकाळची पहिली आसन.', hi: 'मुद्रा, संतुलन, और बैठकर आने के बाद पूरे शरीर का खिंचाव. हर सुबह का पहला आसन.' },
    caution: { en: 'If dizzy, keep the heels down.', mr: 'चक्कर येत असेल तर टाचा जमिनीवरच ठेवा.', hi: 'चक्कर आए तो एड़ियाँ ज़मीन पर रखें.' },
    avoidIf: [],
  },
  {
    id: 'vrikshasana', sanskrit: 'Vrikshasana', name_en: 'Tree pose', name_mr: 'वृक्षासन', name_hi: 'वृक्षासन', level: 1, minutes: 2, category: 'balance',
    steps: {
      en: ['Stand tall; shift weight to the left foot.', 'Place the right sole on the inner left thigh or calf, never on the knee.', 'Join palms at the chest or raise them overhead.', 'Fix eyes on a point; hold 20 to 30 seconds. Change sides.'],
      mr: ['ताठ उभे राहा; वजन डाव्या पायावर घ्या.', 'उजवा तळपाय डाव्या मांडीच्या आतल्या बाजूला किंवा पोटरीवर ठेवा, गुडघ्यावर कधीच नाही.', 'छातीसमोर नमस्कार करा किंवा हात डोक्यावर न्या.', 'एका बिंदूवर नजर ठेवा; २० ते ३० सेकंद थांबा. बाजू बदला.'],
      hi: ['सीधे खड़े हों; वज़न बाएँ पैर पर लें.', 'दायाँ तलवा बाईं जाँघ के अंदर या पिंडली पर रखें, घुटने पर कभी नहीं.', 'छाती पर नमस्कार करें या हाथ ऊपर उठाएँ.', 'एक बिंदु पर नज़र रखें; 20 से 30 सेकंड रुकें. साइड बदलें.'],
    },
    benefits: { en: 'Balance, ankle and hip strength, and a calm, steady mind.', mr: 'तोल, घोटा आणि कंबरेची ताकद, शांत स्थिर मन.', hi: 'संतुलन, टखने और कूल्हे की ताकत, शांत स्थिर मन.' },
    caution: { en: 'Stand near a wall if balance is new.', mr: 'तोल नवीन असेल तर भिंतीजवळ उभे राहा.', hi: 'संतुलन नया हो तो दीवार के पास खड़े हों.' },
    avoidIf: [],
  },
  {
    id: 'trikonasana', sanskrit: 'Trikonasana', name_en: 'Triangle pose', name_mr: 'त्रिकोणासन', name_hi: 'त्रिकोणासन', level: 1, minutes: 3, category: 'standing',
    steps: {
      en: ['Stand with feet wide apart; turn the right foot out.', 'Stretch arms to the sides at shoulder height.', 'Breathe out and bend sideways to the right, right hand to shin or ankle, left arm up.', 'Look at the left hand; hold 20 to 30 seconds. Come up on an in-breath. Change sides.'],
      mr: ['पाय लांब फाकवून उभे राहा; उजवा पाय बाहेर वळवा.', 'हात खांद्याच्या उंचीवर बाजूला पसरा.', 'श्वास सोडत उजवीकडे वाका, उजवा हात नडगी किंवा घोट्यावर, डावा हात वर.', 'डाव्या हाताकडे बघा; २० ते ३० सेकंद थांबा. श्वास घेत वर या. बाजू बदला.'],
      hi: ['पैर चौड़े करके खड़े हों; दायाँ पैर बाहर मोड़ें.', 'हाथ कंधे की ऊँचाई पर बगल में फैलाएँ.', 'साँस छोड़ते हुए दाईं ओर झुकें, दायाँ हाथ पिंडली या टखने पर, बायाँ हाथ ऊपर.', 'बाएँ हाथ को देखें; 20 से 30 सेकंड रुकें. साँस लेते हुए ऊपर आएँ. साइड बदलें.'],
    },
    benefits: { en: 'Side waist, hamstrings and hips; helps digestion and the stiffness of a desk day.', mr: 'कंबरेची बाजू, मांडीमागचे स्नायू, नितंब; पचन आणि डेस्कच्या दिवसाचा ताठरपणा.', hi: 'कमर की बगल, जाँघ के पीछे के स्नायु, कूल्हे; पाचन और डेस्क के दिन की जकड़न.' },
    caution: { en: 'Do not twist the neck up if it hurts; look down instead.', mr: 'मान दुखत असेल तर वर बघू नका; खाली बघा.', hi: 'गर्दन दुखे तो ऊपर न देखें; नीचे देखें.' },
    avoidIf: ['neck', 'bp'],
  },
  {
    id: 'surya-namaskar', sanskrit: 'Surya Namaskar', name_en: 'Sun salutation (12 steps)', name_mr: 'सूर्यनमस्कार', name_hi: 'सूर्य नमस्कार', level: 2, minutes: 10, category: 'sequence',
    steps: {
      en: ['Pranamasana: stand, palms joined at the chest.', 'Hasta uttanasana: breathe in, arms up and slightly back.', 'Padahastasana: breathe out, fold forward, hands beside the feet.', 'Ashwa sanchalanasana: breathe in, right leg back, look up.', 'Dandasana: hold the breath, left leg back, body in one line.', 'Ashtanga namaskara: breathe out, knees, chest and chin down.', 'Bhujangasana: breathe in, lift the chest, elbows soft.', 'Parvatasana: breathe out, hips up, heels toward the floor.', 'Ashwa sanchalanasana: breathe in, right foot forward.', 'Padahastasana: breathe out, left foot forward, fold.', 'Hasta uttanasana: breathe in, rise with arms up.', 'Pranamasana: breathe out, palms at the chest. That is one round; start with 3, build to 12.'],
      mr: ['प्रणामासन: उभे राहून छातीसमोर नमस्कार.', 'हस्तउत्तानासन: श्वास घेत हात वर आणि किंचित मागे.', 'पादहस्तासन: श्वास सोडत पुढे वाकून हात पायांशेजारी.', 'अश्वसंचालनासन: श्वास घेत उजवा पाय मागे, वर बघा.', 'दंडासन: श्वास रोखून डावा पाय मागे, शरीर एका रेषेत.', 'अष्टांग नमस्कार: श्वास सोडत गुडघे, छाती आणि हनुवटी जमिनीवर.', 'भुजंगासन: श्वास घेत छाती वर, कोपर मऊ.', 'पर्वतासन: श्वास सोडत कंबर वर, टाचा जमिनीकडे.', 'अश्वसंचालनासन: श्वास घेत उजवा पाय पुढे.', 'पादहस्तासन: श्वास सोडत डावा पाय पुढे, वाका.', 'हस्तउत्तानासन: श्वास घेत हात वर करत उठा.', 'प्रणामासन: श्वास सोडत छातीसमोर नमस्कार. ही एक फेरी; ३ पासून सुरू करून १२ पर्यंत न्या.'],
      hi: ['प्रणामासन: खड़े होकर छाती पर नमस्कार.', 'हस्तउत्तानासन: साँस लेते हुए हाथ ऊपर और थोड़ा पीछे.', 'पादहस्तासन: साँस छोड़ते हुए आगे झुकें, हाथ पैरों के पास.', 'अश्वसंचालनासन: साँस लेते हुए दायाँ पैर पीछे, ऊपर देखें.', 'दंडासन: साँस रोककर बायाँ पैर पीछे, शरीर एक रेखा में.', 'अष्टांग नमस्कार: साँस छोड़ते हुए घुटने, छाती और ठुड्डी ज़मीन पर.', 'भुजंगासन: साँस लेते हुए छाती ऊपर, कोहनी ढीली.', 'पर्वतासन: साँस छोड़ते हुए कूल्हे ऊपर, एड़ियाँ ज़मीन की ओर.', 'अश्वसंचालनासन: साँस लेते हुए दायाँ पैर आगे.', 'पादहस्तासन: साँस छोड़ते हुए बायाँ पैर आगे, झुकें.', 'हस्तउत्तानासन: साँस लेते हुए हाथ ऊपर करते हुए उठें.', 'प्रणामासन: साँस छोड़ते हुए छाती पर नमस्कार. यह एक चक्र; 3 से शुरू करके 12 तक ले जाएँ.'],
    },
    benefits: { en: 'Whole-body warm-up and strength; the one sequence that covers the day if time is short. About 3.5 MET, counts as moderate activity.', mr: 'पूर्ण शरीराचा सराव आणि ताकद; वेळ कमी असेल तर दिवसभरासाठी पुरणारी एकच मालिका. सुमारे ३.५ MET, मध्यम हालचाल.', hi: 'पूरे शरीर का वार्म-अप और ताकत; समय कम हो तो दिन भर के लिए काफ़ी एक क्रम. लगभग 3.5 MET, मध्यम गतिविधि.' },
    caution: { en: 'Skip the jump and keep the back long. Not on a full stomach; wait 2 hours after a meal.', mr: 'उडी टाळा, पाठ लांब ठेवा. पोट भरलेले असताना नको; जेवणानंतर २ तास थांबा.', hi: 'कूद न करें, पीठ लंबी रखें. भरे पेट नहीं; खाने के 2 घंटे बाद.' },
    avoidIf: ['back', 'bp', 'pregnancy'],
  },
  {
    id: 'vajrasana', sanskrit: 'Vajrasana', name_en: 'Thunderbolt pose (after meals)', name_mr: 'वज्रासन', name_hi: 'वज्रासन', level: 1, minutes: 5, category: 'seated',
    steps: {
      en: ['Kneel, big toes touching, heels apart.', 'Sit back on the heels, spine straight, hands on the thighs.', 'Breathe slowly and sit 5 minutes.', 'The one asana done right after a meal; it helps digestion.'],
      mr: ['गुडघे टेकून बसा, अंगठे जुळलेले, टाचा बाजूला.', 'टाचांवर बसा, पाठ सरळ, हात मांड्यांवर.', 'सावकाश श्वास घेत ५ मिनिटे बसा.', 'जेवणानंतर लगेच करायची एकमेव आसन; पचनाला मदत.'],
      hi: ['घुटनों के बल बैठें, अँगूठे मिले, एड़ियाँ अलग.', 'एड़ियों पर बैठें, रीढ़ सीधी, हाथ जाँघों पर.', 'धीरे साँस लेते हुए 5 मिनट बैठें.', 'खाने के तुरंत बाद करने वाला एकमात्र आसन; पाचन में मदद.'],
    },
    benefits: { en: 'Digestion, calm breathing, and a straight back. Pairs with the post-lunch walk.', mr: 'पचन, शांत श्वास, सरळ पाठ. जेवणानंतरच्या फेरीसोबत चांगले.', hi: 'पाचन, शांत साँस, सीधी पीठ. दोपहर के खाने के बाद की वॉक के साथ.' },
    caution: { en: 'Knee pain: sit on a folded blanket or skip.', mr: 'गुडघे दुखत असतील तर घडी केलेल्या चादरीवर बसा किंवा टाळा.', hi: 'घुटने दुखें तो मुड़ा कंबल रखकर बैठें या छोड़ें.' },
    avoidIf: ['knee'],
  },
  {
    id: 'bhujangasana', sanskrit: 'Bhujangasana', name_en: 'Cobra pose', name_mr: 'भुजंगासन', name_hi: 'भुजंगासन', level: 1, minutes: 3, category: 'backbend',
    steps: {
      en: ['Lie on the stomach, forehead down, palms under the shoulders.', 'Breathe in and lift the head and chest using the back muscles, elbows bent and close to the body.', 'Keep the navel on the floor; shoulders away from the ears.', 'Hold 15 to 20 seconds; breathe out and lower. Repeat 3 times.'],
      mr: ['पोटावर झोपा, कपाळ खाली, तळवे खांद्यांखाली.', 'श्वास घेत पाठीच्या स्नायूंनी डोके आणि छाती वर उचला, कोपर वाकलेले आणि शरीराजवळ.', 'नाभी जमिनीवरच; खांदे कानांपासून दूर.', '१५ ते २० सेकंद थांबा; श्वास सोडत खाली या. ३ वेळा.'],
      hi: ['पेट के बल लेटें, माथा नीचे, हथेलियाँ कंधों के नीचे.', 'साँस लेते हुए पीठ की मांसपेशियों से सिर और छाती उठाएँ, कोहनी मुड़ी और शरीर के पास.', 'नाभि ज़मीन पर रहे; कंधे कानों से दूर.', '15 से 20 सेकंड रुकें; साँस छोड़ते हुए नीचे आएँ. 3 बार.'],
    },
    benefits: { en: 'Opens the chest and strengthens the lower back after hours of sitting.', mr: 'छाती मोकळी होते, तासन्‌तास बसल्यावर कंबर मजबूत.', hi: 'छाती खुलती है, घंटों बैठने के बाद कमर मज़बूत.' },
    caution: { en: 'Lift only as far as is comfortable; no pain in the lower back.', mr: 'जितके सहज तितकेच वर या; कंबरेत वेदना नको.', hi: 'जितना आराम से हो उतना ही उठें; कमर में दर्द नहीं.' },
    avoidIf: ['back', 'pregnancy'],
  },
  {
    id: 'balasana', sanskrit: 'Balasana', name_en: "Child's pose", name_mr: 'बालासन', name_hi: 'बालासन', level: 1, minutes: 3, category: 'seated',
    steps: {
      en: ['Kneel and sit on the heels.', 'Breathe out and fold forward, forehead to the floor.', 'Arms stretched ahead or resting beside the body.', 'Breathe into the back; rest 1 to 2 minutes.'],
      mr: ['गुडघ्यांवर बसून टाचांवर बसा.', 'श्वास सोडत पुढे वाका, कपाळ जमिनीवर.', 'हात पुढे पसरा किंवा शरीराशेजारी ठेवा.', 'पाठीत श्वास घ्या; १ ते २ मिनिटे विश्रांती.'],
      hi: ['घुटनों पर बैठकर एड़ियों पर बैठें.', 'साँस छोड़ते हुए आगे झुकें, माथा ज़मीन पर.', 'हाथ आगे फैलाएँ या शरीर के पास रखें.', 'पीठ में साँस लें; 1 से 2 मिनट आराम.'],
    },
    benefits: { en: 'Rest between poses; releases the lower back and calms the breath.', mr: 'आसनांमध्ये विश्रांती; कंबर मोकळी, श्वास शांत.', hi: 'आसनों के बीच आराम; कमर ढीली, साँस शांत.' },
    caution: { en: 'Knee trouble: place a cushion between calves and thighs.', mr: 'गुडघ्यांचा त्रास: पोटरी आणि मांडीमध्ये उशी ठेवा.', hi: 'घुटने की तकलीफ़: पिंडली और जाँघ के बीच तकिया रखें.' },
    avoidIf: [],
  },
  {
    id: 'marjariasana', sanskrit: 'Marjariasana-Bitilasana', name_en: 'Cat-cow', name_mr: 'मार्जारासन', name_hi: 'मार्जारी आसन', level: 1, minutes: 3, category: 'backbend',
    steps: {
      en: ['On hands and knees, wrists under shoulders, knees under hips.', 'Breathe in: drop the belly, lift the chest and tailbone (cow).', 'Breathe out: round the back, tuck the chin (cat).', 'Move slowly with the breath, 10 rounds.'],
      mr: ['हात आणि गुडघ्यांवर या, मनगटे खांद्यांखाली, गुडघे कंबरेखाली.', 'श्वास घ्या: पोट खाली, छाती आणि माकडहाड वर (गाय).', 'श्वास सोडा: पाठ गोल करा, हनुवटी आत (मांजर).', 'श्वासासोबत सावकाश, १० फेऱ्या.'],
      hi: ['हाथों और घुटनों पर आएँ, कलाइयाँ कंधों के नीचे, घुटने कूल्हों के नीचे.', 'साँस लें: पेट नीचे, छाती और पूँछ की हड्डी ऊपर (गाय).', 'साँस छोड़ें: पीठ गोल करें, ठुड्डी अंदर (बिल्ली).', 'साँस के साथ धीरे, 10 चक्र.'],
    },
    benefits: { en: 'The best two minutes for a stiff office back; keeps the spine moving.', mr: 'ऑफिसच्या ताठ पाठीसाठी सर्वोत्तम दोन मिनिटे; मणका हलता ठेवते.', hi: 'ऑफ़िस की जकड़ी पीठ के लिए सबसे अच्छे दो मिनट; रीढ़ को चलता रखता है.' },
    caution: { en: 'Wrist pain: make fists or do it on the forearms.', mr: 'मनगट दुखत असेल तर मुठी वळा किंवा कोपरांवर करा.', hi: 'कलाई दुखे तो मुट्ठी बाँधें या कोहनी पर करें.' },
    avoidIf: [],
  },
  {
    id: 'adho-mukha', sanskrit: 'Adho Mukha Svanasana', name_en: 'Downward dog', name_mr: 'अधोमुख श्वानासन', name_hi: 'अधोमुख श्वानासन', level: 2, minutes: 2, category: 'standing',
    steps: {
      en: ['From hands and knees, tuck the toes and lift the hips up and back.', 'Press the palms down, straighten the arms, let the head hang.', 'Knees can stay bent; heels reach toward the floor without forcing.', 'Hold 20 to 30 seconds, 3 times.'],
      mr: ['हात-गुडघ्यांवरून चवडे टेकवून कंबर वर आणि मागे उचला.', 'तळवे दाबा, हात सरळ, डोके मोकळे सोडा.', 'गुडघे वाकलेले चालतील; टाचा जमिनीकडे, जबरदस्ती नको.', '२० ते ३० सेकंद, ३ वेळा.'],
      hi: ['हाथ-घुटनों से पंजे टिकाकर कूल्हे ऊपर और पीछे उठाएँ.', 'हथेलियाँ दबाएँ, हाथ सीधे, सिर ढीला छोड़ें.', 'घुटने मुड़े रह सकते हैं; एड़ियाँ ज़मीन की ओर, ज़ोर नहीं.', '20 से 30 सेकंड, 3 बार.'],
    },
    benefits: { en: 'Stretches the whole back body; builds shoulder strength.', mr: 'शरीराची पूर्ण मागची बाजू ताणली जाते; खांदे मजबूत.', hi: 'शरीर का पूरा पिछला हिस्सा खिंचता है; कंधे मज़बूत.' },
    caution: { en: 'High blood pressure or wrist pain: hands on a chair seat instead of the floor.', mr: 'उच्च रक्तदाब किंवा मनगट दुखणे: जमिनीऐवजी खुर्चीच्या आसनावर हात.', hi: 'हाई बीपी या कलाई दर्द: ज़मीन की जगह कुर्सी की सीट पर हाथ.' },
    avoidIf: ['bp'],
  },
  {
    id: 'setu-bandhasana', sanskrit: 'Setu Bandhasana', name_en: 'Bridge pose', name_mr: 'सेतुबंधासन', name_hi: 'सेतुबंधासन', level: 1, minutes: 3, category: 'backbend',
    steps: {
      en: ['Lie on the back, knees bent, feet hip-width and close to the hips.', 'Breathe in and lift the hips, pressing through the feet.', 'Keep knees over ankles; chin slightly tucked.', 'Hold 15 to 20 seconds; lower slowly. Repeat 5 times.'],
      mr: ['पाठीवर झोपा, गुडघे वाकवून, पाय कंबरेइतके अंतरावर आणि नितंबांजवळ.', 'श्वास घेत पायांवर दाब देत कंबर वर उचला.', 'गुडघे घोट्यांवर; हनुवटी किंचित आत.', '१५ ते २० सेकंद; हळू खाली. ५ वेळा.'],
      hi: ['पीठ के बल लेटें, घुटने मुड़े, पैर कूल्हे जितनी दूरी पर और कूल्हों के पास.', 'साँस लेते हुए पैरों से दबाव देकर कूल्हे उठाएँ.', 'घुटने टखनों के ऊपर; ठुड्डी थोड़ी अंदर.', '15 से 20 सेकंड; धीरे नीचे. 5 बार.'],
    },
    benefits: { en: 'Glutes and lower back without strain; opens the chest; good before sleep.', mr: 'नितंब आणि कंबर ताण न देता मजबूत; छाती मोकळी; झोपण्यापूर्वी चांगले.', hi: 'कूल्हे और कमर बिना तनाव मज़बूत; छाती खुलती है; सोने से पहले अच्छा.' },
    caution: { en: 'Neck stays still; do not turn the head while up.', mr: 'मान स्थिर; वर असताना डोके वळवू नका.', hi: 'गर्दन स्थिर; ऊपर रहते हुए सिर न घुमाएँ.' },
    avoidIf: ['neck'],
  },
  {
    id: 'pawanmuktasana', sanskrit: 'Pawanmuktasana', name_en: 'Wind-relieving pose', name_mr: 'पवनमुक्तासन', name_hi: 'पवनमुक्तासन', level: 1, minutes: 3, category: 'lying',
    steps: {
      en: ['Lie on the back; breathe in.', 'Breathe out, hug the right knee to the chest, left leg straight.', 'Lift the head toward the knee if comfortable; hold 15 seconds.', 'Change sides, then both knees together. 3 rounds.'],
      mr: ['पाठीवर झोपा; श्वास घ्या.', 'श्वास सोडत उजवा गुडघा छातीशी धरा, डावा पाय सरळ.', 'सहज असेल तर डोके गुडघ्याकडे; १५ सेकंद.', 'बाजू बदला, मग दोन्ही गुडघे एकत्र. ३ फेऱ्या.'],
      hi: ['पीठ के बल लेटें; साँस लें.', 'साँस छोड़ते हुए दायाँ घुटना छाती से लगाएँ, बायाँ पैर सीधा.', 'आराम हो तो सिर घुटने की ओर; 15 सेकंड.', 'साइड बदलें, फिर दोनों घुटने साथ. 3 चक्र.'],
    },
    benefits: { en: 'Gas, bloating and a heavy stomach; eases the lower back.', mr: 'गॅस, पोट फुगणे, जड पोट; कंबर मोकळी.', hi: 'गैस, पेट फूलना, भारी पेट; कमर को आराम.' },
    caution: { en: 'Avoid right after a meal; wait 2 hours.', mr: 'जेवणानंतर लगेच नको; २ तास थांबा.', hi: 'खाने के तुरंत बाद नहीं; 2 घंटे रुकें.' },
    avoidIf: ['pregnancy'],
  },
  {
    id: 'paschimottanasana', sanskrit: 'Paschimottanasana', name_en: 'Seated forward bend', name_mr: 'पश्चिमोत्तानासन', name_hi: 'पश्चिमोत्तानासन', level: 2, minutes: 3, category: 'seated',
    steps: {
      en: ['Sit with legs straight, feet together, spine tall.', 'Breathe in, raise the arms; breathe out and fold from the hips.', 'Hold shins, ankles or feet, back long rather than rounded.', 'Hold 20 to 30 seconds breathing slowly. 3 times.'],
      mr: ['पाय सरळ पसरून बसा, पाय जुळलेले, पाठ ताठ.', 'श्वास घेत हात वर; श्वास सोडत कंबरेतून पुढे वाका.', 'नडगी, घोटे किंवा पाय धरा, पाठ गोल नको, लांब.', '२० ते ३० सेकंद सावकाश श्वास. ३ वेळा.'],
      hi: ['पैर सीधे फैलाकर बैठें, पैर मिले, रीढ़ सीधी.', 'साँस लेते हुए हाथ ऊपर; साँस छोड़ते हुए कूल्हों से आगे झुकें.', 'पिंडली, टखने या पैर पकड़ें, पीठ गोल नहीं, लंबी.', '20 से 30 सेकंड धीमी साँस. 3 बार.'],
    },
    benefits: { en: 'Hamstrings and back; calms the mind; helps digestion.', mr: 'मांडीमागचे स्नायू आणि पाठ; मन शांत; पचन.', hi: 'जाँघ के पीछे के स्नायु और पीठ; मन शांत; पाचन.' },
    caution: { en: 'Back pain or slipped disc: skip, or bend only a little with knees soft.', mr: 'पाठदुखी किंवा डिस्कचा त्रास: टाळा, किंवा गुडघे मऊ ठेवून थोडेसेच वाका.', hi: 'पीठ दर्द या डिस्क की तकलीफ़: छोड़ें, या घुटने ढीले रखकर थोड़ा ही झुकें.' },
    avoidIf: ['back', 'pregnancy'],
  },
  {
    id: 'ardha-matsyendrasana', sanskrit: 'Ardha Matsyendrasana', name_en: 'Half spinal twist', name_mr: 'अर्धमत्स्येंद्रासन', name_hi: 'अर्ध मत्स्येन्द्रासन', level: 2, minutes: 3, category: 'twist',
    steps: {
      en: ['Sit with legs straight; bend the right knee and place the right foot outside the left knee.', 'Breathe in, lengthen the spine; breathe out and twist to the right, left elbow outside the right knee.', 'Right hand behind you; look over the right shoulder.', 'Hold 20 seconds; release and change sides.'],
      mr: ['पाय सरळ पसरून बसा; उजवा गुडघा वाकवून उजवा पाय डाव्या गुडघ्याच्या बाहेर ठेवा.', 'श्वास घेत पाठ लांब करा; श्वास सोडत उजवीकडे वळा, डावा कोपर उजव्या गुडघ्याच्या बाहेर.', 'उजवा हात मागे; उजव्या खांद्यावरून बघा.', '२० सेकंद; सोडा आणि बाजू बदला.'],
      hi: ['पैर सीधे फैलाकर बैठें; दायाँ घुटना मोड़कर दायाँ पैर बाएँ घुटने के बाहर रखें.', 'साँस लेते हुए रीढ़ लंबी करें; साँस छोड़ते हुए दाईं ओर मुड़ें, बाईं कोहनी दाएँ घुटने के बाहर.', 'दायाँ हाथ पीछे; दाएँ कंधे के ऊपर से देखें.', '20 सेकंड; छोड़ें और साइड बदलें.'],
    },
    benefits: { en: 'Spine mobility and digestion; a reset after a long sit.', mr: 'मणक्याची लवचिकता आणि पचन; बराच वेळ बसल्यावरचा रीसेट.', hi: 'रीढ़ का लचीलापन और पाचन; लंबे समय बैठने के बाद का रीसेट.' },
    caution: { en: 'Twist from the belly, not by pulling with the arm.', mr: 'हाताने ओढून नव्हे, पोटातून वळा.', hi: 'हाथ से खींचकर नहीं, पेट से मुड़ें.' },
    avoidIf: ['back', 'pregnancy'],
  },
  {
    id: 'naukasana', sanskrit: 'Naukasana', name_en: 'Boat pose', name_mr: 'नौकासन', name_hi: 'नौकासन', level: 2, minutes: 2, category: 'lying',
    steps: {
      en: ['Lie on the back, arms by the sides.', 'Breathe in and lift the head, chest and legs together, arms reaching toward the feet.', 'Balance on the hips; keep the breath going.', 'Hold 10 to 15 seconds; lower. 3 to 5 times.'],
      mr: ['पाठीवर झोपा, हात बाजूला.', 'श्वास घेत डोके, छाती आणि पाय एकत्र उचला, हात पायांकडे.', 'नितंबांवर तोल; श्वास चालू ठेवा.', '१० ते १५ सेकंद; खाली. ३ ते ५ वेळा.'],
      hi: ['पीठ के बल लेटें, हाथ बगल में.', 'साँस लेते हुए सिर, छाती और पैर एक साथ उठाएँ, हाथ पैरों की ओर.', 'कूल्हों पर संतुलन; साँस चलती रहे.', '10 से 15 सेकंड; नीचे. 3 से 5 बार.'],
    },
    benefits: { en: 'Core strength, the muscle that holds the belly in and protects the back.', mr: 'पोटाचे स्नायू, जे पोट आत धरतात आणि पाठ सांभाळतात.', hi: 'कोर की ताकत, जो पेट अंदर रखती है और पीठ बचाती है.' },
    caution: { en: 'Bend the knees if the back strains.', mr: 'पाठीवर ताण आला तर गुडघे वाकवा.', hi: 'पीठ पर खिंचाव हो तो घुटने मोड़ें.' },
    avoidIf: ['back', 'bp', 'pregnancy'],
  },
  {
    id: 'shalabhasana', sanskrit: 'Shalabhasana', name_en: 'Locust pose', name_mr: 'शलभासन', name_hi: 'शलभासन', level: 2, minutes: 2, category: 'backbend',
    steps: {
      en: ['Lie on the stomach, chin down, arms under the thighs or by the sides.', 'Breathe in and lift one leg straight, without turning the hip.', 'Hold 10 seconds; change legs. Then both legs if comfortable.', '3 rounds.'],
      mr: ['पोटावर झोपा, हनुवटी खाली, हात मांड्यांखाली किंवा बाजूला.', 'श्वास घेत एक पाय सरळ उचला, कंबर न वळवता.', '१० सेकंद; पाय बदला. मग सहज असेल तर दोन्ही.', '३ फेऱ्या.'],
      hi: ['पेट के बल लेटें, ठुड्डी नीचे, हाथ जाँघों के नीचे या बगल में.', 'साँस लेते हुए एक पैर सीधा उठाएँ, कूल्हा न घुमाएँ.', '10 सेकंड; पैर बदलें. फिर आराम हो तो दोनों.', '3 चक्र.'],
    },
    benefits: { en: 'Lower back and glute strength: the antidote to a chair.', mr: 'कंबर आणि नितंब मजबूत: खुर्चीवर उतारा.', hi: 'कमर और कूल्हे मज़बूत: कुर्सी का तोड़.' },
    caution: { en: 'Lift gently; no jerk.', mr: 'हळू उचला; झटका नको.', hi: 'धीरे उठाएँ; झटका नहीं.' },
    avoidIf: ['back', 'pregnancy'],
  },
  {
    id: 'utkatasana', sanskrit: 'Utkatasana', name_en: 'Chair pose', name_mr: 'उत्कटासन', name_hi: 'उत्कटासन', level: 2, minutes: 2, category: 'standing',
    steps: {
      en: ['Stand with feet hip-width apart.', 'Breathe in, raise the arms; breathe out and bend the knees as if sitting on a chair.', 'Weight in the heels, knees behind the toes, chest up.', 'Hold 15 to 30 seconds. 3 times.'],
      mr: ['पाय कंबरेइतके अंतरावर ठेवून उभे राहा.', 'श्वास घेत हात वर; श्वास सोडत खुर्चीवर बसल्यासारखे गुडघे वाकवा.', 'वजन टाचांवर, गुडघे बोटांच्या मागे, छाती वर.', '१५ ते ३० सेकंद. ३ वेळा.'],
      hi: ['पैर कूल्हे जितनी दूरी पर रखकर खड़े हों.', 'साँस लेते हुए हाथ ऊपर; साँस छोड़ते हुए कुर्सी पर बैठने की तरह घुटने मोड़ें.', 'वज़न एड़ियों में, घुटने पंजों के पीछे, छाती ऊपर.', '15 से 30 सेकंड. 3 बार.'],
    },
    benefits: { en: 'Thighs and glutes, the biggest calorie-burning muscles; safer than deep squats.', mr: 'मांड्या आणि नितंब, सर्वात जास्त कॅलरी जाळणारे स्नायू; खोल स्क्वॉटपेक्षा सुरक्षित.', hi: 'जाँघ और कूल्हे, सबसे ज़्यादा कैलोरी जलाने वाली मांसपेशियाँ; गहरे स्क्वॉट से सुरक्षित.' },
    caution: { en: 'Knee pain: bend less, or hold a chair back.', mr: 'गुडघे दुखत असतील तर कमी वाका, किंवा खुर्चीचा आधार घ्या.', hi: 'घुटने दुखें तो कम झुकें, या कुर्सी पकड़ें.' },
    avoidIf: ['knee'],
  },
  {
    id: 'anulom-vilom', sanskrit: 'Anulom Vilom', name_en: 'Alternate-nostril breathing', name_mr: 'अनुलोम विलोम', name_hi: 'अनुलोम विलोम', level: 1, minutes: 5, category: 'breath',
    steps: {
      en: ['Sit comfortably, spine tall, eyes closed.', 'Close the right nostril with the thumb; breathe in through the left for 4 counts.', 'Close the left with the ring finger; breathe out through the right for 4 to 6 counts.', 'Breathe in right, out left. That is one round; do 10.'],
      mr: ['आरामात बसा, पाठ ताठ, डोळे मिटा.', 'अंगठ्याने उजवी नाकपुडी बंद; डावीने ४ मोजत श्वास घ्या.', 'अनामिकेने डावी बंद; उजवीने ४ ते ६ मोजत श्वास सोडा.', 'उजवीने घ्या, डावीने सोडा. ही एक फेरी; १० करा.'],
      hi: ['आराम से बैठें, रीढ़ सीधी, आँखें बंद.', 'अँगूठे से दायाँ नथुना बंद; बाएँ से 4 गिनते हुए साँस लें.', 'अनामिका से बायाँ बंद; दाएँ से 4 से 6 गिनते हुए साँस छोड़ें.', 'दाएँ से लें, बाएँ से छोड़ें. यह एक चक्र; 10 करें.'],
    },
    benefits: { en: 'Lowers stress and the evening cravings that come with it; steadies blood pressure over weeks.', mr: 'ताण आणि त्यासोबत येणारी संध्याकाळची खाण्याची ओढ कमी; आठवड्यांत रक्तदाब स्थिर.', hi: 'तनाव और उसके साथ आने वाली शाम की खाने की तलब कम; हफ़्तों में बीपी स्थिर.' },
    caution: { en: 'Never force or hold the breath till discomfort.', mr: 'जबरदस्ती नको, अस्वस्थ वाटेपर्यंत श्वास रोखू नका.', hi: 'ज़ोर न लगाएँ, बेचैनी तक साँस न रोकें.' },
    avoidIf: [],
  },
  {
    id: 'bhramari', sanskrit: 'Bhramari', name_en: 'Bee breath', name_mr: 'भ्रामरी', name_hi: 'भ्रामरी', level: 1, minutes: 3, category: 'breath',
    steps: {
      en: ['Sit tall, eyes closed, index fingers lightly on the ear flaps.', 'Breathe in deeply.', 'Breathe out slowly making a soft humming sound like a bee.', 'Feel the vibration in the head; 5 to 7 rounds. Good before sleep.'],
      mr: ['ताठ बसा, डोळे मिटा, तर्जनी हलकेच कानांच्या पाळ्यांवर.', 'खोल श्वास घ्या.', 'मधमाशीसारखा मंद गुंजारव करत सावकाश श्वास सोडा.', 'डोक्यात कंपन जाणवू द्या; ५ ते ७ फेऱ्या. झोपण्यापूर्वी चांगले.'],
      hi: ['सीधे बैठें, आँखें बंद, तर्जनी हल्के से कानों पर.', 'गहरी साँस लें.', 'मधुमक्खी की तरह हल्की गुंजन करते हुए धीरे साँस छोड़ें.', 'सिर में कंपन महसूस करें; 5 से 7 चक्र. सोने से पहले अच्छा.'],
    },
    benefits: { en: 'Calms a racing mind in two minutes; helps sleep.', mr: 'दोन मिनिटांत धावणारे मन शांत; झोप.', hi: 'दो मिनट में भागता मन शांत; नींद.' },
    caution: { en: 'None for most people; stop if the ears hurt.', mr: 'बहुतेकांसाठी काही नाही; कान दुखले तर थांबा.', hi: 'ज़्यादातर के लिए कुछ नहीं; कान दुखें तो रुकें.' },
    avoidIf: [],
  },
  {
    id: 'kapalbhati', sanskrit: 'Kapalbhati', name_en: 'Skull-shining breath', name_mr: 'कपालभाती', name_hi: 'कपालभाति', level: 2, minutes: 5, category: 'breath',
    steps: {
      en: ['Sit tall on an empty stomach.', 'Breathe in normally; breathe out in short, sharp pushes from the belly, one per second.', 'The in-breath happens on its own between pushes.', 'Start with 20 pushes, rest, 3 rounds. Build slowly to 60.'],
      mr: ['रिकाम्या पोटी ताठ बसा.', 'सामान्य श्वास घ्या; पोटातून छोटे जोरदार झटके देत श्वास सोडा, सेकंदाला एक.', 'झटक्यांच्या मध्ये श्वास आपोआप आत येतो.', '२० झटक्यांनी सुरू करा, विश्रांती, ३ फेऱ्या. हळूहळू ६० पर्यंत.'],
      hi: ['खाली पेट सीधे बैठें.', 'सामान्य साँस लें; पेट से छोटे तेज़ झटकों में साँस छोड़ें, एक प्रति सेकंड.', 'झटकों के बीच साँस अपने आप अंदर आती है.', '20 झटकों से शुरू, आराम, 3 चक्र. धीरे-धीरे 60 तक.'],
    },
    benefits: { en: 'Wakes the body and the belly muscles; part of a morning routine, not a weight-loss trick on its own.', mr: 'शरीर आणि पोटाचे स्नायू जागे; सकाळच्या सवयीचा भाग, एकटी वजन कमी करण्याची युक्ती नाही.', hi: 'शरीर और पेट की मांसपेशियाँ जागती हैं; सुबह की दिनचर्या का हिस्सा, अकेले वज़न घटाने की तरकीब नहीं.' },
    caution: { en: 'Not with high blood pressure, heart trouble, hernia, or in pregnancy. Stop if dizzy.', mr: 'उच्च रक्तदाब, हृदयविकार, हर्निया किंवा गरोदरपणात नको. चक्कर आली तर थांबा.', hi: 'हाई बीपी, दिल की तकलीफ़, हर्निया या गर्भावस्था में नहीं. चक्कर आए तो रुकें.' },
    avoidIf: ['bp', 'pregnancy', 'back'],
  },
  {
    id: 'shavasana', sanskrit: 'Shavasana', name_en: 'Corpse pose (rest)', name_mr: 'शवासन', name_hi: 'शवासन', level: 1, minutes: 5, category: 'lying',
    steps: {
      en: ['Lie on the back, legs a little apart, arms away from the body, palms up.', 'Close the eyes; let the whole body go heavy.', 'Notice the breath without changing it, 5 minutes.', 'Always the last pose of a practice.'],
      mr: ['पाठीवर झोपा, पाय किंचित फाकलेले, हात शरीरापासून दूर, तळवे वर.', 'डोळे मिटा; संपूर्ण शरीर जड होऊ द्या.', 'श्वास न बदलता फक्त जाणवत राहा, ५ मिनिटे.', 'सरावातली नेहमी शेवटची आसन.'],
      hi: ['पीठ के बल लेटें, पैर थोड़े अलग, हाथ शरीर से दूर, हथेलियाँ ऊपर.', 'आँखें बंद; पूरा शरीर भारी होने दें.', 'साँस को बदले बिना बस महसूस करें, 5 मिनट.', 'अभ्यास का हमेशा आख़िरी आसन.'],
    },
    benefits: { en: 'Lets the practice settle; lowers stress hormones that drive belly fat.', mr: 'सराव जिरतो; पोटावर चरबी वाढवणारे ताण-संप्रेरक कमी.', hi: 'अभ्यास को ठहराता है; पेट की चर्बी बढ़ाने वाले तनाव हार्मोन कम.' },
    caution: { en: 'None.', mr: 'काही नाही.', hi: 'कुछ नहीं.' },
    avoidIf: [],
  },
];

export const YOGA_FLAGS = ['knee', 'back', 'bp', 'neck', 'pregnancy'] as const;

export function asanaName(a: Asana, lang: Lang): string {
  return lang === 'mr' ? a.name_mr : lang === 'hi' ? a.name_hi : a.name_en;
}

/** Simple home routines built from the list, for someone who does not want to choose. */
export const YOGA_ROUTINES: { id: string; minutes: number; asanas: string[] }[] = [
  { id: 'morning', minutes: 12, asanas: ['tadasana', 'surya-namaskar', 'vrikshasana', 'shavasana'] },
  { id: 'office-back', minutes: 8, asanas: ['marjariasana', 'bhujangasana', 'setu-bandhasana', 'ardha-matsyendrasana', 'balasana'] },
  { id: 'after-meal', minutes: 5, asanas: ['vajrasana'] },
  { id: 'sleep', minutes: 7, asanas: ['pawanmuktasana', 'setu-bandhasana', 'bhramari', 'shavasana'] },
  { id: 'belly', minutes: 10, asanas: ['kapalbhati', 'naukasana', 'shalabhasana', 'utkatasana', 'paschimottanasana'] },
];
