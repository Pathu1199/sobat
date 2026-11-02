import { describe, expect, it } from 'vitest';
import { CONTENT_BOTTOM, layoutReport, PAGE, type Op, type Page } from '../reportLayout';
import { COLORS, makeDoc, STAT_IDS } from './reportFixtures';

/** Not a real font: a character is a bit over half its size wide, so a long line is long. */
const measure = (text: string, size: number, weight: number) => text.length * size * 0.55 * (weight >= 600 ? 1.05 : 1);

const texts = (page: Page) => page.ops.filter((o): o is Extract<Op, { kind: 'text' }> => o.kind === 'text');
const allTexts = (pages: Page[]) => pages.flatMap(texts);

/** The horizontal and vertical extent of an op, text measured with the same fake font. */
function extent(o: Op): { x0: number; x1: number; y0: number; y1: number } {
  if (o.kind === 'rect') return { x0: o.x, x1: o.x + o.w, y0: o.y, y1: o.y + o.h };
  if (o.kind === 'line') return { x0: Math.min(o.x1, o.x2), x1: Math.max(o.x1, o.x2), y0: Math.min(o.y1, o.y2), y1: Math.max(o.y1, o.y2) };
  if (o.kind === 'logo') return { x0: o.x, x1: o.x + o.size, y0: o.y, y1: o.y + o.size };
  const w = measure(o.text, o.size, o.weight);
  const x0 = o.align === 'left' ? o.x : o.align === 'right' ? o.x - w : o.x - w / 2;
  return { x0, x1: x0 + w, y0: o.y - o.size, y1: o.y + o.size * 0.25 };
}

describe('layoutReport: the pages', () => {
  it('lays a 31-day month on two A4 pages at 150 dpi', () => {
    const pages = layoutReport(makeDoc(), COLORS, measure);
    expect(pages).toHaveLength(2);
    for (const p of pages) expect([p.width, p.height]).toEqual([1240, 1754]);
    expect(PAGE).toMatchObject({ width: 1240, height: 1754, margin: 72 });
  });

  it('keeps every op inside the page, text measured with the font it will be drawn in', () => {
    for (const doc of [makeDoc(), makeDoc({ days: 28, statCount: 3 }), makeDoc({ statCount: 0, medals: [] }), makeDoc({ name: 'A'.repeat(90), summary: 'long words '.repeat(40) })]) {
      for (const [i, page] of layoutReport(doc, COLORS, measure).entries()) {
        for (const op of page.ops) {
          const e = extent(op);
          expect(e.x0, `page ${i + 1} ${JSON.stringify(op).slice(0, 80)}`).toBeGreaterThanOrEqual(0);
          expect(e.x1).toBeLessThanOrEqual(page.width + 0.001);
          expect(e.y0).toBeGreaterThanOrEqual(0);
          expect(e.y1).toBeLessThanOrEqual(page.height);
        }
      }
    }
  });

  it('paints each page white first and keeps content above the footer', () => {
    const pages = layoutReport(makeDoc(), COLORS, measure);
    for (const p of pages) {
      expect(p.ops[0]).toEqual({ kind: 'rect', x: 0, y: 0, w: 1240, h: 1754, fill: COLORS.white });
      for (const op of p.ops.slice(1)) {
        if (op.kind === 'rect') expect(op.y + op.h).toBeLessThanOrEqual(CONTENT_BOTTOM);
      }
    }
  });

  it('puts a footer and "n / N" on the bottom of every page', () => {
    const pages = layoutReport(makeDoc(), COLORS, measure);
    pages.forEach((p, i) => {
      const t = texts(p);
      expect(t.some((o) => o.text === makeDoc().footer && o.y > CONTENT_BOTTOM)).toBe(true);
      expect(t.some((o) => o.text === `${i + 1} / ${pages.length}` && o.align === 'right' && o.y > CONTENT_BOTTOM)).toBe(true);
    });
  });
});

