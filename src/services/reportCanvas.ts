import type { JpegPage } from '../core/pdfWriter';
import type { ReportColors, ReportDoc } from '../core/reportDoc';
import { layoutReport, LOGO, PAGE, REPORT_FONTS, type Measure, type Op, type Page } from '../core/reportLayout';

/**
 * The monthly report drawn in the browser: `layoutReport` decides where everything goes (with the canvas measuring the text, so a
 * Marathi or Hindi line is as wide here as it will be drawn, and its letters join as the browser's own text engine joins them), and
 * this draws each page on a 1240 x 1754 canvas and turns it into a JPEG for the PDF writer. Web only: every use of the DOM is in a
 * function that is called only there.
 */
const JPEG_QUALITY = 0.9;

function newCanvas(): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('The report is drawn in a browser.');
  const canvas = document.createElement('canvas');
  canvas.width = PAGE.width;
  canvas.height = PAGE.height;
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the report.');
  return ctx;
}

/** The canvas's own text measure: how wide `text` is in the report's fonts. */
function canvasMeasure(): Measure {
  const ctx = context(newCanvas());
  return (text, size, weight) => {
    ctx.font = `${weight} ${size}px ${REPORT_FONTS}`;
    return ctx.measureText(text).width;
  };
}

/** A rounded rectangle as a path (the browser's own `roundRect` is newer than the browsers that share files). */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawOp(ctx: CanvasRenderingContext2D, op: Op): void {
  if (op.kind === 'rect') {
    ctx.fillStyle = op.fill;
    if (op.r) {
      roundedRect(ctx, op.x, op.y, op.w, op.h, op.r);
      ctx.fill();
    } else {
      ctx.fillRect(op.x, op.y, op.w, op.h);
    }
  } else if (op.kind === 'line') {
    ctx.strokeStyle = op.color;
    ctx.lineWidth = op.width;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(op.x1, op.y1);
    ctx.lineTo(op.x2, op.y2);
    ctx.stroke();
  } else if (op.kind === 'text') {
    ctx.font = `${op.weight} ${op.size}px ${REPORT_FONTS}`;
    ctx.fillStyle = op.color;
    ctx.textAlign = op.align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(op.text, op.x, op.y);
  } else {
    // The mark, as src/ui/Logo.tsx draws it, scaled from its 100-unit box.
    ctx.save();
    ctx.translate(op.x, op.y);
    ctx.scale(op.size / LOGO.box, op.size / LOGO.box);
    ctx.fillStyle = op.fill;
    roundedRect(ctx, 0, 0, LOGO.box, LOGO.box, LOGO.radius);
    ctx.fill();
    ctx.strokeStyle = op.ink;
    ctx.lineWidth = LOGO.stroke;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(LOGO.path));
    ctx.fillStyle = op.ink;
    ctx.beginPath();
    ctx.arc(LOGO.dot.cx, LOGO.dot.cy, LOGO.dot.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPage(page: Page): HTMLCanvasElement {
  const canvas = newCanvas();
  const ctx = context(canvas);
  for (const op of page.ops) drawOp(ctx, op);
  return canvas;
}

/** The report's pages drawn on A4 canvases of 1240 x 1754 px. */
export function drawReportPages(doc: ReportDoc, colors: ReportColors): HTMLCanvasElement[] {
  return layoutReport(doc, colors, canvasMeasure()).map(drawPage);
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('This browser could not make the picture of a page.'))), 'image/jpeg', JPEG_QUALITY);
  });
}

/** Each page as a JPEG of quality 0.9, ready for `pdfFromJpegs`. One page at a time, so a long report never holds every canvas at once. */
export async function reportJpegPages(doc: ReportDoc, colors: ReportColors): Promise<JpegPage[]> {
  const pages = layoutReport(doc, colors, canvasMeasure());
  const out: JpegPage[] = [];
  for (const page of pages) {
    const blob = await toJpeg(drawPage(page));
    out.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: page.width, height: page.height });
  }
  return out;
}
