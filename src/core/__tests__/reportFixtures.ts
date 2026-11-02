import type { DocRow, DocStat, ReportColors, ReportDoc } from '../reportDoc';

/** A month's report as the layout and the HTML get it, and the colours it is drawn in: shared by their tests. */
export const COLORS: ReportColors = {
  accent: '#0C8263',
  accentSoft: '#D4EFE6',
  text: '#10211D',
  textDim: '#4A5D58',
  textFaint: '#6B7C77',
  border: '#D5E0DD',
  gold: '#B8860B',
  goldSoft: '#FBEBD8',
  card: '#FFFFFF',
  bg: '#F3F7F6',
  white: '#FFFFFF',
};

export const STAT_IDS: DocStat['id'][] = ['meals', 'perfect', 'kcal', 'protein', 'water', 'walk', 'jobs', 'weight'];
const stat = (id: DocStat['id'], i: number): DocStat => ({
  id,
  label: `Label ${id}`,
  value: `${i + 1} of 31`,
  sub: `sub ${id}`,
  bar: 0.5,
  barTone: 'accent',
  delta: i % 2 === 0 ? { text: `${i} more than last month`, good: true } : { text: `${i} fewer than last month`, good: false },
});

export function makeDoc(over: Partial<ReportDoc> & { days?: number; statCount?: number } = {}): ReportDoc {
  const { days = 31, statCount = 8, ...rest } = over;
  const rows: DocRow[] = Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const dim = day % 7 === 0;
    return { cells: [`Day ${day}`, dim ? '–' : '1,700', dim ? '–' : '90 g', dim ? '–' : '2.5 L', dim ? '–' : '30 min', dim ? '–' : '3/3', dim ? 'Free day' : 'Full'], perfect: !dim && day % 5 === 0, dim };
  });
  return {
    fileName: 'dhyey-report-2026-10.pdf',
    app: 'Dhyey',
    lang: 'en',
    title: 'Monthly report',
    month: 'October 2026',
    name: 'Varad',
    summary: '21 of 31 full days · 6 perfect days · best day Thursday, 30 October',
    stats: STAT_IDS.slice(0, statCount).map(stat),
    chart: { bars: Array.from({ length: days }, (_, i) => ({ label: i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : '', value: 1000 + ((i * 97) % 600) })), goal: 1760, caption: 'Calories a day · the dashed line is your goal, 1,760 kcal' },
    table: { head: ['Date', 'kcal', 'Protein', 'Water', 'Walk', 'Jobs', 'Record'], rows },
    medals: ['Perfect-week medals this month: 2', 'Medals held: 9'],
    footer: 'Made with Dhyey on 2 Nov 2026 · Dhyey is not a doctor',
    ...rest,
  };
}

