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
      'Log it on the Log screen (+) in the Weight box. The plan card reads it from there.',
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
      'Your routine meals log in one tap from the Today screen. For anything else, search by name or take a photo.',
      'Check the portion. A katori is 150 g; a chapati 40 g. Change the quantity if yours is bigger.',
      'Missed a day? Pick the day on the Log screen and add it. An honest late entry beats a blank.',
    ],
  },
  {
    id: 'avoid',
    icon: 'ban-outline',
    title: 'What to avoid, and what to have instead',
    lines: [
      'Your avoid list: milk tea with sugar (black tea instead), cashews (badam and akrod instead), shev, namkeen, biscuits and fried bhaji (roasted chana or plain bhel instead).',
      'When you log one of these, the app says so and offers the swap. Take it when you can, and log it honestly when you cannot.',
      'Edit the list on the routine screen. A rule you set yourself is the only kind that holds.',
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
      'Three litres a day, spread out. One glass with every break and every meal gets you most of the way.',
      'The ring on Today shows where you should be by this hour, not just the total.',
      'Hunger at 11 or 4 is often thirst. Drink a glass, wait ten minutes, then decide.',
    ],
  },
  {
    id: 'office',
    icon: 'cafe-outline',
    title: 'The office day',
    lines: [
      'At each break the app asks for three things: a glass of water, two minutes on your feet, five minutes with your eyes off the screen.',
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
      'Short sleep makes the next day hungrier. On a bad night the Move tab makes the day easier on its own.',
      'Dinner before nine and no screen in bed are the two changes that move the sleep score most.',
    ],
  },
  {
    id: 'move',
    icon: 'walk-outline',
    title: 'Movement',
    lines: [
      'The morning walk is the base. Twenty to thirty minutes, every day, the same time.',
      'The Move tab gives a short joint-safe session sized to how you slept. Red days are stretching and breathing, never nothing.',
      'Miss three days and the plan gets easier, not louder. Start again from wherever it says.',
    ],
  },
  {
    id: 'numbers',
    icon: 'analytics-outline',
    title: 'Reading your numbers',
    lines: [
      'The big number on Today is calories left for the day. Green or blue is fine; red means over.',
      'The plan card shows kg lost since your first weigh-in, kg to go, and two dates: at the planned rate, and at your real pace.',
      'The target is never below a safe floor. If the app raised it, that is on purpose.',
      'Protein matters as much as calories: it keeps muscle while fat goes. Dal, curd, eggs, paneer, chana.',
    ],
  },
  {
    id: 'backup',
    icon: 'cloud-upload-outline',
    title: 'Keeping your data safe',
    lines: [
      'Everything lives on this device. Nothing is uploaded unless you choose to.',
      'Settings → Google Drive backup keeps one file in your own Drive. Back up weekly, after the weigh-in.',
      'Settings → Export gives you the same file to keep anywhere; Import brings it onto another device.',
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
      'नोंद (+) पानावर वजन या चौकटीत लिहा. नियोजन कार्ड तिथूनच वाचते.',
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
      'दिनक्रमातली जेवणे आजच्या पानावरून एका टॅपमध्ये. बाकी काहीही नावाने शोधा किंवा फोटो काढा.',
      'प्रमाण तपासा. एक वाटी 150 ग्रॅ; एक चपाती 40 ग्रॅ. तुमची मोठी असेल तर संख्या बदला.',
      'एखादा दिवस राहिला? नोंद पानावर तो दिवस निवडून भरा. उशिरा पण खरी नोंद रिकाम्यापेक्षा बरी.',
    ],
  },
  {
    id: 'avoid',
    icon: 'ban-outline',
    title: 'काय टाळावे, त्याऐवजी काय',
    lines: [
      'तुमची टाळायची यादी: दूध-साखरेचा चहा (त्याऐवजी कोरा चहा), काजू (बदाम-अक्रोड), शेव, नमकीन, बिस्किटे आणि भजी (भाजलेले चणे किंवा साधी भेळ).',
      'यातले काही नोंदवले की अ‍ॅप सांगते आणि पर्याय देते. जमेल तेव्हा पर्याय घ्या, नाही जमले तर खरे नोंदवा.',
      'यादी दिनक्रम पानावर बदला. स्वतः ठरवलेला नियमच टिकतो.',
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
      'दिवसाला तीन लिटर, विभागून. प्रत्येक ब्रेकला आणि जेवणाला एक ग्लास घेतला की बहुतेक झाले.',
      'आजच्या पानावरचा पट्टा या वेळेपर्यंत किती हवे ते दाखवतो, फक्त एकूण नाही.',
      '11 ला किंवा 4 ला लागलेली भूक बऱ्याचदा तहान असते. एक ग्लास प्या, दहा मिनिटे थांबा, मग ठरवा.',
    ],
  },
  {
    id: 'office',
    icon: 'cafe-outline',
    title: 'ऑफिसचा दिवस',
    lines: [
      'प्रत्येक ब्रेकला अ‍ॅप तीन गोष्टी विचारते: एक ग्लास पाणी, दोन मिनिटे उभे राहून चालणे, पाच मिनिटे डोळे स्क्रीनपासून दूर.',
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
      'कमी झोप दुसऱ्या दिवशी भूक वाढवते. वाईट रात्रीनंतर हालचाल पान दिवस आपोआप सोपा करते.',
      'नऊच्या आत जेवण आणि अंथरुणात स्क्रीन नाही, या दोन गोष्टी झोपेचे गुण सगळ्यात जास्त बदलतात.',
    ],
  },
  {
    id: 'move',
    icon: 'walk-outline',
    title: 'हालचाल',
    lines: [
      'सकाळचा फेरफटका हा पाया. वीस ते तीस मिनिटे, रोज, त्याच वेळी.',
      'हालचाल पान झोपेनुसार लहान, सांध्यांना सुरक्षित सराव देते. लाल दिवस म्हणजे ताणणे आणि श्वास, कधीच काहीच नाही असे नाही.',
      'तीन दिवस चुकले की नियोजन सोपे होते, कठोर नाही. जिथे सांगते तिथून पुन्हा सुरू करा.',
    ],
  },
  {
    id: 'numbers',
    icon: 'analytics-outline',
    title: 'आकडे कसे वाचावे',
    lines: [
      'आजच्या पानावरचा मोठा आकडा म्हणजे दिवसाच्या उरलेल्या कॅलरी. निळा ठीक; लाल म्हणजे जास्त झाले.',
      'नियोजन कार्ड पहिल्या वजनापासून किती कमी झाले, किती बाकी, आणि दोन तारखा दाखवते: ठरलेल्या वेगाने आणि तुमच्या खऱ्या वेगाने.',
      'लक्ष्य कधीच सुरक्षित किमानाखाली जात नाही. अ‍ॅपने ते वाढवले असेल तर ते मुद्दाम.',
      'प्रथिने कॅलरीइतकीच महत्त्वाची: चरबी जाताना स्नायू टिकवतात. डाळ, दही, अंडी, पनीर, चणे.',
    ],
  },
  {
    id: 'backup',
    icon: 'cloud-upload-outline',
    title: 'डेटा सुरक्षित ठेवणे',
    lines: [
      'सगळे याच डिव्हाइसवर राहते. तुम्ही ठरवल्याशिवाय काहीही अपलोड होत नाही.',
      'सेटिंग → Google Drive बॅकअप तुमच्या Drive मध्ये एक फाइल ठेवते. दर आठवड्याला, वजनानंतर बॅकअप घ्या.',
      'सेटिंग → डेटा बाहेर काढा हीच फाइल कुठेही ठेवायला देते; आत घ्या ती दुसऱ्या डिव्हाइसवर आणते.',
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
      'दर्ज (+) पेज पर वज़न वाले खाने में लिखें. योजना कार्ड वहीं से पढ़ता है.',
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
      'दिनचर्या का खाना आज के पेज से एक टैप में. बाकी कुछ भी नाम से खोजें या फ़ोटो लें.',
      'मात्रा जाँचें. एक कटोरी 150 ग्राम; एक रोटी 40 ग्राम. आपकी बड़ी हो तो संख्या बदलें.',
      'कोई दिन छूट गया? दर्ज पेज पर वह दिन चुनकर भरें. देर से पर सच्ची प्रविष्टि खाली से बेहतर है.',
    ],
  },
  {
    id: 'avoid',
    icon: 'ban-outline',
    title: 'क्या टालें, उसके बजाय क्या',
    lines: [
      'आपकी परहेज़ सूची: दूध-चीनी वाली चाय (उसके बजाय काली चाय), काजू (बादाम-अखरोट), सेव, नमकीन, बिस्कुट और पकौड़े (भुने चने या सादी भेल).',
      'इनमें से कुछ दर्ज करने पर ऐप बताता है और विकल्प देता है. जब हो सके विकल्प लें, न हो सके तो सच दर्ज करें.',
      'सूची दिनचर्या पेज पर बदलें. ख़ुद का बनाया नियम ही टिकता है.',
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
      'दिन में तीन लीटर, बाँटकर. हर ब्रेक और हर खाने पर एक गिलास से ज़्यादातर हो जाता है.',
      'आज के पेज की पट्टी बताती है कि इस समय तक कितना होना चाहिए, सिर्फ़ कुल नहीं.',
      '11 या 4 बजे की भूख अक्सर प्यास होती है. एक गिलास पिएँ, दस मिनट रुकें, फिर तय करें.',
    ],
  },
  {
    id: 'office',
    icon: 'cafe-outline',
    title: 'ऑफिस का दिन',
    lines: [
      'हर ब्रेक पर ऐप तीन चीज़ें पूछता है: एक गिलास पानी, दो मिनट खड़े होकर चलना, पाँच मिनट आँखें स्क्रीन से दूर.',
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
      'कम नींद अगले दिन भूख बढ़ाती है. बुरी रात के बाद हलचल टैब दिन अपने आप आसान कर देता है.',
      'नौ से पहले खाना और बिस्तर में स्क्रीन नहीं, ये दो बदलाव नींद का स्कोर सबसे ज़्यादा बदलते हैं.',
    ],
  },
  {
    id: 'move',
    icon: 'walk-outline',
    title: 'हलचल',
    lines: [
      'सुबह की सैर आधार है. बीस से तीस मिनट, रोज़, उसी समय.',
      'हलचल टैब नींद के हिसाब से छोटा, जोड़ों के लिए सुरक्षित सत्र देता है. लाल दिन खिंचाव और साँस हैं, कभी कुछ नहीं नहीं.',
      'तीन दिन छूटें तो योजना आसान होती है, सख़्त नहीं. जहाँ कहे वहीं से फिर शुरू करें.',
    ],
  },
  {
    id: 'numbers',
    icon: 'analytics-outline',
    title: 'अपने आँकड़े पढ़ना',
    lines: [
      'आज के पेज का बड़ा अंक दिन की बची कैलोरी है. नीला ठीक; लाल मतलब ज़्यादा हो गया.',
      'योजना कार्ड पहले वज़न से कितना घटा, कितना बाकी, और दो तारीख़ें दिखाता है: तय रफ़्तार से और आपकी असली रफ़्तार से.',
      'लक्ष्य कभी सुरक्षित न्यूनतम से नीचे नहीं जाता. ऐप ने बढ़ाया हो तो जानबूझकर.',
      'प्रोटीन कैलोरी जितना ही ज़रूरी: चर्बी जाते समय मांसपेशी बचाता है. दाल, दही, अंडे, पनीर, चना.',
    ],
  },
  {
    id: 'backup',
    icon: 'cloud-upload-outline',
    title: 'डेटा सुरक्षित रखना',
    lines: [
      'सब कुछ इसी डिवाइस पर रहता है. आपके चुने बिना कुछ अपलोड नहीं होता.',
      'सेटिंग → Google Drive बैकअप आपके Drive में एक फ़ाइल रखता है. हर हफ़्ते, वज़न के बाद बैकअप लें.',
      'सेटिंग → डेटा निर्यात वही फ़ाइल कहीं भी रखने देता है; आयात उसे दूसरे डिवाइस पर लाता है.',
    ],
  },
];

export const GUIDE: Record<Lang, GuideSection[]> = { en, mr, hi };
