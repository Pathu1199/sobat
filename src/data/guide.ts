import type { Lang } from '../core/types';

/**
 * The coach's standing advice: how to use the app so the numbers mean
 * something. Written once per language rather than through the i18n table,
 * because these are paragraphs, not labels.
 */
export type GuideSection = { id: string; icon: string; title: string; lines: string[] };

const en: GuideSection[] = [
  {
    id: 'weigh',
    icon: 'scale-outline',
    title: 'How to check your weight',
    lines: [
      'Once a week, same day, same scale. Sunday morning works well.',
      'Morning, after the toilet, before food or water, light clothes.',
      'Tap the weight card on Progress, or the Weight tile on Today if you added it in Me → Customize, and enter the number. The weight sheet shows what has changed and whether the plan is working.',
      'Day-to-day swings of 1 to 2 kg are water and food in the gut, not fat. Only the weekly line matters.',
      'If the weekly number has not moved for 3 weeks, tighten the log for a week before changing the plan.',
    ],
  },
  {
    id: 'log',
    icon: 'restaurant-outline',
    title: 'How to log food',
    lines: [
      'Log everything, including the tea, the biscuit and the taste while cooking. Half-logged days look better than they were.',
      "Today's menu holds each meal of your eating pattern. Ate it as it says? Tap Ate as planned. For anything else, tap ➕ and search by name, take a photo or scan the barcode.",
      'Check the portion. A katori is 150 g; a chapati 40 g. Change the quantity if yours is bigger.',
      'Missed a day? Tap it on the week strip at the top of Today and fill it in. An honest late entry beats a blank.',
    ],
  },
  {
    id: 'avoid',
    icon: 'ban-outline',
    title: 'What to avoid, and what to have instead',
    lines: [
      'Your avoid list: milk tea with sugar (black tea instead), cashews (badam and akrod instead), shev, namkeen, biscuits and fried bhaji (roasted chana or plain bhel instead).',
      'The menu the app suggests never holds one of these, and the coach knows the list. When you have one anyway, log it honestly.',
      'Edit the list in Me → Diet plan and eating pattern → My eating pattern. A rule you set yourself is the only kind that holds.',
      'Nothing is banned. The point is fewer times, not never.',
    ],
  },
  {
    id: 'cheat',
    icon: 'pizza-outline',
    title: 'The cheat meal',
    lines: [
      'One meal a week, not a day. Pick it in advance, enjoy it fully, log it.',
      'Eat normally before and after. No skipping lunch to make room, no fasting the next day.',
      'If the scale is up the next morning, that is salt and water. It settles in two days.',
      'Better: make the cheat meal the one social meal of the week, so it never feels like a loss.',
    ],
  },
  {
    id: 'water',
    icon: 'water-outline',
    title: 'Water',
    lines: [
      'Three litres a day, spread out. A bottle with every break and every meal gets you most of the way.',
      'Each tap on the Water tile on Today adds one bottle, and its line says how many are left. Hold it to change the bottle size or add another amount.',
      'Hunger at 11 or 4 is often thirst. Drink a glass, wait ten minutes, then decide.',
    ],
  },
  {
    id: 'office',
    icon: 'cafe-outline',
    title: 'The office day',
    lines: [
      'With Eye-care breaks switched on in Settings → Features, the app asks you to look away from the screen every 20 minutes and to stand up and move every hour. When a break comes, follow the prompt on the screen.',
      'Lunch at the table, not the desk. Log it before you go back.',
      'Change the times in Settings → Office day whenever your shift changes.',
    ],
  },
  {
    id: 'sleep',
    icon: 'moon-outline',
    title: 'Sleep',
    lines: [
      'Seven hours, same bedtime within half an hour. The morning check-in takes twenty seconds.',
      'Short sleep makes the next day hungrier. After a bad night, Move (in Me → Body) makes the day easier on its own.',
      'Dinner before nine and no screen in bed are the two changes that move the sleep score most.',
    ],
  },
  {
    id: 'move',
    icon: 'walk-outline',
    title: 'Movement',
    lines: [
      'The morning walk is the base. Twenty to thirty minutes, every day, the same time.',
      'Move, in Me → Body, gives a short joint-safe session sized to how you slept. Red days are stretching and breathing, never nothing.',
      'Miss three days and the plan gets easier, not louder. Start again from wherever it says.',
    ],
  },
  {
    id: 'numbers',
    icon: 'analytics-outline',
    title: 'Reading your numbers',
    lines: [
      'Calories left, the big number at the top of Today, is what you can still eat today. Once the day is over its target, it says by how much.',
      'Tap the weight card on Progress for what you have lost, what is left to go, and whether the plan is working, in plain words, with one change to make when it is not. Progress shows the smoothed line.',
      'The target is never below a safe floor. If the app raised it, that is on purpose.',
      'Protein matters as much as calories: it keeps muscle while fat goes. Dal, curd, eggs, paneer, chana.',
    ],
  },
  {
    id: 'backup',
    icon: 'cloud-upload-outline',
    title: 'Keeping your data safe',
    lines: [
      "Your logs live on this device and, with sync on, in one file in the app maker's Google Drive. Only you and the app maker can open it.",
      'Where it is set up, Settings → Back up now keeps a copy in your own Google Drive. Back up weekly, after the weigh-in.',
      'Settings → Export data gives you the same file to keep anywhere; on the web, Import data brings it onto another device.',
    ],
  },
  {
    id: 'homescreen',
    icon: 'phone-portrait-outline',
    title: 'Add to Home Screen',
    lines: [
      'An iPhone or iPad shows reminders only when the app is opened from the Home Screen, on iOS 16.4 or newer.',
      'Open the app in Safari, tap Share, then Add to Home Screen, then Add.',
      'Open Dhyey from its new icon, tap Turn on reminders at the top of Today, then tap Allow.',
      'To check, tap Send a test (close the app first) in Settings → Reminders, then go to the Home Screen; it arrives within a minute.',
    ],
  },
  {
    id: 'notifications',
    icon: 'notifications-off-outline',
    title: 'Allow notifications',
    lines: [
      "On an iPhone or iPad: open the phone's Settings → Notifications → Dhyey, and switch on Allow Notifications.",
      "On Android: open the phone's Settings → Apps → Dhyey → Notifications, and switch them on.",
      'In a browser on a computer: click the icon left of the address, and set Notifications to Allow.',
      'Then come back to the app. If Turn on reminders shows at the top of Today, tap it.',
    ],
  },
];