describe('layoutReport: page one', () => {
  const pages = layoutReport(makeDoc(), COLORS, measure);
  const first = pages[0];

  it('has the logo tile, the name of the app, the title and month, and the name at the right', () => {
    expect(first.ops.filter((o) => o.kind === 'logo')).toEqual([{ kind: 'logo', x: 72, y: 72, size: 72, fill: COLORS.accent, ink: COLORS.white }]);
    expect(pages[1].ops.some((o) => o.kind === 'logo')).toBe(false);
    const t = texts(first);
    expect(t.find((o) => o.text === 'Dhyey')).toMatchObject({ align: 'left', weight: 600 });
    expect(t.find((o) => o.text === 'Monthly report · October 2026')).toMatchObject({ align: 'left', color: COLORS.textDim });
    expect(t.find((o) => o.text === 'Varad')).toMatchObject({ align: 'right', x: 1240 - 72 });
  });

  it('leaves the name out when there is none', () => {
    const t = allTexts(layoutReport(makeDoc({ name: '' }), COLORS, measure));
    expect(t.some((o) => o.align === 'right' && o.x === 1240 - 72 && o.y < 200)).toBe(false);
  });

  it('cuts a long name with an ellipsis so it still fits beside the title', () => {
    const name = 'Venkatanarasimharajuvaripeta '.repeat(5);
    const cut = texts(layoutReport(makeDoc({ name }), COLORS, measure)[0]).find((o) => o.align === 'right' && o.y < 200)!;
    expect(cut.text.endsWith('…')).toBe(true);
    expect(cut.text.length).toBeLessThan(name.length);
    expect(measure(cut.text, cut.size, cut.weight)).toBeLessThanOrEqual(380);
  });

  it('writes the summary, wrapped to two lines at most with the rest cut', () => {
    const t = texts(first);
    expect(t.some((o) => o.text === makeDoc().summary)).toBe(true);
    const long = texts(layoutReport(makeDoc({ summary: 'word '.repeat(80).trim() }), COLORS, measure)[0]).filter((o) => o.size === 28);
    expect(long).toHaveLength(2);
    expect(long[1].text.endsWith('…')).toBe(true);
  });

  it('draws the stats as a grid of two columns of cards, each with its label, value, sub line and comparison', () => {
    const cards = first.ops.filter((o) => o.kind === 'rect' && o.fill === COLORS.border && o.w > 400 && o.w < 600 && o.h > 100 && o.h < 300);
    expect(cards).toHaveLength(8);
    expect(new Set(cards.map((c) => (c as Extract<Op, { kind: 'rect' }>).x)).size).toBe(2);
    const t = texts(first);
    for (const [i, id] of STAT_IDS.entries()) {
      expect(t.some((o) => o.text === `Label ${id}`), id).toBe(true);
      expect(t.some((o) => o.text === `${i + 1} of 31` && o.size >= 40), id).toBe(true);
      expect(t.some((o) => o.text === `sub ${id}`), id).toBe(true);
    }
  });

  it('says a rise in the accent colour and a fall plainly in muted text, never amber or red', () => {
    const t = texts(first);
    expect(t.find((o) => o.text === '0 more than last month')!.color).toBe(COLORS.accent);
    expect(t.find((o) => o.text === '1 fewer than last month')!.color).toBe(COLORS.textDim);
    const colours = new Set(first.ops.flatMap((o) => ('color' in o ? [o.color] : 'fill' in o ? [o.fill] : [])));
    for (const c of colours) expect(Object.values(COLORS)).toContain(c);
  });

  it('draws a stat with no comparison or no sub line without one', () => {
    const doc = makeDoc({ statCount: 2 });
    doc.stats[0] = { ...doc.stats[0], sub: null, delta: null, bar: null };
    const t = texts(layoutReport(doc, COLORS, measure)[0]);
    expect(t.some((o) => o.text === 'Label meals')).toBe(true);
    expect(t.some((o) => o.text === 'sub meals')).toBe(false);
    expect(t.some((o) => o.text === '0 more than last month')).toBe(false);
  });

  it('has no grid for a month with nothing to report', () => {
    const pages1 = layoutReport(makeDoc({ statCount: 0, summary: 'Nothing to report for this month yet.' }), COLORS, measure);
    expect(texts(pages1[0]).some((o) => o.text === 'Nothing to report for this month yet.')).toBe(true);
    expect(pages1[0].ops.filter((o) => o.kind === 'rect' && o.fill === COLORS.border && o.w > 400 && o.w < 600 && o.h > 100 && o.h < 300)).toHaveLength(0);
  });
});

