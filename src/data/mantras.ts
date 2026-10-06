import type { Lang } from '../core/types';

/**
 * One line a day, each standing on a well-replicated finding rather than a
 * slogan. `why` is the finding in plain words, shown on request. Tags let the
 * day's pick match the person's situation: stage of the journey, what slipped
 * yesterday, whether it is an office day.
 */
export type Mantra = { id: string; tags: string[]; text: string; why: string };

const en: Mantra[] = [
  { id: 'sleep-hunger', tags: ['sleep', 'any'], text: 'Sleep is the quietest part of weight loss. Tonight, bed half an hour earlier.', why: 'Short sleep raises ghrelin and lowers leptin, the hunger and fullness hormones; people eat around 300 kcal more the next day in controlled studies.' },
  { id: 'protein-first', tags: ['protein', 'any'], text: 'Eat the dal, curd or paneer first. The rest of the plate follows calmer.', why: 'Protein is the most filling nutrient per calorie and protects muscle during a deficit; 1.2 to 1.6 g per kg of body weight is the range most trials support.' },
  { id: 'walk-after', tags: ['walk', 'any', 'office'], text: 'Ten minutes of walking after a meal does more than an hour of regret.', why: 'A short walk after eating lowers the blood-sugar spike by roughly a fifth, which blunts the crash and the next craving.' },
  { id: 'water-hunger', tags: ['water', 'any'], text: 'Thirst wears the mask of hunger. One glass, ten minutes, then decide.', why: 'Mild dehydration is often read as hunger; drinking 500 ml before a meal reduced intake and improved weight loss in randomised trials of adults.' },
  { id: 'weekly-scale', tags: ['start', 'early', 'any'], text: 'The scale is a weekly letter, not a daily text. Read it on Sunday.', why: 'Day-to-day weight swings 1 to 2 kg from water, salt and gut contents; weekly averages track fat change far better than single readings.' },
  { id: 'logging', tags: ['start', 'any'], text: 'What gets written down gets smaller. Log the biscuit too.', why: 'Consistent self-monitoring is the single strongest predictor of weight loss in behavioural programmes, more than any particular diet.' },
  { id: 'deficit-small', tags: ['early', 'halfway', 'any'], text: 'A small deficit you can keep beats a big one you cannot.', why: 'Larger deficits increase hunger and muscle loss and are abandoned more often; 0.5 kg a week preserves lean mass and adherence.' },
  { id: 'fibre', tags: ['any'], text: 'Bhaji before bhakri. Fibre fills the space sugar wants.', why: 'Meals higher in fibre and vegetables slow gastric emptying and reduce total energy intake without counting anything.' },
  { id: 'plateau', tags: ['plateau', 'halfway', 'close'], text: 'A plateau is the body catching up, not the plan failing. Hold the line two more weeks.', why: 'Water retention and adaptive changes commonly stall the scale for 2 to 3 weeks while fat loss continues; most plateaus break without changing anything.' },
  { id: 'cheat-meal', tags: ['cheat', 'any'], text: 'One planned meal off the plan is a tool. A whole day off is a reset button.', why: 'Planned flexibility improves long-term adherence; unplanned overeating episodes are what predict regain.' },
  { id: 'sitting', tags: ['office', 'any'], text: 'Every hour, two minutes on your feet. Your back and your blood sugar both notice.', why: 'Breaking sitting every 30 to 60 minutes with light activity lowers post-meal glucose and insulin compared with sitting still.' },
  { id: 'slipping', tags: ['slipping'], text: 'A bad week is data. Tomorrow is a new sample.', why: 'Lapses are universal in weight loss; what separates people who regain from those who do not is returning to self-monitoring within days, not perfection.' },
  { id: 'late-dinner', tags: ['evening', 'any'], text: 'Dinner before nine. The same food sits lighter earlier.', why: 'Later eating is linked with higher hunger the next day and lower energy expenditure in controlled crossover studies, independent of calories.' },
  { id: 'steps', tags: ['walk', 'any'], text: 'You do not need 10,000 steps. You need more than yesterday.', why: 'Mortality and metabolic benefits rise steeply up to about 7,000 to 8,000 steps a day; the biggest gains come from leaving the lowest levels.' },
  { id: 'muscle', tags: ['halfway', 'close', 'done'], text: 'Lighter is good. Stronger is what keeps it off.', why: 'Resistance work during weight loss preserves muscle and resting metabolism, the main reason weight stays off after the diet ends.' },
  { id: 'maintain', tags: ['done'], text: 'Keeping weight off is the same habits at a slightly bigger plate.', why: 'Successful maintainers in long-term registries keep logging, weigh weekly, eat breakfast and walk daily; the deficit ends, the routine does not.' },
  { id: 'kitchen', tags: ['any'], text: 'What is not in the room is not eaten. Keep the shev at the shop.', why: 'Food visible and within reach is eaten far more often; environment design outperforms willpower in every study that has compared them.' },
  { id: 'sugar-tea', tags: ['any', 'office'], text: 'Four sugared teas a day is a chapati you never tasted.', why: 'Liquid sugar does not trigger fullness the way solid food does, so its calories add on top of meals rather than replacing them.' },
];