const mr: GuideSection[] = [
  {
    id: 'weigh',
    icon: 'scale-outline',
    title: 'वजन कसे तपासावे',
    lines: [
      'आठवड्यातून एकदा, त्याच दिवशी, त्याच काट्यावर. रविवार सकाळ चांगली.',
      'सकाळी, शौचानंतर, खाण्या-पिण्याआधी, हलके कपडे.',
      'प्रगती पानावरच्या वजनाच्या कार्डवर, किंवा मी → मांडणी मधून आजच्या पानावर घेतली असेल तर तिथल्या वजनाच्या चौकटीवर, दाबा आणि आकडा लिहा. वजनाचं पान किती बदललं आणि नियोजन चालतंय का ते दाखवतं.',
      'रोजचे 1–2 किलोचे चढउतार म्हणजे पाणी आणि पोटातले अन्न, चरबी नाही. फक्त आठवड्याची रेषा महत्त्वाची.',
      'तीन आठवडे आकडा हलला नाही तर नियोजन बदलण्याआधी एक आठवडा नोंद काटेकोर करा.',
    ],
  },
  {
    id: 'log',
    icon: 'restaurant-outline',
    title: 'जेवण कसे नोंदवावे',
    lines: [
      'सगळे नोंदवा, चहा, बिस्किट आणि शिजवताना घेतलेली चवसुद्धा. अर्धवट नोंदवलेले दिवस खरे असतात त्यापेक्षा चांगले दिसतात.',
      'आजच्या मेन्यूत तुमच्या खाण्याच्या पद्धतीतलं प्रत्येक जेवण आहे. लिहिल्याप्रमाणे खाल्लं? "ठरवल्याप्रमाणे खाल्लं" दाबा. बाकी काहीही असेल तर ➕ दाबा आणि नावाने शोधा, फोटो काढा किंवा बारकोड वाचा.',
      'प्रमाण तपासा. एक वाटी 150 ग्रॅ; एक चपाती 40 ग्रॅ. तुमची मोठी असेल तर संख्या बदला.',
      'एखादा दिवस राहिला? आजच्या पानाच्या वरच्या आठवड्याच्या पट्टीत तो दिवस दाबा आणि भरा. उशिरा पण खरी नोंद रिकाम्यापेक्षा बरी.',
    ],
  },
  {
    id: 'avoid',
    icon: 'ban-outline',
    title: 'काय टाळावे, त्याऐवजी काय',
    lines: [
      'तुमची टाळायची यादी: दूध-साखरेचा चहा (त्याऐवजी कोरा चहा), काजू (बदाम-अक्रोड), शेव, नमकीन, बिस्किटे आणि भजी (भाजलेले चणे किंवा साधी भेळ).',
      'अ‍ॅप सुचवत असलेल्या मेन्यूत यातले काहीच नसते, आणि कोचला ही यादी माहीत असते. तरी खाल्ले तर खरे नोंदवा.',
      'यादी मी → आहार नियोजन आणि खाण्याची पद्धत → माझी खाण्याची पद्धत इथे बदला. स्वतः ठरवलेला नियमच टिकतो.',
      'काहीच बंद नाही. मुद्दा कमी वेळा, कधीच नाही असा नाही.',
    ],
  },
  {
    id: 'cheat',
    icon: 'pizza-outline',
    title: 'चीट मील',
    lines: [
      'आठवड्यातून एक जेवण, एक दिवस नाही. आधी ठरवा, मनापासून खा, नोंदवा.',
      'आधी आणि नंतर नेहमीसारखे खा. जागा करण्यासाठी जेवण टाळू नका, दुसऱ्या दिवशी उपास नको.',
      'दुसऱ्या सकाळी काटा वर असेल तर ते मीठ आणि पाणी. दोन दिवसांत खाली येते.',
      'उत्तम: आठवड्यातले एक माणसांबरोबरचे जेवण हेच चीट मील करा, म्हणजे कधीच काही गमावल्यासारखे वाटत नाही.',
    ],
  },
  {
    id: 'water',
    icon: 'water-outline',
    title: 'पाणी',
    lines: [
      'दिवसाला तीन लिटर, विभागून. प्रत्येक ब्रेकला आणि जेवणाला एक बाटली घेतली की बहुतेक झाले.',
      'आजच्या पानावरच्या पाण्याच्या चौकटीवर प्रत्येक दाबाने एक बाटली नोंदते, आणि खालची ओळ किती बाटल्या बाकी ते सांगते. बाटलीचा आकार बदलायला किंवा दुसरे प्रमाण घालायला दाबून धरा.',
      '11 ला किंवा 4 ला लागलेली भूक बऱ्याचदा तहान असते. एक ग्लास प्या, दहा मिनिटे थांबा, मग ठरवा.',
    ],
  },
  {
    id: 'office',
    icon: 'cafe-outline',
    title: 'ऑफिसचा दिवस',
    lines: [
      'सेटिंग → सुविधा मध्ये डोळ्यांसाठी विश्रांती चालू असेल तर अ‍ॅप दर 20 मिनिटांनी स्क्रीनपासून दूर बघायला आणि दर तासाला उठून हालचाल करायला सांगते. ब्रेक आला की स्क्रीनवर सांगितल्याप्रमाणे करा.',
      'जेवण टेबलावर, डेस्कवर नाही. परत जाण्याआधी नोंदवा.',
      'शिफ्ट बदलली की सेटिंग → ऑफिसचा दिवस इथे वेळा बदला.',
    ],
  },
  {
    id: 'sleep',
    icon: 'moon-outline',
    title: 'झोप',
    lines: [
      'सात तास, झोपण्याची वेळ अर्ध्या तासाच्या आत तीच. सकाळची नोंद वीस सेकंदांची.',
      'कमी झोप दुसऱ्या दिवशी भूक वाढवते. वाईट रात्रीनंतर हालचाल (मी → शरीर) दिवस आपोआप सोपा करते.',
      'नऊच्या आत जेवण आणि अंथरुणात स्क्रीन नाही, या दोन गोष्टी झोपेचे गुण सगळ्यात जास्त बदलतात.',
    ],
  },
  {
    id: 'move',
    icon: 'walk-outline',
    title: 'हालचाल',
    lines: [
      'सकाळचा फेरफटका हा पाया. वीस ते तीस मिनिटे, रोज, त्याच वेळी.',
      'मी → शरीर मधली हालचाल झोपेनुसार लहान, सांध्यांना सुरक्षित सराव देते. लाल दिवस म्हणजे ताणणे आणि श्वास, कधीच काहीच नाही असे नाही.',
      'तीन दिवस चुकले की नियोजन सोपे होते, कठोर नाही. जिथे सांगते तिथून पुन्हा सुरू करा.',
    ],
  },
  {
    id: 'numbers',
    icon: 'analytics-outline',
    title: 'आकडे कसे वाचावे',
    lines: [
      'आजच्या पानाच्या वरचा मोठा आकडा, उरलेल्या कॅलरी, म्हणजे आज अजून किती खाता येईल. दिवसाचे लक्ष्य ओलांडले की किती जास्त झाले ते सांगतो.',
      'प्रगती पानावरच्या वजनाच्या कार्डवर दाबा: किती कमी झाले, किती बाकी, आणि नियोजन चालतंय का ते साध्या शब्दांत, नसेल तर एक बदल सुचवून. प्रगती पान सरासरी रेषा दाखवते.',
      'लक्ष्य कधीच सुरक्षित किमानाखाली जात नाही. अ‍ॅपने ते वाढवले असेल तर ते मुद्दाम.',
      'प्रथिने कॅलरीइतकीच महत्त्वाची: चरबी जाताना स्नायू टिकवतात. डाळ, दही, अंडी, पनीर, चणे.',
    ],
  },
  {
    id: 'backup',
    icon: 'cloud-upload-outline',
    title: 'डेटा सुरक्षित ठेवणे',
    lines: [
      'तुमच्या नोंदी या डिव्हाइसवर राहतात, आणि सिंक चालू असेल तर अ‍ॅप बनवणाऱ्याच्या गूगल ड्राइव्हमधल्या एका फाइलमध्ये. ती फक्त तुम्ही आणि अ‍ॅप बनवणारा उघडू शकता.',
      'जिथे सोय केलेली असेल तिथे सेटिंग → आता बॅकअप घ्या तुमच्या स्वतःच्या गूगल ड्राइव्हमध्ये एक प्रत ठेवते. दर आठवड्याला, वजनानंतर बॅकअप घ्या.',
      'सेटिंग → डेटा बाहेर काढा हीच फाइल कुठेही ठेवायला देते; वेबवर डेटा आत घ्या ती दुसऱ्या डिव्हाइसवर आणते.',
    ],
  },
  {
    id: 'homescreen',
    icon: 'phone-portrait-outline',
    title: 'होम स्क्रीनवर जोडा',
    lines: [
      'आयफोन किंवा आयपॅडवर आठवणी अ‍ॅप होम स्क्रीनवरून उघडलं तरच येतात, आयओएस 16.4 किंवा नवीन असेल तर.',
      'सफारीमध्ये अ‍ॅप उघडा, शेअर दाबा, मग "अ‍ॅड टू होम स्क्रीन", मग "अ‍ॅड".',
      'नव्या आयकॉनवरून ध्येय उघडा, आजच्या पानावर वरती "आठवणी चालू करा" दाबा, मग परवानगी द्या.',
      'तपासायचं असेल तर सेटिंग → आठवणी इथे "चाचणी पाठवा (आधी अ‍ॅप बंद करा)" दाबा, मग होम स्क्रीनवर जा; एका मिनिटात सूचना येईल.',
    ],
  },
  {
    id: 'notifications',
    icon: 'notifications-off-outline',
    title: 'सूचनांना परवानगी',
    lines: [
      'आयफोन किंवा आयपॅडवर: फोनची सेटिंग्ज → नोटिफिकेशन्स → ध्येय उघडा, आणि "अलाऊ नोटिफिकेशन्स" चालू करा.',
      'अँड्रॉइडवर: फोनची सेटिंग्ज → अ‍ॅप्स → ध्येय → नोटिफिकेशन्स उघडा, आणि त्या चालू करा.',
      'संगणकावरच्या ब्राउझरमध्ये: पत्त्याच्या डावीकडचा आयकॉन दाबा, आणि सूचनांना परवानगी द्या.',
      'मग अ‍ॅपवर परत या. आजच्या पानावर वरती "आठवणी चालू करा" दिसलं तर ते दाबा.',
    ],
  },
];