describe('layoutReport: the chart', () => {
  const pages = layoutReport(makeDoc(), COLORS, measure);
  const isBar = (o: Op): o is Extract<Op, { kind: 'rect' }> => o.kind === 'rect' && o.fill === COLORS.accent && o.h > 20;
  const bars = pages[0].ops.filter(isBar);

  it('draws one bar a day, taller for more, all on one baseline', () => {
    expect(bars).toHaveLength(31);
    const base = new Set(bars.map((b) => Math.round(b.y + b.h)));
    expect(base.size).toBe(1);
    const doc = makeDoc();
    const tall = doc.chart.bars.indexOf(doc.chart.bars.reduce((a, b) => (b.value > a.value ? b : a)));
    const short = doc.chart.bars.indexOf(doc.chart.bars.reduce((a, b) => (b.value < a.value ? b : a)));
    expect(bars[tall].h).toBeGreaterThan(bars[short].h);
    for (let i = 1; i < bars.length; i += 1) expect(bars[i].x).toBeGreaterThan(bars[i - 1].x);
  });

  it('draws no bar for a day of nothing', () => {
    const doc = makeDoc();
    doc.chart.bars[3].value = 0;
    const drawn = layoutReport(doc, COLORS, measure)[0].ops.filter(isBar);
    expect(drawn).toHaveLength(30);
  });

  it('draws the goal as a dashed line at the height of the goal, across the whole chart', () => {
    const dashes = pages[0].ops.filter((o): o is Extract<Op, { kind: 'line' }> => o.kind === 'line' && o.color === COLORS.textDim);
    expect(dashes.length).toBeGreaterThan(10);
    expect(new Set(dashes.map((d) => d.y1)).size).toBe(1);
    expect(dashes.every((d) => d.y1 === d.y2)).toBe(true);
    const baseline = bars[0].y + bars[0].h;
    expect(dashes[0].y1).toBeLessThan(baseline);
    // Every bar here is under the goal of 1,760, so the line is above the tallest.
    expect(dashes[0].y1).toBeLessThan(Math.min(...bars.map((b) => b.y)));
    expect(dashes[0].x1).toBeLessThan(bars[0].x);
    expect(Math.max(...dashes.map((d) => d.x2))).toBeGreaterThan(bars[30].x);
  });

  it('puts the goal line below the top of a bar that goes past it', () => {
    const doc = makeDoc();
    doc.chart.bars[10].value = 3000;
    const p = layoutReport(doc, COLORS, measure)[0];
    const b = p.ops.filter(isBar);
    const goalY = (p.ops.find((o) => o.kind === 'line' && o.color === COLORS.textDim) as Extract<Op, { kind: 'line' }>).y1;
    expect(b[10].y).toBeLessThan(goalY);
  });

  it('labels the 1st and every fifth day under the bars and writes the caption', () => {
    const t = texts(pages[0]);
    const labels = t.filter((o) => o.align === 'center' && /^\d+$/.test(o.text)).map((o) => o.text);
    expect(labels).toEqual(['1', '5', '10', '15', '20', '25', '30']);
    expect(t.some((o) => o.text === makeDoc().chart.caption)).toBe(true);
  });

  it('draws nothing for a chart with no days', () => {
    const doc = makeDoc();
    doc.chart.bars = [];
    expect(() => layoutReport(doc, COLORS, measure)).not.toThrow();
  });
});