const mr: Mantra[] = [
  { id: 'sleep-hunger', tags: ['sleep', 'any'], text: 'झोप हा वजन कमी करण्यातला सगळ्यात शांत भाग आहे. आज अर्धा तास लवकर झोपा.', why: 'कमी झोपेने भुकेचे हार्मोन (घ्रेलिन) वाढते आणि तृप्तीचे (लेप्टिन) घटते; अभ्यासांत लोक दुसऱ्या दिवशी सुमारे ३०० kcal जास्त खातात.' },
  { id: 'protein-first', tags: ['protein', 'any'], text: 'आधी डाळ, दही किंवा पनीर खा. बाकीचे ताट मग शांतपणे येते.', why: 'प्रथिने प्रति कॅलरी सगळ्यात जास्त पोट भरतात आणि वजन कमी करताना स्नायू टिकवतात; शरीरवजनाच्या किलोमागे १.२ ते १.६ ग्रॅ ही बहुतेक चाचण्यांनी मानलेली मर्यादा.' },
  { id: 'walk-after', tags: ['walk', 'any', 'office'], text: 'जेवणानंतर दहा मिनिटे चालणे तासभराच्या पश्चात्तापापेक्षा जास्त करते.', why: 'जेवणानंतरच्या छोट्या चालण्याने रक्तातील साखरेची उडी साधारण पाचव्या भागाने कमी होते, म्हणून नंतरची गळती आणि भूक कमी.' },
  { id: 'water-hunger', tags: ['water', 'any'], text: 'तहान भुकेचा मुखवटा घालते. एक ग्लास, दहा मिनिटे, मग ठरवा.', why: 'सौम्य निर्जलीकरण अनेकदा भूक म्हणून जाणवते; जेवणाआधी ५०० मिली पाणी प्यायल्याने प्रौढांच्या चाचण्यांत खाणे कमी झाले आणि वजन जास्त घटले.' },
  { id: 'weekly-scale', tags: ['start', 'early', 'any'], text: 'काटा हे आठवड्याचे पत्र आहे, रोजचा मेसेज नाही. रविवारी वाचा.', why: 'पाणी, मीठ आणि पोटातल्या अन्नाने वजन रोज १–२ किलो हलते; एकट्या आकड्यापेक्षा आठवड्याची सरासरी चरबीतला बदल खूप नीट दाखवते.' },
  { id: 'logging', tags: ['start', 'any'], text: 'जे लिहिले जाते ते कमी होते. बिस्किटसुद्धा नोंदवा.', why: 'वर्तन-कार्यक्रमांत सातत्याने नोंद ठेवणे हे वजन घटण्याचे सगळ्यात मोठे एकमेव भाकीत आहे, कोणत्याही विशिष्ट आहारापेक्षा जास्त.' },
  { id: 'deficit-small', tags: ['early', 'halfway', 'any'], text: 'टिकवता येणारी छोटी तूट, न टिकणाऱ्या मोठ्या तुटीपेक्षा चांगली.', why: 'मोठ्या तुटीने भूक आणि स्नायूंची झीज वाढते आणि लोक जास्त वेळा सोडून देतात; आठवड्याला अर्धा किलो स्नायू आणि सातत्य दोन्ही राखतो.' },
  { id: 'fibre', tags: ['any'], text: 'भाकरीआधी भाजी. साखरेला हवी असलेली जागा फायबर भरते.', why: 'जास्त फायबर आणि भाज्यांचे जेवण पोट रिकामे होणे मंदावते आणि काहीही न मोजता एकूण खाणे कमी करते.' },
  { id: 'plateau', tags: ['plateau', 'halfway', 'close'], text: 'वजन थांबले म्हणजे शरीर पकडते आहे, नियोजन चुकले नाही. अजून दोन आठवडे धरून ठेवा.', why: 'पाणी साठणे आणि शरीराचे जुळवून घेणे यामुळे काटा २–३ आठवडे थांबतो, चरबी मात्र जात राहते; बहुतेक थांबे काही न बदलता सुटतात.' },
  { id: 'cheat-meal', tags: ['cheat', 'any'], text: 'ठरवून घेतलेले एक जेवण हे साधन आहे. अख्खा दिवस म्हणजे रीसेट बटण.', why: 'ठरवलेली लवचिकता दीर्घकाळ टिकण्यास मदत करते; अचानक जास्त खाण्याचे प्रसंगच पुन्हा वजन वाढण्याचे भाकीत करतात.' },
  { id: 'sitting', tags: ['office', 'any'], text: 'दर तासाला दोन मिनिटे उभे. पाठ आणि रक्तातली साखर दोन्हींना जाणवते.', why: 'दर ३०–६० मिनिटांनी हलक्या हालचालीने बसणे तोडल्यास जेवणानंतरची ग्लुकोज आणि इन्सुलिन सलग बसण्यापेक्षा कमी राहते.' },
  { id: 'slipping', tags: ['slipping'], text: 'वाईट आठवडा ही माहिती आहे. उद्या नवीन नमुना.', why: 'वजन कमी करताना घसरण सगळ्यांनाच होते; पुन्हा वाढणारे आणि न वाढणारे यांतला फरक परिपूर्णता नाही, तर काही दिवसांत पुन्हा नोंद सुरू करणे.' },
  { id: 'late-dinner', tags: ['evening', 'any'], text: 'नऊच्या आत जेवण. तेच अन्न लवकर खाल्ले की हलके बसते.', why: 'उशिरा खाल्ल्याने नियंत्रित अभ्यासांत दुसऱ्या दिवशी भूक जास्त आणि ऊर्जाखर्च कमी दिसतो, कॅलरी समान असूनही.' },
  { id: 'steps', tags: ['walk', 'any'], text: 'दहा हजार पावले नकोत. कालपेक्षा जास्त हवीत.', why: 'दिवसाला सुमारे ७–८ हजार पावलांपर्यंत फायदे झपाट्याने वाढतात; सगळ्यात मोठा फायदा सगळ्यात कमी पातळीतून बाहेर पडण्याचा.' },
  { id: 'muscle', tags: ['halfway', 'close', 'done'], text: 'हलके होणे चांगले. मजबूत होणे ते टिकवते.', why: 'वजन कमी करताना ताकदीचे व्यायाम स्नायू आणि विश्रांतीतला चयापचय राखतात; आहार संपल्यावर वजन टिकण्याचे हेच मुख्य कारण.' },
  { id: 'maintain', tags: ['done'], text: 'वजन टिकवणे म्हणजे त्याच सवयी, थोड्या मोठ्या ताटात.', why: 'दीर्घकालीन नोंदींत यशस्वी टिकवणारे नोंद ठेवतात, आठवड्याला वजन करतात, नाश्ता करतात आणि रोज चालतात; तूट संपते, दिनक्रम नाही.' },
  { id: 'kitchen', tags: ['any'], text: 'खोलीत नसलेले खाल्ले जात नाही. शेव दुकानातच ठेवा.', why: 'दिसणारे आणि हाताशी असलेले अन्न खूप जास्त वेळा खाल्ले जाते; तुलना केलेल्या प्रत्येक अभ्यासात वातावरणाची रचना इच्छाशक्तीला हरवते.' },
  { id: 'sugar-tea', tags: ['any', 'office'], text: 'दिवसाला चार साखरेचे चहा म्हणजे कधी न चाखलेली एक चपाती.', why: 'द्रव साखर घन अन्नासारखी तृप्ती देत नाही, म्हणून तिच्या कॅलरी जेवणाच्या जागी नव्हे, त्याच्या वर जातात.' },
];

