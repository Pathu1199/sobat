import { LOGO, REPORT_FONTS } from './reportLayout';
import type { DocRow, DocStat, ReportColors, ReportDoc } from './reportDoc';

/**
 * The monthly report as one HTML document for `expo-print`, which prints it to an A4 PDF on the phone apps: inline CSS, the chart as
 * inline SVG, no script, no link and no image. The sections and their order are the ones `layoutReport` draws on the web. Every string
 * is escaped, the user's name and the words of every language alike. Pure.
 */
function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function css(c: ReportColors): string {
  return `
@page { size: A4; margin: 14mm }
* { box-sizing: border-box }
html, body { margin: 0; padding: 0 }
body { font-family: ${REPORT_FONTS}; color: ${esc(c.text)}; background: ${esc(c.white)}; font-size: 9pt; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.head { display: flex; align-items: center; gap: 4mm; padding-bottom: 4mm; border-bottom: 0.4mm solid ${esc(c.border)} }
.logo { width: 12mm; height: 12mm; flex: none }
.brand { flex: 1; min-width: 0 }
.app { font-size: 17pt; font-weight: 600; line-height: 1.1 }
.sub { font-size: 10pt; color: ${esc(c.textDim)}; margin-top: 0.8mm }
.who { font-size: 13pt; font-weight: 500; text-align: right; max-width: 55mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.summary { font-size: 11.5pt; font-weight: 500; margin: 5mm 0 5mm }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 5mm }
.stat { background: ${esc(c.bg)}; border: 0.3mm solid ${esc(c.border)}; border-radius: 3mm; padding: 3.2mm 4mm; break-inside: avoid; min-width: 0 }
.stat .label { font-size: 8.5pt; font-weight: 500; color: ${esc(c.textDim)} }
.stat .value { font-size: 17pt; font-weight: 600; line-height: 1.2; margin-top: 0.6mm }
.track { height: 1.3mm; border-radius: 1mm; background: ${esc(c.accentSoft)}; margin: 1.6mm 0 }
.fill { height: 100%; border-radius: 1mm; background: ${esc(c.accent)} }
.fill.faint { background: ${esc(c.textFaint)} }
.stat .note { font-size: 8pt; color: ${esc(c.textDim)} }
.delta { font-size: 8pt; color: ${esc(c.textDim)}; margin-top: 0.6mm }
.delta.good { color: ${esc(c.accent)}; font-weight: 600 }
.chart { background: ${esc(c.bg)}; border: 0.3mm solid ${esc(c.border)}; border-radius: 3mm; padding: 3mm 4mm; margin-bottom: 5mm; break-inside: avoid }
.plot { width: 100%; height: auto; display: block }
.plot .bar { fill: ${esc(c.accent)} }
.plot .axis { stroke: ${esc(c.textFaint)}; stroke-width: 1 }
.plot .goal { stroke: ${esc(c.textDim)}; stroke-width: 1.5 }
.plot .day { fill: ${esc(c.textFaint)}; font-size: 11px; text-anchor: middle; font-family: ${REPORT_FONTS} }
.chart .caption { font-size: 8pt; color: ${esc(c.textDim)}; margin-top: 1mm }
.days { width: 100%; border-collapse: collapse; font-size: 8.5pt }
thead { display: table-header-group }
tr { break-inside: avoid }
th { font-size: 8pt; font-weight: 600; color: ${esc(c.textDim)}; text-align: right; padding: 1.4mm 1.6mm; border-bottom: 0.4mm solid ${esc(c.border)} }
td { padding: 1.2mm 1.6mm; text-align: right; border-bottom: 0.2mm solid ${esc(c.border)} }
th:first-child, td:first-child, th:last-child, td:last-child { text-align: left }
tr.perfect td { background: ${esc(c.goldSoft)} }
tr.dim td { color: ${esc(c.textFaint)} }
.star { display: inline-block; width: 4.5mm; color: ${esc(c.gold)} }
.medals { background: ${esc(c.goldSoft)}; border-radius: 3mm; padding: 3mm 5mm; margin-top: 5mm; break-inside: avoid }
.medals p { margin: 1.2mm 0; font-size: 11pt; font-weight: 500 }
.foot { margin-top: 6mm; padding-top: 2.5mm; border-top: 0.3mm solid ${esc(c.border)}; font-size: 8pt; color: ${esc(c.textFaint)} }
`.trim();
}

