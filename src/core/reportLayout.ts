import type { DocRow, DocStat, ReportColors, ReportDoc } from './reportDoc';

/**
 * The monthly report laid out as A4 pages at 150 dpi, as a list of drawing operations (rectangles, lines, text and the logo) on
 * pages of 1240 x 1754 px. The browser draws them on canvases and sends them through the PDF writer; only `measure`, how wide a
 * text is in the font it will be drawn in, comes from the canvas, so the layout itself is the same everywhere and is tested. Pure.
 *
 * A text op's `y` is its baseline. A page holds the header, the summary, the stats as a grid of two columns, the chart and then the
 * table, which runs on to further pages with its head repeated; the medals and a footer with "n / N" follow.
 */
export type Weight = 400 | 500 | 600;
export type Op =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill: string }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { kind: 'text'; x: number; y: number; text: string; size: number; weight: Weight; color: string; align: 'left' | 'right' | 'center' }
  | { kind: 'logo'; x: number; y: number; size: number; fill: string; ink: string };
export type Page = { width: number; height: number; ops: Op[] };
/** How wide, in px, a text is at a size and weight in the font it will be drawn in. */
export type Measure = (text: string, sizePx: number, weight: Weight) => number;

export const PAGE = { width: 1240, height: 1754, margin: 72 } as const;

/** The fonts a report is set in, on paper and on the canvas: the system's own, with a Devanagari face for Marathi and Hindi. */
export const REPORT_FONTS = '-apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif';

/** The Dhyey mark in a 100-unit box, as `src/ui/Logo.tsx` draws it: a tile, three rising steps in `stroke` and a dot at their foot. The HTML and the canvas draw the same geometry. */
export const LOGO = { box: 100, radius: 22, path: 'M18 78 H36 V60 H54 V42 H72 V24', stroke: 9, dot: { cx: 76, cy: 76, r: 8 } } as const;

const W = PAGE.width;
const H = PAGE.height;
const M = PAGE.margin;
const CW = W - 2 * M;
const FOOT_LINE_Y = H - M - 44;
const FOOT_TEXT_Y = H - M;
/** Nothing but the footer is drawn below this. */
export const CONTENT_BOTTOM = FOOT_LINE_Y - 24;

const CARD_GAP = 24;
const CARD_W = (CW - CARD_GAP) / 2;
const CARD_H = 176;
const CARD_PAD = 24;
const ROW_H = 40;
const HEAD_H = 52;
/** The share of the table's width each column takes: date, calories, protein, water, walk, jobs, record. */
const COLUMNS = [0.2, 0.11, 0.12, 0.11, 0.12, 0.09, 0.25];
/** The room the record column keeps for a star before its word, so the words line up whether a day is perfect or not. */
const STAR_SLOT = 34;
const NAME_MAX = 380;

/** The characters of a text as the eye counts them (a Devanagari letter with its marks is one), so a cut never splits one. */
function graphemes(text: string): string[] {
  const Segmenter = (Intl as { Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => { segment(input: string): Iterable<{ segment: string }> } }).Segmenter;
  return Segmenter ? Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment) : Array.from(text);
}

