/**
 * A PDF writer with no library behind it: JPEG pages in, PDF 1.4 bytes out.
 *
 * The monthly report is drawn on A4 canvases in the browser and sent through
 * here, so this only has to do one thing, one full-page JPEG per page. It works
 * on plain bytes, so it runs the same in React Native, the browser and node.
 *
 * File layout, with object numbers:
 *   1  Catalog
 *   2  Pages
 *   per page i (0-based): 3+3i Page, 4+3i Image, 5+3i Content stream
 *   last, if there is a title: Info
 * followed by the cross-reference table and the trailer.
 */

export type JpegPage = { jpeg: Uint8Array; width: number; height: number }; // pixel size of the JPEG

export const A4_PT = { width: 595, height: 842 };

// The second line of the file: a comment of bytes 128 and over, which is how a
// reader (and a file transfer tool) knows the file holds binary data.
const BINARY_COMMENT = new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);

// Text parts are plain ASCII, so one byte per character. TextEncoder would
// turn anything over 127 into UTF-8, which is wrong for binary.
function latin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function isWholePositive(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

// A PDF string for the title. Printable ASCII goes in as a literal string with
// ( ) and \ escaped; anything else goes in as UTF-16BE hex with a byte order
// mark, which is how a PDF reader knows it is not Latin-1.
function pdfString(text: string): string {
  let plain = true;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) {
      plain = false;
      break;
    }
  }
  if (plain) return `(${text.replace(/[()\\]/g, (c) => `\\${c}`)})`;
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i += 1) {
    hex += text.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  }
  return `<${hex}>`;
}

export function pdfFromJpegs(pages: JpegPage[], title?: string): Uint8Array {
  if (pages.length === 0) throw new Error('A PDF needs at least one page.');
  for (const p of pages) {
    if (p.jpeg.length === 0) throw new Error('A PDF page needs JPEG bytes.');
    if (!isWholePositive(p.width) || !isWholePositive(p.height)) {
      throw new Error('A PDF page needs a whole, positive pixel width and height.');
    }
  }

  const parts: Uint8Array[] = [];
  // Byte offset where each object starts, by object number (index 0 is unused).
  const offsets: number[] = [0];
  let size = 0;

  const push = (part: Uint8Array) => {
    parts.push(part);
    size += part.length;
  };
  const text = (value: string) => push(latin1(value));
  const startObject = (n: number) => {
    offsets[n] = size;
    text(`${n} 0 obj\n`);
  };

  const count = pages.length;
  const infoNumber = title === undefined ? 0 : 3 + 3 * count;
  const total = (title === undefined ? 2 : 3) + 3 * count; // objects, not counting the free head

  text('%PDF-1.4\n');
  push(BINARY_COMMENT);

  startObject(1);
  text('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ');
  startObject(2);
  text(`<< /Type /Pages /Kids [${kids}] /Count ${count} >>\nendobj\n`);

  pages.forEach((p, i) => {
    const pageNumber = 3 + 3 * i;
    const imageNumber = pageNumber + 1;
    const contentNumber = pageNumber + 2;
    const name = `Im${i + 1}`;

    startObject(pageNumber);
    text(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT.width} ${A4_PT.height}] ` +
        `/Resources << /XObject << /${name} ${imageNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>\n` +
        'endobj\n',
    );

    startObject(imageNumber);
    text(
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\n` +
        'stream\n',
    );
    push(p.jpeg);
    text('\nendstream\nendobj\n');

    // Scale the unit square to the page, then draw the image into it.
    const draw = `q ${A4_PT.width} 0 0 ${A4_PT.height} 0 0 cm /${name} Do Q\n`;
    startObject(contentNumber);
    text(`<< /Length ${draw.length} >>\nstream\n${draw}endstream\nendobj\n`);
  });

  if (title !== undefined) {
    startObject(infoNumber);
    text(`<< /Title ${pdfString(title)} >>\nendobj\n`);
  }

  // Every line is 20 bytes: ten digits, a space, five digits, a space, the
  // type, a space and a newline.
  const xrefAt = size;
  let table = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= total; n += 1) {
    table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  const info = title === undefined ? '' : ` /Info ${infoNumber} 0 R`;
  table += `trailer\n<< /Size ${total + 1} /Root 1 0 R${info} >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  text(table);

  return concat(parts);
}