function logo(c: ReportColors): string {
  return (
    `<svg class="logo" viewBox="0 0 ${LOGO.box} ${LOGO.box}" role="img" aria-label="Dhyey">` +
    `<rect width="${LOGO.box}" height="${LOGO.box}" rx="${LOGO.radius}" fill="${esc(c.accent)}"/>` +
    `<path d="${LOGO.path}" fill="none" stroke="${esc(c.white)}" stroke-width="${LOGO.stroke}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${LOGO.dot.cx}" cy="${LOGO.dot.cy}" r="${LOGO.dot.r}" fill="${esc(c.white)}"/>` +
    `</svg>`
  );
}

function statCard(s: DocStat): string {
  const bar = s.bar === null ? '' : `<div class="track"><div class="fill${s.barTone === 'faint' ? ' faint' : ''}" style="width:${(Math.min(1, Math.max(0, s.bar)) * 100).toFixed(1)}%"></div></div>`;
  return (
    `<div class="stat"><div class="label">${esc(s.label)}</div><div class="value">${esc(s.value)}</div>${bar}` +
    (s.sub === null ? '' : `<div class="note">${esc(s.sub)}</div>`) +
    (s.delta === null ? '' : `<div class="delta${s.delta.good ? ' good' : ''}">${esc(s.delta.text)}</div>`) +
    `</div>`
  );
}

/** The calories chart: a bar a day, the goal as a dashed line, the labelled days named under it, in a 700 x 200 box. */
function chart(doc: ReportDoc, c: ReportColors): string {
  const { bars, goal, caption } = doc.chart;
  const left = 6;
  const width = 688;
  const base = 160;
  const plot = 150;
  const top = Math.max(goal, ...bars.map((b) => b.value), 1) * 1.08;
  const slot = bars.length > 0 ? width / bars.length : width;
  const barW = slot * 0.62;
  const parts: string[] = [];
  bars.forEach((b, i) => {
    const h = (b.value / top) * plot;
    const x = left + i * slot + (slot - barW) / 2;
    parts.push(`<rect class="bar" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`);
    if (b.label !== '') parts.push(`<text class="day" x="${(left + i * slot + slot / 2).toFixed(1)}" y="${base + 20}">${esc(b.label)}</text>`);
  });
  const goalY = (base - (goal / top) * plot).toFixed(1);
  const goalLine = goal > 0 ? `<line class="goal" x1="${left}" y1="${goalY}" x2="${left + width}" y2="${goalY}" stroke-dasharray="6 4"/>` : '';
  return (
    `<div class="chart"><svg class="plot" viewBox="0 0 700 200" role="img" aria-label="${esc(caption)}">` +
    `<line class="axis" x1="${left}" y1="${base}" x2="${left + width}" y2="${base}"/>${parts.join('')}${goalLine}</svg>` +
    `<div class="caption">${esc(caption)}</div></div>`
  );
}

function tableRow(r: DocRow): string {
  const cls = r.perfect ? ' class="perfect"' : r.dim ? ' class="dim"' : '';
  const last = r.cells.length - 1;
  const cells = r.cells.map((cell, i) => (i === last ? `<td class="rec"><span class="star">${r.perfect ? '★' : ''}</span>${esc(cell)}</td>` : `<td>${esc(cell)}</td>`));
  return `<tr${cls}>${cells.join('')}</tr>`;
}

/** The document, in the colours given (daylight ones: a report is on white paper). */
export function reportHtml(doc: ReportDoc, colors: ReportColors): string {
  return (
    `<!doctype html>\n<html lang="${esc(doc.lang)}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${esc(`${doc.title} ${doc.month}`)}</title><style>\n${css(colors)}\n</style></head><body>\n` +
    `<div class="head">${logo(colors)}<div class="brand"><div class="app">${esc(doc.app)}</div><div class="sub">${esc(`${doc.title} · ${doc.month}`)}</div></div>` +
    (doc.name === '' ? '' : `<div class="who">${esc(doc.name)}</div>`) +
    `</div>\n` +
    `<div class="summary">${esc(doc.summary)}</div>\n` +
    (doc.stats.length > 0 ? `<div class="stats">${doc.stats.map(statCard).join('')}</div>\n` : '') +
    `${chart(doc, colors)}\n` +
    `<table class="days"><thead><tr>${doc.table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${doc.table.rows.map(tableRow).join('')}</tbody></table>\n` +
    (doc.medals.length > 0 ? `<div class="medals">${doc.medals.map((m) => `<p>${esc(m)}</p>`).join('')}</div>\n` : '') +
    `<div class="foot">${esc(doc.footer)}</div>\n</body></html>\n`
  );
}