const hi: Mantra[] = [
  { id: 'sleep-hunger', tags: ['sleep', 'any'], text: 'नींद वज़न घटाने का सबसे शांत हिस्सा है. आज आधा घंटा पहले सोएँ.', why: 'कम नींद से भूख का हार्मोन (घ्रेलिन) बढ़ता और तृप्ति का (लेप्टिन) घटता है; अध्ययनों में लोग अगले दिन लगभग 300 kcal ज़्यादा खाते हैं.' },
  { id: 'protein-first', tags: ['protein', 'any'], text: 'पहले दाल, दही या पनीर खाएँ. बाकी थाली फिर शांति से आती है.', why: 'प्रोटीन प्रति कैलोरी सबसे ज़्यादा पेट भरता है और घटते वज़न में मांसपेशी बचाता है; शरीर के किलो पर 1.2 से 1.6 ग्राम की सीमा ज़्यादातर परीक्षणों में समर्थित है.' },
  { id: 'walk-after', tags: ['walk', 'any', 'office'], text: 'खाने के बाद दस मिनट की सैर घंटे भर के पछतावे से ज़्यादा करती है.', why: 'खाने के बाद थोड़ा चलने से रक्त शर्करा की उछाल लगभग पाँचवाँ हिस्सा घटती है, जिससे बाद की गिरावट और तलब कम होती है.' },
  { id: 'water-hunger', tags: ['water', 'any'], text: 'प्यास भूख का मुखौटा पहनती है. एक गिलास, दस मिनट, फिर तय करें.', why: 'हल्की पानी की कमी अक्सर भूख जैसी लगती है; खाने से पहले 500 मिली पानी से वयस्कों के परीक्षणों में खाना कम और वज़न ज़्यादा घटा.' },
  { id: 'weekly-scale', tags: ['start', 'early', 'any'], text: 'तराज़ू हफ़्ते की चिट्ठी है, रोज़ का मैसेज नहीं. रविवार को पढ़ें.', why: 'पानी, नमक और पेट के खाने से वज़न रोज़ 1–2 किलो हिलता है; अकेले अंक से हफ़्ते का औसत चर्बी का बदलाव कहीं बेहतर दिखाता है.' },
  { id: 'logging', tags: ['start', 'any'], text: 'जो लिखा जाता है वह घटता है. बिस्कुट भी दर्ज करें.', why: 'व्यवहार कार्यक्रमों में लगातार दर्ज करना वज़न घटने का सबसे मज़बूत अकेला पूर्वानुमान है, किसी भी ख़ास आहार से ज़्यादा.' },
  { id: 'deficit-small', tags: ['early', 'halfway', 'any'], text: 'जो छोटी कमी निभ सके, वह न निभने वाली बड़ी कमी से बेहतर है.', why: 'बड़ी कमी भूख और मांसपेशी की हानि बढ़ाती है और ज़्यादा छोड़ी जाती है; हफ़्ते में आधा किलो मांसपेशी और निरंतरता दोनों बचाता है.' },
  { id: 'fibre', tags: ['any'], text: 'रोटी से पहले सब्ज़ी. फ़ाइबर वह जगह भरता है जो चीनी चाहती है.', why: 'ज़्यादा फ़ाइबर और सब्ज़ियों वाला खाना पेट ख़ाली होना धीमा करता है और बिना गिने कुल खाना घटाता है.' },
  { id: 'plateau', tags: ['plateau', 'halfway', 'close'], text: 'ठहराव शरीर का तालमेल है, योजना की हार नहीं. दो हफ़्ते और टिके रहें.', why: 'पानी रुकना और शरीर का ढलना तराज़ू को 2–3 हफ़्ते रोक देता है जबकि चर्बी घटती रहती है; ज़्यादातर ठहराव बिना कुछ बदले टूटते हैं.' },
  { id: 'cheat-meal', tags: ['cheat', 'any'], text: 'योजना से हटकर एक तय खाना औज़ार है. पूरा दिन रीसेट बटन.', why: 'योजनाबद्ध लचीलापन लंबे समय तक टिकने में मदद करता है; बिना योजना ज़्यादा खाने की घटनाएँ ही वज़न लौटने का पूर्वानुमान हैं.' },
  { id: 'sitting', tags: ['office', 'any'], text: 'हर घंटे दो मिनट खड़े. पीठ और रक्त शर्करा दोनों महसूस करते हैं.', why: 'हर 30–60 मिनट में हल्की हलचल से बैठना तोड़ने पर खाने के बाद ग्लूकोज़ और इंसुलिन लगातार बैठने से कम रहते हैं.' },
  { id: 'slipping', tags: ['slipping'], text: 'बुरा हफ़्ता जानकारी है. कल नया नमूना.', why: 'वज़न घटाने में चूक सबको होती है; लौटने वालों और न लौटने वालों का फ़र्क़ पूर्णता नहीं, कुछ दिनों में फिर दर्ज करना शुरू करना है.' },
  { id: 'late-dinner', tags: ['evening', 'any'], text: 'नौ से पहले खाना. वही खाना जल्दी खाने पर हल्का बैठता है.', why: 'देर से खाने पर नियंत्रित अध्ययनों में अगले दिन भूख ज़्यादा और ऊर्जा ख़र्च कम दिखा, कैलोरी बराबर होने पर भी.' },
  { id: 'steps', tags: ['walk', 'any'], text: 'दस हज़ार क़दम नहीं चाहिए. कल से ज़्यादा चाहिए.', why: 'रोज़ लगभग 7–8 हज़ार क़दम तक फ़ायदे तेज़ी से बढ़ते हैं; सबसे बड़ा फ़ायदा सबसे कम स्तर से बाहर आने में है.' },
  { id: 'muscle', tags: ['halfway', 'close', 'done'], text: 'हल्का होना अच्छा है. मज़बूत होना उसे बनाए रखता है.', why: 'वज़न घटाते समय ताक़त का व्यायाम मांसपेशी और विश्राम चयापचय बचाता है; आहार ख़त्म होने के बाद वज़न टिकने की यही मुख्य वजह है.' },
  { id: 'maintain', tags: ['done'], text: 'वज़न बनाए रखना वही आदतें हैं, थोड़ी बड़ी थाली में.', why: 'दीर्घकालिक रजिस्ट्रियों में सफल लोग दर्ज करते रहते हैं, हफ़्ते में वज़न करते हैं, नाश्ता करते हैं और रोज़ चलते हैं; कमी ख़त्म होती है, दिनचर्या नहीं.' },
  { id: 'kitchen', tags: ['any'], text: 'जो कमरे में नहीं है वह खाया नहीं जाता. सेव दुकान पर ही रहने दें.', why: 'दिखने वाला और हाथ के पास का खाना कहीं ज़्यादा बार खाया जाता है; तुलना करने वाले हर अध्ययन में माहौल की बनावट इच्छाशक्ति से जीतती है.' },
  { id: 'sugar-tea', tags: ['any', 'office'], text: 'दिन में चार मीठी चाय यानी एक रोटी जो आपने कभी चखी नहीं.', why: 'तरल चीनी ठोस खाने जैसी तृप्ति नहीं देती, इसलिए उसकी कैलोरी खाने की जगह नहीं, उसके ऊपर जुड़ती हैं.' },
];

export const MANTRAS: Record<Lang, Mantra[]> = { en, mr, hi };