export function layoutReport(doc: ReportDoc, colors: ReportColors, measure: Measure): Page[] {
  const pages: Page[] = [];
  let ops: Op[] = [];
  let y = M;

  const newPage = () => {
    ops = [{ kind: 'rect', x: 0, y: 0, w: W, h: H, fill: colors.white }];
    pages.push({ width: W, height: H, ops });
    y = M;
  };
  /** Starts a new page unless `h` more px fit above the footer. */
  const room = (h: number) => {
    if (y + h > CONTENT_BOTTOM) newPage();
  };

  /** `text`, or as much of it as fits in `maxW` with an ellipsis. */
  const fit = (text: string, maxW: number, size: number, weight: Weight): string => {
    if (measure(text, size, weight) <= maxW) return text;
    const chars = graphemes(text);
    while (chars.length > 0) {
      chars.pop();
      const cut = `${chars.join('').trimEnd()}…`;
      if (measure(cut, size, weight) <= maxW) return cut;
    }
    return '';
  };
  /** `text` in at most `lines` lines of `maxW`, broken at spaces, the last cut with an ellipsis. */
  const wrap = (text: string, maxW: number, size: number, weight: Weight, lines: number): string[] => {
    const words = text.split(' ');
    const out: string[] = [];
    let line = '';
    for (let i = 0; i < words.length; i += 1) {
      const next = line ? `${line} ${words[i]}` : words[i];
      if (!line || measure(next, size, weight) <= maxW) {
        line = next;
      } else if (out.length === lines - 1) {
        line = [line, ...words.slice(i)].join(' ');
        break;
      } else {
        out.push(line);
        line = words[i];
      }
    }
    out.push(line);
    return out.map((l) => fit(l, maxW, size, weight));
  };

  const text = (x: number, at: number, value: string, size: number, weight: Weight, color: string, align: 'left' | 'right' | 'center' = 'left', maxW?: number) => {
    const shown = maxW === undefined ? value : fit(value, maxW, size, weight);
    if (shown !== '') ops.push({ kind: 'text', x, y: at, text: shown, size, weight, color, align });
  };
  const rect = (x: number, top: number, w: number, h: number, fill: string, r?: number) => {
    ops.push(r === undefined ? { kind: 'rect', x, y: top, w, h, fill } : { kind: 'rect', x, y: top, w, h, r, fill });
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, width: number) => {
    ops.push({ kind: 'line', x1, y1, x2, y2, color, width });
  };
  /** A card: a soft panel with a hairline edge, which on white paper is a rim of border colour round a fill of the page tint. */
  const card = (x: number, top: number, w: number, h: number, fill: string) => {
    rect(x, top, w, h, colors.border, 20);
    rect(x + 2, top + 2, w - 4, h - 4, fill, 18);
  };

  newPage();

  // Header: the logo tile, the app's name over "Monthly report · October 2026", the user's first name at the right.
  ops.push({ kind: 'logo', x: M, y, size: 72, fill: colors.accent, ink: colors.white });
  const titleX = M + 72 + 20;
  text(titleX, y + 34, doc.app, 40, 600, colors.text);
  text(titleX, y + 68, `${doc.title} · ${doc.month}`, 26, 400, colors.textDim, 'left', W - M - titleX);
  if (doc.name !== '') text(W - M, y + 34, doc.name, 32, 500, colors.text, 'right', NAME_MAX);
  y += 72 + 24;
  line(M, y, W - M, y, colors.border, 2);
  y += 36;

  // The summary: at most two lines.
  const summary = wrap(doc.summary, CW, 28, 500, 2);
  summary.forEach((l, i) => text(M, y + 28 + i * 38, l, 28, 500, colors.text));
  y += summary.length * 38 + 32;

  // The stats: two to a row.
  const drawStat = (x: number, top: number, s: DocStat) => {
    const inner = CARD_W - 2 * CARD_PAD;
    card(x, top, CARD_W, CARD_H, colors.bg);
    text(x + CARD_PAD, top + 38, s.label, 21, 500, colors.textDim, 'left', inner);
    text(x + CARD_PAD, top + 88, s.value, 44, 600, colors.text, 'left', inner);
    if (s.bar !== null) {
      rect(x + CARD_PAD, top + 104, inner, 8, colors.accentSoft, 4);
      if (s.bar > 0) rect(x + CARD_PAD, top + 104, Math.max(8, inner * Math.min(1, s.bar)), 8, colors.accent, 4);
    }
    if (s.sub !== null) text(x + CARD_PAD, top + 138, s.sub, 20, 400, colors.textDim, 'left', inner);
    if (s.delta !== null) text(x + CARD_PAD, top + 164, s.delta.text, 20, s.delta.good ? 500 : 400, s.delta.good ? colors.accent : colors.textDim, 'left', inner);
  };
  for (let i = 0; i < doc.stats.length; i += 2) {
    room(CARD_H);
    drawStat(M, y, doc.stats[i]);
    if (i + 1 < doc.stats.length) drawStat(M + CARD_W + CARD_GAP, y, doc.stats[i + 1]);
    y += CARD_H + 20;
  }
  if (doc.stats.length > 0) y += 16;

  // The chart: a bar a day, the goal as a dashed line, the 1st and every fifth day named, and the caption.
  const bars = doc.chart.bars;
  if (bars.length > 0) {
    const PANEL_H = 304;
    const PLOT_H = 190;
    room(PANEL_H);
    card(M, y, CW, PANEL_H, colors.bg);
    const left = M + 28;
    const width = CW - 56;
    const base = y + 28 + PLOT_H;
    const top = Math.max(doc.chart.goal, ...bars.map((b) => b.value), 1) * 1.08;
    const slot = width / bars.length;
    const barW = slot * 0.62;
    bars.forEach((b, i) => {
      const x = left + i * slot + (slot - barW) / 2;
      if (b.value > 0) {
        const h = (b.value / top) * PLOT_H;
        rect(x, base - h, barW, h, colors.accent, Math.min(4, barW / 2));
      }
      if (b.label !== '') text(left + i * slot + slot / 2, base + 28, b.label, 18, 400, colors.textFaint, 'center');
    });
    line(left, base, left + width, base, colors.textFaint, 2);
    if (doc.chart.goal > 0) {
      const goalY = base - (doc.chart.goal / top) * PLOT_H;
      for (let x = left; x < left + width; x += 26) line(x, goalY, Math.min(x + 16, left + width), goalY, colors.textDim, 3);
    }
    text(left, y + 284, doc.chart.caption, 20, 400, colors.textDim, 'left', width);
    y += PANEL_H + 36;
  }

  // The table: a head, then a row a day. It never starts with fewer than three rows at the foot of a page, and every page it runs
  // onto repeats the head.
  const widths = COLUMNS.map((f) => f * CW);
  const lefts = widths.map((_, i) => M + widths.slice(0, i).reduce((a, w) => a + w, 0));
  const drawHead = () => {
    doc.table.head.forEach((h, i) => {
      if (i === 0) text(lefts[0] + 8, y + 34, h, 20, 600, colors.textDim, 'left', widths[0] - 16);
      else if (i === doc.table.head.length - 1) text(lefts[i] + 14 + STAR_SLOT, y + 34, h, 20, 600, colors.textDim, 'left', widths[i] - 28 - STAR_SLOT);
      else text(lefts[i] + widths[i] - 14, y + 34, h, 20, 600, colors.textDim, 'right', widths[i] - 28);
    });
    line(M, y + HEAD_H - 2, W - M, y + HEAD_H - 2, colors.border, 2);
    y += HEAD_H;
  };
  const drawRow = (row: DocRow) => {
    const color = row.dim ? colors.textFaint : colors.text;
    const base = y + 27;
    if (row.perfect) rect(M, y + 2, CW, ROW_H - 4, colors.goldSoft, 10);
    const last = row.cells.length - 1;
    row.cells.forEach((c, i) => {
      if (i === 0) text(lefts[0] + 8, base, c, 21, 400, color, 'left', widths[0] - 16);
      else if (i === last) {
        if (row.perfect) text(lefts[i] + 14, base, '★', 22, 400, colors.gold);
        text(lefts[i] + 14 + STAR_SLOT, base, c, 21, 400, color, 'left', widths[i] - 28 - STAR_SLOT);
      } else text(lefts[i] + widths[i] - 14, base, c, 21, 400, color, 'right', widths[i] - 28);
    });
    line(M, y + ROW_H, W - M, y + ROW_H, colors.border, 1);
    y += ROW_H;
  };
  if (doc.table.rows.length > 0) {
    room(HEAD_H + Math.min(3, doc.table.rows.length) * ROW_H);
    drawHead();
    for (const row of doc.table.rows) {
      if (y + ROW_H > CONTENT_BOTTOM) {
        newPage();
        drawHead();
      }
      drawRow(row);
    }
    y += 36;
  }

  // The medals, in a panel of the reward colour, on the next page if the table left no room for them.
  if (doc.medals.length > 0) {
    const h = doc.medals.length * 40 + 40;
    room(h);
    rect(M, y, CW, h, colors.goldSoft, 20);
    doc.medals.forEach((m, i) => text(M + 28, y + 20 + 28 + i * 40, m, 24, 500, colors.text, 'left', CW - 56));
  }

  // The foot of every page.
  pages.forEach((p, i) => {
    ops = p.ops;
    line(M, FOOT_LINE_Y, W - M, FOOT_LINE_Y, colors.border, 2);
    text(M, FOOT_TEXT_Y, doc.footer, 20, 400, colors.textFaint, 'left', CW - 160);
    text(W - M, FOOT_TEXT_Y, `${i + 1} / ${pages.length}`, 20, 400, colors.textFaint, 'right');
  });
  return pages;
}
