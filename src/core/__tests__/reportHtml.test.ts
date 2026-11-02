import { describe, expect, it } from 'vitest';
import { compareReport, periodOf, periodReport, type DayFacts, type ReportInput } from '../report';
import { reportDoc } from '../reportDoc';
import { reportHtml } from '../reportHtml';
import type { DayScore } from '../teacher';
import { COLORS, makeDoc } from './reportFixtures';

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('reportHtml: the document', () => {
  const html = reportHtml(makeDoc(), COLORS);

  it('is one HTML document for an A4 page with margins, printed in colour', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('@page { size: A4; margin: 14mm }');
    expect(html).toContain('-webkit-print-color-adjust: exact');
    expect(html).toContain('-apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif');
    expect(html).toContain('<title>Monthly report October 2026</title>');
    expect(html).not.toMatch(/<script|<link|<img|https?:\/\//);
  });

  it('has the sections in the order of the page: header, summary, stats, chart, table, medals, footer', () => {
    const at = ['class="head"', 'class="summary"', 'class="stats"', 'class="chart"', 'class="days"', 'class="medals"', 'class="foot"'].map((c) => html.indexOf(c));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('writes the header with the logo tile in the accent colour, the name of the app, the title and month, and the name', () => {
    expect(html).toMatch(/<svg class="logo"[^>]*viewBox="0 0 100 100"/);
    expect(html).toContain(`fill="${COLORS.accent}"`);
    expect(html).toContain('M18 78 H36 V60 H54 V42 H72 V24');
    expect(html).toContain('Dhyey');
    expect(html).toContain('Monthly report · October 2026');
    expect(html).toContain('Varad');
    expect(reportHtml(makeDoc({ name: '' }), COLORS)).not.toContain('class="who"');
  });

  it('writes the summary and the footer', () => {
    expect(html).toContain('21 of 31 full days · 6 perfect days · best day Thursday, 30 October');
    expect(html).toContain('Made with Dhyey on 2 Nov 2026 · Dhyey is not a doctor');
  });

  it('is drawn in the palette it is given', () => {
    const other = reportHtml(makeDoc(), { ...COLORS, accent: '#3F51B5', gold: '#C77700' });
    expect(other).toContain('#3F51B5');
    expect(other).not.toContain('#0C8263');
    expect(other).toContain('#C77700');
  });
});

describe('reportHtml: the stats', () => {
  const html = reportHtml(makeDoc(), COLORS);

  it('has a card for each stat with its label, value, sub line and comparison', () => {
    expect(count(html, 'class="stat"')).toBe(8);
    expect(html).toContain('Label meals');
    expect(html).toContain('1 of 31');
    expect(html).toContain('sub meals');
  });

  it('says a rise in the good colour and a fall plainly', () => {
    expect(html).toContain('<div class="delta good">0 more than last month</div>');
    expect(html).toContain('<div class="delta">1 fewer than last month</div>');
  });

  it('draws the bar of a goal as a share of the track, and none where there is no goal', () => {
    expect(html).toContain('<div class="fill" style="width:50.0%"></div>');
    const doc = makeDoc({ statCount: 2 });
    doc.stats[0] = { ...doc.stats[0], bar: null, sub: null, delta: null };
    const plain = reportHtml(doc, COLORS);
    expect(count(plain, 'class="fill"')).toBe(1);
    expect(plain).not.toContain('sub meals');
  });

  it('colours a bar in the muted tone where the stat says so, and in the accent otherwise', () => {
    expect(count(html, 'class="fill faint"')).toBe(0);
    const doc = makeDoc({ statCount: 3 });
    doc.stats[2] = { ...doc.stats[2], barTone: 'faint' };
    const muted = reportHtml(doc, COLORS);
    expect(count(muted, 'class="fill faint"')).toBe(1);
    expect(count(muted, 'class="fill"')).toBe(2);
    expect(muted).toContain(`.fill.faint { background: ${COLORS.textFaint} }`);
  });

  it('has no stats grid when there is nothing to report', () => {
    expect(reportHtml(makeDoc({ statCount: 0 }), COLORS)).not.toContain('class="stats"');
  });
});

describe('reportHtml: the chart', () => {
  const html = reportHtml(makeDoc(), COLORS);

  it('is an inline SVG with one rect for each bar', () => {
    const svg = html.slice(html.indexOf('<svg class="plot"'), html.indexOf('</svg>', html.indexOf('<svg class="plot"')));
    expect(svg).toContain('viewBox="0 0 700');
    expect(count(svg, '<rect class="bar"')).toBe(31);
  });

  it('draws the goal as a dashed line and names the 1st and every fifth day', () => {
    expect(html).toMatch(/<line class="goal"[^>]*stroke-dasharray/);
    const labels = [...html.matchAll(/<text class="day"[^>]*>(\d+)<\/text>/g)].map((m) => m[1]);
    expect(labels).toEqual(['1', '5', '10', '15', '20', '25', '30']);
    expect(html).toContain('Calories a day · the dashed line is your goal, 1,760 kcal');
  });

  it('makes a taller bar for more calories, and a bar past the goal rises above the goal line', () => {
    const doc = makeDoc();
    doc.chart.bars[0].value = 500;
    doc.chart.bars[1].value = 2500;
    const out = reportHtml(doc, COLORS);
    const heights = [...out.matchAll(/<rect class="bar"[^>]* height="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(heights[1]).toBeGreaterThan(heights[0]);
    const goalY = Number(/<line class="goal"[^>]* y1="([\d.]+)"/.exec(out)![1]);
    const bar = /<rect class="bar"[^>]* y="([\d.]+)"[^>]* height="([\d.]+)"/.exec(out.slice(out.indexOf('<rect class="bar"') + 10))!;
    expect(Number(bar[1])).toBeLessThan(goalY);
  });

  it('does not break on a month with no days', () => {
    const doc = makeDoc();
    doc.chart.bars = [];
    expect(() => reportHtml(doc, COLORS)).not.toThrow();
  });
});

describe('reportHtml: the table', () => {
  const html = reportHtml(makeDoc(), COLORS);

  it('has the head once, in a thead that repeats on each printed page, and a row a day', () => {
    expect(count(html, '<thead>')).toBe(1);
    expect(html).toContain('thead { display: table-header-group }');
    expect(count(html, '<tr')).toBe(1 + 31);
    for (const h of ['Date', 'kcal', 'Protein', 'Water', 'Walk', 'Jobs', 'Record']) expect(html).toContain(`<th>${h}</th>`);
  });

  it('marks a perfect day with a star and a day that does not count as dim, with its dashes', () => {
    expect(count(html, '<tr class="perfect">')).toBe(makeDoc().table.rows.filter((r) => r.perfect).length);
    expect(count(html, '<tr class="dim">')).toBe(makeDoc().table.rows.filter((r) => r.dim).length);
    expect(html).toContain('<td class="rec"><span class="star">★</span>Full</td>');
    expect(html).toContain('<td class="rec"><span class="star"></span>Free day</td>');
    expect(html).toContain('<td>–</td>');
  });
});

describe('reportHtml: the medals', () => {
  it('lists them in a panel, and leaves the panel out when there are none', () => {
    const html = reportHtml(makeDoc(), COLORS);
    expect(html).toContain('<p>Perfect-week medals this month: 2</p>');
    expect(html).toContain('<p>Medals held: 9</p>');
    expect(reportHtml(makeDoc({ medals: [] }), COLORS)).not.toContain('class="medals"');
  });
});

describe('reportHtml: every user string is escaped', () => {
  it('turns a name of <b>x</b> into text', () => {
    const html = reportHtml(makeDoc({ name: '<b>x</b>' }), COLORS);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });

  it('escapes & < > " and \' in every string of the document, job names included', () => {
    const nasty = `<img src=x onerror="alert('1')"> & co`;
    const doc = makeDoc({ name: nasty, title: nasty, month: nasty, summary: nasty, footer: nasty, medals: [nasty], app: nasty });
    doc.stats[0] = { ...doc.stats[0], label: nasty, value: nasty, sub: nasty, delta: { text: nasty, good: true } };
    doc.table.head[0] = nasty;
    doc.table.rows[0].cells[0] = nasty;
    doc.chart.caption = nasty;
    doc.chart.bars[0].label = nasty;
    const html = reportHtml(doc, COLORS);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror="');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt; &amp; co');
    expect(count(html, '&lt;img')).toBeGreaterThanOrEqual(10);
  });
});

describe('reportHtml: a real report in Marathi', () => {
  const TODAY = '2026-11-02';
  const score = (p: Partial<DayScore> = {}): DayScore => ({ meals: { done: 4, of: 4 }, jobs: { done: 3, of: 3, next: null }, water: { ml: 2500, goal: 2500 }, walk: { min: 30, goal: 30 }, ...p });
  const facts = (date: string): DayFacts => ({ date, counts: date <= TODAY && date >= '2026-09-01', mark: 'full', perfect: date.endsWith('3'), kcal: 1700, protein: 90, waterMl: 2500, walkMin: 30, jobs: { done: 3, total: 3, minutes: 20 }, score: score() });
  const input: ReportInput = { today: TODAY, nowMinutes: 600, since: '2026-09-01', offDays: [], goals: { kcal: 1760, protein: 112, waterMl: 2500, walkMin: 30 }, factsOn: facts, weights: [], perfectWeekMondays: [] };
  const report = periodReport(periodOf('month', '2026-10-15'), input);
  const doc = reportDoc({ report, before: compareReport(report, input), goals: input.goals, name: 'वरद शिंदे', lang: 'mr', medalsHeld: 3, madeOn: TODAY });
  const html = reportHtml(doc, COLORS);

  it('carries the Marathi words and the language of the page', () => {
    expect(html).toContain('<html lang="mr">');
    expect(html).toContain(doc.title);
    expect(html).toContain(doc.summary);
    expect(html).toContain(doc.footer);
    expect(html).toContain('वरद');
    expect(html).not.toContain('शिंदे');
    for (const s of doc.stats) expect(html).toContain(s.label);
    expect(html).toContain('मागच्या महिन्यापेक्षा');
    expect(count(html, '<tr')).toBe(1 + 31);
    expect(count(html, '<rect class="bar"')).toBe(31);
  });
});
