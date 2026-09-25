import type { Lang } from '../core/types';
import type { NudgeType } from '../core/nudge';

type Msg = { title: string; body: string; task: string };

/**
 * Several lines per type, picked at random. The same sentence every 30
 * minutes is what makes people turn reminders off.
 */
export const NUDGES: Record<Lang, Record<NudgeType, Msg[]>> = {
  en: {
    water: [
      { title: 'Water break', body: 'One glass now, you are behind for the day.', task: 'Drink a full glass' },
      { title: 'Thirsty?', body: 'Half a litre behind. Fix it with one glass.', task: 'Drink a full glass' },
    ],
    stand: [
      { title: 'Stand up', body: 'Ninety minutes in the chair. Two minutes on your feet.', task: 'Walk to another room and back' },
      { title: 'Get up', body: 'Your back will thank you later.', task: 'Stand and stretch tall' },
    ],
    eyes: [
      { title: 'Look away', body: 'Screen for 45 minutes. Look far for 20 seconds.', task: 'Look out of a window' },
      { title: 'Rest your eyes', body: 'Twenty seconds at something far away.', task: 'Focus on something 6 metres away' },
    ],
    posture: [
      { title: 'Sit back', body: 'Shoulders down, back against the chair.', task: 'Roll your shoulders 5 times' },
    ],
    breathe: [
      { title: 'One minute', body: 'Slow it down for a minute.', task: 'Breathe in 4, hold 4, out 4' },
    ],
    log: [
      { title: 'What did you eat?', body: 'Five hours since your last entry.', task: 'Log your last meal' },
    ],
    progress: [
      { title: 'Look at this', body: 'You are further along than you feel.', task: 'Open Today and look at the week' },
    ],
  },
  mr: {
    water: [
      { title: 'पाणी प्या', body: 'आजच्या हिशोबात मागे आहात. एक ग्लास घ्या.', task: 'पूर्ण एक ग्लास पाणी प्या' },
      { title: 'तहान लागली का?', body: 'अर्धा लिटर मागे आहात.', task: 'पूर्ण एक ग्लास पाणी प्या' },
    ],
    stand: [
      { title: 'उठा', body: 'दीड तास बसून झाले. दोन मिनिटे उभे रहा.', task: 'दुसऱ्या खोलीत जाऊन या' },
      { title: 'जरा उभे रहा', body: 'पाठीला बरे वाटेल.', task: 'उभे राहून ताण द्या' },
    ],
    eyes: [
      { title: 'लांब बघा', body: '४५ मिनिटे स्क्रीन झाली. २० सेकंद लांब बघा.', task: 'खिडकीबाहेर बघा' },
    ],
    posture: [
      { title: 'नीट बसा', body: 'खांदे खाली, पाठ खुर्चीला टेकवा.', task: 'खांदे ५ वेळा फिरवा' },
    ],
    breathe: [
      { title: 'एक मिनिट', body: 'जरा सावकाश घ्या.', task: '४ मोजून श्वास घ्या, ४ थांबा, ४ सोडा' },
    ],
    log: [
      { title: 'काय खाल्ले?', body: 'पाच तास झाले काही नोंदवले नाही.', task: 'शेवटचे जेवण नोंदवा' },
    ],
    progress: [
      { title: 'हे बघा', body: 'वाटते त्यापेक्षा जास्त पुढे आला आहात.', task: 'आजचा आठवडा बघा' },
    ],
  },
  hi: {
    water: [
      { title: 'पानी पिएँ', body: 'आज के हिसाब से पीछे हैं. एक गिलास लें.', task: 'पूरा एक गिलास पानी पिएँ' },
    ],
    stand: [
      { title: 'खड़े हों', body: 'डेढ़ घंटे बैठे हो गए. दो मिनट खड़े रहें.', task: 'दूसरे कमरे तक जाकर आएँ' },
    ],
    eyes: [
      { title: 'दूर देखें', body: '45 मिनट स्क्रीन हो गई. 20 सेकंड दूर देखें.', task: 'खिड़की के बाहर देखें' },
    ],
    posture: [
      { title: 'सीधे बैठें', body: 'कंधे नीचे, पीठ कुर्सी से लगाएँ.', task: 'कंधे 5 बार घुमाएँ' },
    ],
    breathe: [
      { title: 'एक मिनट', body: 'थोड़ा धीमा करें.', task: '4 गिनकर साँस लें, 4 रोकें, 4 छोड़ें' },
    ],
    log: [
      { title: 'क्या खाया?', body: 'पाँच घंटे से कुछ दर्ज नहीं.', task: 'पिछला खाना दर्ज करें' },
    ],
    progress: [
      { title: 'यह देखें', body: 'जितना लगता है उससे ज़्यादा आगे हैं.', task: 'आज का हफ़्ता देखें' },
    ],
  },
};

export function pickMessage(lang: Lang, type: NudgeType): Msg {
  const list = NUDGES[lang][type] ?? NUDGES.en[type];
  return list[Math.floor(Math.random() * list.length)];
}