const hi: GuideSection[] = [
  {
    id: 'weigh',
    icon: 'scale-outline',
    title: 'वज़न कैसे जाँचें',
    lines: [
      'हफ़्ते में एक बार, उसी दिन, उसी तराज़ू पर. रविवार सुबह ठीक रहती है.',
      'सुबह, शौच के बाद, खाने-पीने से पहले, हल्के कपड़े.',
      'प्रगति पन्ने पर वज़न वाले कार्ड को, या मैं → अपनी पसंद से आज वाले पन्ने पर लिया हो तो वहाँ वज़न वाले खाने को, दबाएँ और अंक लिखें. वज़न का पन्ना बताता है कितना बदला और प्लान काम कर रहा है या नहीं.',
      'रोज़ के 1–2 किलो के उतार-चढ़ाव पानी और पेट का खाना हैं, चर्बी नहीं. सिर्फ़ हफ़्ते की रेखा मायने रखती है.',
      'तीन हफ़्ते आँकड़ा न हिले तो योजना बदलने से पहले एक हफ़्ता दर्ज करना कड़ा करें.',
    ],
  },
  {
    id: 'log',
    icon: 'restaurant-outline',
    title: 'खाना कैसे दर्ज करें',
    lines: [
      'सब दर्ज करें, चाय, बिस्कुट और पकाते समय चखा हुआ भी. आधे दर्ज दिन जितने थे उससे बेहतर दिखते हैं.',
      'आज के मेन्यू में आपके खाने के पैटर्न का हर खाना है. जैसा लिखा है वैसा खाया? "प्लान के मुताबिक़ खाया" दबाएँ. बाकी कुछ भी हो तो ➕ दबाएँ और नाम से खोजें, फ़ोटो लें या बारकोड पढ़ें.',
      'मात्रा जाँचें. एक कटोरी 150 ग्राम; एक रोटी 40 ग्राम. आपकी बड़ी हो तो संख्या बदलें.',
      'कोई दिन छूट गया? आज वाले पन्ने के ऊपर की हफ़्ते की पट्टी में वह दिन दबाएँ और भरें. देर से पर सच्ची प्रविष्टि खाली से बेहतर है.',
    ],
  },
  {
    id: 'avoid',
    icon: 'ban-outline',
    title: 'क्या टालें, उसके बजाय क्या',
    lines: [
      'आपकी परहेज़ सूची: दूध-चीनी वाली चाय (उसके बजाय काली चाय), काजू (बादाम-अखरोट), सेव, नमकीन, बिस्कुट और पकौड़े (भुने चने या सादी भेल).',
      'ऐप जो मेन्यू सुझाता है उसमें इनमें से कुछ नहीं होता, और कोच को यह सूची पता है. फिर भी खा लिया तो सच दर्ज करें.',
      'सूची मैं → डाइट प्लान और खाने का पैटर्न → मेरा खाने का पैटर्न में बदलें. ख़ुद का बनाया नियम ही टिकता है.',
      'कुछ भी मना नहीं. बात कम बार की है, कभी नहीं की नहीं.',
    ],
  },
  {
    id: 'cheat',
    icon: 'pizza-outline',
    title: 'चीट मील',
    lines: [
      'हफ़्ते में एक खाना, एक दिन नहीं. पहले से तय करें, जी भरकर खाएँ, दर्ज करें.',
      'पहले और बाद में सामान्य खाएँ. जगह बनाने के लिए लंच न छोड़ें, अगले दिन उपवास नहीं.',
      'अगली सुबह तराज़ू ऊपर हो तो वह नमक और पानी है. दो दिन में बैठ जाता है.',
      'बेहतर: हफ़्ते का एक लोगों के साथ का खाना ही चीट मील बनाएँ, ताकि कभी कुछ खोने जैसा न लगे.',
    ],
  },
  {
    id: 'water',
    icon: 'water-outline',
    title: 'पानी',
    lines: [
      'दिन में तीन लीटर, बाँटकर. हर ब्रेक और हर खाने पर एक बोतल से ज़्यादातर हो जाता है.',
      'आज वाले पन्ने पर पानी वाले खाने को हर बार दबाने से एक बोतल जुड़ती है, और नीचे की पंक्ति बताती है कितनी बोतलें बाकी हैं. बोतल का आकार बदलने या दूसरी मात्रा जोड़ने के लिए दबाकर रखें.',
      '11 या 4 बजे की भूख अक्सर प्यास होती है. एक गिलास पिएँ, दस मिनट रुकें, फिर तय करें.',
    ],
  },
  {
    id: 'office',
    icon: 'cafe-outline',
    title: 'ऑफिस का दिन',
    lines: [
      'सेटिंग → सुविधाएँ में आँखों के लिए विराम चालू हो तो ऐप हर 20 मिनट पर स्क्रीन से दूर देखने और हर घंटे उठकर चलने को कहता है. ब्रेक आए तो स्क्रीन पर जो कहा जाए, वही करें.',
      'लंच मेज़ पर, डेस्क पर नहीं. लौटने से पहले दर्ज करें.',
      'शिफ़्ट बदले तो सेटिंग → ऑफिस का दिन में समय बदलें.',
    ],
  },
  {
    id: 'sleep',
    icon: 'moon-outline',
    title: 'नींद',
    lines: [
      'सात घंटे, सोने का समय आधे घंटे के भीतर वही. सुबह की जाँच बीस सेकंड की.',
      'कम नींद अगले दिन भूख बढ़ाती है. बुरी रात के बाद हलचल (मैं → शरीर) दिन अपने आप आसान कर देता है.',
      'नौ से पहले खाना और बिस्तर में स्क्रीन नहीं, ये दो बदलाव नींद का स्कोर सबसे ज़्यादा बदलते हैं.',
    ],
  },
  {
    id: 'move',
    icon: 'walk-outline',
    title: 'हलचल',
    lines: [
      'सुबह की सैर आधार है. बीस से तीस मिनट, रोज़, उसी समय.',
      'मैं → शरीर में हलचल नींद के हिसाब से छोटा, जोड़ों के लिए सुरक्षित सत्र देता है. लाल दिन खिंचाव और साँस हैं, कभी कुछ नहीं नहीं.',
      'तीन दिन छूटें तो योजना आसान होती है, सख़्त नहीं. जहाँ कहे वहीं से फिर शुरू करें.',
    ],
  },
  {
    id: 'numbers',
    icon: 'analytics-outline',
    title: 'अपने आँकड़े पढ़ना',
    lines: [
      'आज वाले पन्ने के ऊपर का बड़ा अंक, बची कैलोरी, बताता है कि आज और कितना खा सकते हैं. दिन का लक्ष्य पार होने पर बताता है कितना ज़्यादा हुआ.',
      'प्रगति पन्ने पर वज़न वाले कार्ड को दबाएँ: कितना घटा, कितना बाकी, और प्लान काम कर रहा है या नहीं, सीधे शब्दों में, न हो तो एक बदलाव के साथ. प्रगति पन्ना औसत रेखा दिखाता है.',
      'लक्ष्य कभी सुरक्षित न्यूनतम से नीचे नहीं जाता. ऐप ने बढ़ाया हो तो जानबूझकर.',
      'प्रोटीन कैलोरी जितना ही ज़रूरी: चर्बी जाते समय मांसपेशी बचाता है. दाल, दही, अंडे, पनीर, चना.',
    ],
  },
  {
    id: 'backup',
    icon: 'cloud-upload-outline',
    title: 'डेटा सुरक्षित रखना',
    lines: [
      'आपकी प्रविष्टियाँ इसी डिवाइस पर रहती हैं, और सिंक चालू हो तो ऐप बनाने वाले की गूगल ड्राइव में एक फ़ाइल में. उसे सिर्फ़ आप और ऐप बनाने वाला खोल सकते हैं.',
      'जहाँ इसकी व्यवस्था हो, वहाँ सेटिंग → अभी बैकअप लें आपकी अपनी गूगल ड्राइव में एक प्रति रखता है. हर हफ़्ते, वज़न के बाद बैकअप लें.',
      'सेटिंग → डेटा निर्यात वही फ़ाइल कहीं भी रखने देता है; वेब पर डेटा आयात करें उसे दूसरे डिवाइस पर लाता है.',
    ],
  },
  {
    id: 'homescreen',
    icon: 'phone-portrait-outline',
    title: 'होम स्क्रीन पर जोड़ें',
    lines: [
      'आईफ़ोन या आईपैड पर याद दिलाना तभी आता है जब ऐप होम स्क्रीन से खोला जाए, आईओएस 16.4 या नए पर.',
      'सफ़ारी में ऐप खोलें, शेयर दबाएँ, फिर "ऐड टू होम स्क्रीन", फिर "ऐड".',
      'नए आइकॉन से ध्येय खोलें, आज के पन्ने पर ऊपर "याद दिलाना चालू करें" दबाएँ, फिर अनुमति दें.',
      'जाँचने के लिए सेटिंग → याद दिलाना में "परीक्षण भेजें (पहले ऐप बंद करें)" दबाएँ, फिर होम स्क्रीन पर जाएँ; एक मिनट में सूचना आएगी.',
    ],
  },
  {
    id: 'notifications',
    icon: 'notifications-off-outline',
    title: 'सूचनाओं की अनुमति',
    lines: [
      'आईफ़ोन या आईपैड पर: फ़ोन की सेटिंग्स → नोटिफ़िकेशन्स → ध्येय खोलें, और "अलाउ नोटिफ़िकेशन्स" चालू करें.',
      'एंड्रॉयड पर: फ़ोन की सेटिंग्स → ऐप्स → ध्येय → नोटिफ़िकेशन्स खोलें, और उन्हें चालू करें.',
      'कंप्यूटर के ब्राउज़र में: पते के बाईं ओर का आइकॉन दबाएँ, और सूचनाओं की अनुमति दें.',
      'फिर ऐप पर लौटें. आज के पन्ने पर ऊपर "याद दिलाना चालू करें" दिखे तो उसे दबाएँ.',
    ],
  },
];

export const GUIDE: Record<Lang, GuideSection[]> = { en, mr, hi };