describe('layoutReport: the table', () => {
  const doc = makeDoc();
  const pages = layoutReport(doc, COLORS, measure);

  it('repeats the head on every page that holds rows', () => {
    for (const p of pages) {
      const rows = texts(p).filter((o) => /^Day \d+$/.test(o.text));
      expect(rows.length).toBeGreaterThan(0);
      for (const h of doc.table.head) expect(texts(p).filter((o) => o.text === h && o.weight === 600), h).toHaveLength(1);
    }
  });

  it('draws every day once, in order, across the pages', () => {
    const days = allTexts(pages).filter((o) => /^Day \d+$/.test(o.text)).map((o) => o.text);
    expect(days).toEqual(doc.table.rows.map((r) => r.cells[0]));
  });

  it('continues onto the next page rather than past the bottom', () => {
    const small = makeDoc({ statCount: 3 });
    const laid = layoutReport(small, COLORS, measure);
    expect(laid).toHaveLength(2);
    const onFirst = texts(laid[0]).filter((o) => /^Day \d+$/.test(o.text)).length;
    const onSecond = texts(laid[1]).filter((o) => /^Day \d+$/.test(o.text)).length;
    expect(onFirst).toBeGreaterThan(3);
    expect(onFirst + onSecond).toBe(31);
    for (const p of laid) for (const o of texts(p)) if (/^Day \d+$/.test(o.text)) expect(o.y).toBeLessThanOrEqual(CONTENT_BOTTOM);
  });

  it('never leaves a table starting with fewer than three rows at the foot of a page', () => {
    for (let stats = 0; stats <= 8; stats += 1) {
      for (const days of [28, 29, 30, 31]) {
        const laid = layoutReport(makeDoc({ days, statCount: stats }), COLORS, measure);
        const first = texts(laid[0]).filter((o) => /^Day \d+$/.test(o.text)).length;
        expect(first === 0 || first >= 3, `${stats} stats, ${days} days: ${first} rows on page 1`).toBe(true);
        expect(allTexts(laid).filter((o) => /^Day \d+$/.test(o.text))).toHaveLength(days);
      }
    }
  });

  it('right-aligns the figures, left-aligns the date and the record, and puts a star on a perfect day', () => {
    const page = pages.find((p) => texts(p).some((o) => o.text === 'Day 5'))!;
    const t = texts(page);
    const row5y = t.find((o) => o.text === 'Day 5')!.y;
    const cells = t.filter((o) => o.y === row5y);
    expect(cells.find((o) => o.text === 'Day 5')!.align).toBe('left');
    for (const c of ['1,700', '90 g', '2.5 L', '30 min', '3/3']) expect(cells.find((o) => o.text === c)!.align, c).toBe('right');
    expect(cells.find((o) => o.text === 'Full')!.align).toBe('left');
    expect(cells.find((o) => o.text === '★')).toMatchObject({ color: COLORS.gold });
    expect(allTexts(pages).filter((o) => o.text === '★')).toHaveLength(doc.table.rows.filter((r) => r.perfect).length);
    expect(page.ops.some((o) => o.kind === 'rect' && o.fill === COLORS.goldSoft && o.y < row5y && o.y + o.h > row5y)).toBe(true);
    // The words of a perfect day and of another start at the same place.
    const word = (day: string) => allTexts(pages).find((o) => o.text === 'Full' && o.y === allTexts(pages).find((d) => d.text === day)!.y)!.x;
    expect(word('Day 5')).toBe(word('Day 6'));
  });

  it('draws a day that does not count in faint text with dashes, and no star', () => {
    const t = allTexts(pages);
    const free = t.find((o) => o.text === 'Day 7')!;
    expect(free.color).toBe(COLORS.textFaint);
    const sameRow = t.filter((o) => o.y === free.y);
    expect(sameRow.some((o) => o.text === '–')).toBe(true);
    expect(sameRow.some((o) => o.text === '★')).toBe(false);
    expect(t.find((o) => o.text === 'Day 1')!.color).toBe(COLORS.text);
  });

  it('cuts a cell that is too long for its column', () => {
    const d = makeDoc({ statCount: 3 });
    d.table.rows[0].cells[6] = 'A very long record word that cannot fit';
    const t = allTexts(layoutReport(d, COLORS, measure));
    const cut = t.find((o) => o.text.startsWith('A very'))!;
    expect(cut.text.endsWith('…')).toBe(true);
  });
});

describe('layoutReport: the medals and the foot', () => {
  it('puts the medals after the last row, on the same page when there is room', () => {
    const doc = makeDoc();
    const pages = layoutReport(doc, COLORS, measure);
    const last = pages[pages.length - 1];
    const t = texts(last);
    const lastRow = t.filter((o) => /^Day \d+$/.test(o.text)).pop()!;
    for (const m of doc.medals) expect(t.find((o) => o.text === m)!.y).toBeGreaterThan(lastRow.y);
    expect(pages[0].ops.some((o) => o.kind === 'text' && o.text === doc.medals[0])).toBe(false);
  });

  it('has no medals block when there is nothing to say', () => {
    const doc = makeDoc({ medals: [] });
    const laid = layoutReport(doc, COLORS, measure);
    expect(laid.some((p) => p.ops.some((o) => o.kind === 'rect' && o.fill === COLORS.goldSoft && o.h > 60))).toBe(false);
  });

  it('moves the medals to a new page when the table leaves no room for them', () => {
    // With 31 rows and 3 stats the second page ends with the table nearly at the foot; a long medal list cannot follow it.
    const medals = Array.from({ length: 30 }, (_, i) => `Medal line ${i}`);
    const laid = layoutReport(makeDoc({ statCount: 3, medals }), COLORS, measure);
    expect(laid.length).toBeGreaterThanOrEqual(3);
    const found = laid.flatMap((p, i) => texts(p).filter((o) => o.text.startsWith('Medal line')).map(() => i));
    expect(found).toHaveLength(30);
    for (const p of laid) for (const o of texts(p)) if (o.text.startsWith('Medal line')) expect(o.y).toBeLessThanOrEqual(CONTENT_BOTTOM);
  });
});
