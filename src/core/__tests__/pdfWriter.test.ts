import { describe, expect, it } from 'vitest';
import { A4_PT, pdfFromJpegs, type JpegPage } from '../pdfWriter';

// One byte per character, so a string index is a byte offset.
function latin1(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

// The writer never parses a JPEG, so a few bytes with the JPEG markers and some
// high bytes stand in for one. `seed` makes each fake different.
function fakeJpeg(length: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) bytes[i] = (seed * 31 + i * 7) & 0xff;
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[length - 2] = 0xff;
  bytes[length - 1] = 0xd9;
  return bytes;
}

function page(length: number, seed: number): JpegPage {
  return { jpeg: fakeJpeg(length, seed), width: 1240, height: 1754 };
}

// Where the cross-reference table starts. `startxref` also ends in "xref\n", so
// look for the table's own line.
function xrefStart(text: string): number {
  return text.lastIndexOf('\nxref\n') + 1;
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

describe('pdfFromJpegs', () => {
  it('says A4 in points', () => {
    expect(A4_PT).toEqual({ width: 595, height: 842 });
  });

  it('starts with the PDF 1.4 header and a binary comment line', () => {
    const pdf = pdfFromJpegs([page(40, 1)]);
    const text = latin1(pdf);
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    // The second line is a comment holding bytes of 128 or more, so file
    // transfer tools treat the file as binary.
    const second = text.split('\n')[1];
    expect(second.startsWith('%')).toBe(true);
    expect(second.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < 5; i += 1) expect(second.charCodeAt(i)).toBeGreaterThanOrEqual(128);
  });

  it('ends with %%EOF and a newline', () => {
    const text = latin1(pdfFromJpegs([page(40, 1), page(50, 2)]));
    expect(text.endsWith('%%EOF\n')).toBe(true);
  });

  it('points every xref offset at the bytes of its object', () => {
    const text = latin1(pdfFromJpegs([page(40, 1), page(55, 2), page(70, 3)]));
    const xrefAt = xrefStart(text);
    const lines = text.slice(xrefAt).split('\n');
    expect(lines[0]).toBe('xref');
    const [first, count] = lines[1].split(' ').map(Number);
    expect(first).toBe(0);
    const entries = lines.slice(2, 2 + count);
    // Entry 0 is the free list head; every other entry is in use.
    expect(entries[0]).toBe('0000000000 65535 f ');
    for (let n = 1; n < count; n += 1) {
      expect(entries[n]).toMatch(/^\d{10} 00000 n $/);
      const offset = Number(entries[n].slice(0, 10));
      expect(text.startsWith(`${n} 0 obj`, offset)).toBe(true);
    }
  });

  it('writes each xref entry as exactly 20 bytes', () => {
    const text = latin1(pdfFromJpegs([page(40, 1), page(55, 2)]));
    const xrefAt = xrefStart(text);
    const afterHeader = text.indexOf('\n', text.indexOf('\n', xrefAt) + 1) + 1;
    const trailerAt = text.indexOf('trailer', afterHeader);
    const table = text.slice(afterHeader, trailerAt);
    expect(table.length % 20).toBe(0);
    expect(table.length / 20).toBe(Number(text.slice(xrefAt).split('\n')[1].split(' ')[1]));
  });

  it('points startxref at the xref table', () => {
    const text = latin1(pdfFromJpegs([page(40, 1), page(55, 2)]));
    const match = /startxref\n(\d+)\n%%EOF\n$/.exec(text);
    expect(match).not.toBeNull();
    expect(text.startsWith('xref\n', Number(match![1]))).toBe(true);
  });

  it('sizes the trailer to the objects and names the catalog as root', () => {
    // Catalog, Pages, then Page + Image + Content per page, and no Info.
    const text = latin1(pdfFromJpegs([page(40, 1), page(55, 2)]));
    expect(text).toContain('/Size 9');
    expect(text).toContain('/Root 1 0 R');
    expect(text).not.toContain('/Info');
  });

  it('counts the pages', () => {
    for (const n of [1, 2, 5]) {
      const pages = Array.from({ length: n }, (_, i) => page(40 + i, i));
      const text = latin1(pdfFromJpegs(pages));
      expect(text).toContain(`/Count ${n}`);
      expect(text.match(/\/Type \/Page\b(?!s)/g)).toHaveLength(n);
      expect(text.match(/\/MediaBox \[0 0 595 842\]/g)).toHaveLength(n);
    }
  });

  it('lists the page objects as the kids of the page tree', () => {
    const text = latin1(pdfFromJpegs([page(40, 1), page(55, 2)]));
    expect(text).toContain('/Kids [3 0 R 6 0 R]');
    expect(text).toContain('/Parent 2 0 R');
  });

  it('keeps each image stream the exact length of its JPEG, bytes intact', () => {
    const pages = [page(40, 1), page(321, 2), page(1000, 3)];
    const pdf = pdfFromJpegs(pages);
    const text = latin1(pdf);
    const images = [...text.matchAll(/\/Subtype \/Image[^>]*\/Length (\d+)[^>]*>>\nstream\n/g)];
    expect(images).toHaveLength(pages.length);
    images.forEach((match, i) => {
      expect(Number(match[1])).toBe(pages[i].jpeg.length);
      const start = match.index! + match[0].length;
      expect(Array.from(pdf.slice(start, start + pages[i].jpeg.length))).toEqual(
        Array.from(pages[i].jpeg),
      );
      expect(text.startsWith('\nendstream\nendobj\n', start + pages[i].jpeg.length)).toBe(true);
      expect(indexOfBytes(pdf, pages[i].jpeg)).toBe(start);
    });
  });

  it('describes each image as 8-bit DeviceRGB DCT with its pixel size', () => {
    const text = latin1(
      pdfFromJpegs([
        { jpeg: fakeJpeg(40, 1), width: 1240, height: 1754 },
        { jpeg: fakeJpeg(40, 2), width: 600, height: 800 },
      ]),
    );
    expect(text).toContain(
      '/Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length 40',
    );
    expect(text).toContain('/Width 600 /Height 800');
  });

  it('draws each image to fill its whole page', () => {
    const text = latin1(pdfFromJpegs([page(40, 1), page(55, 2)]));
    expect(text).toContain('/Resources << /XObject << /Im1 4 0 R >> >>');
    expect(text).toContain('/Resources << /XObject << /Im2 7 0 R >> >>');
    const content1 = 'q 595 0 0 842 0 0 cm /Im1 Do Q\n';
    expect(text).toContain(
      `<< /Length ${content1.length} >>\nstream\n${content1}endstream\nendobj\n`,
    );
    const content2 = 'q 595 0 0 842 0 0 cm /Im2 Do Q\n';
    expect(text).toContain(`stream\n${content2}endstream`);
    expect(text).toContain('/Contents 5 0 R');
    expect(text).toContain('/Contents 8 0 R');
  });

  it('writes no Info without a title', () => {
    expect(latin1(pdfFromJpegs([page(40, 1)]))).not.toContain('/Title');
  });

  it('writes a plain title as a string', () => {
    const text = latin1(pdfFromJpegs([page(40, 1)], 'Monthly report'));
    expect(text).toContain('/Title (Monthly report)');
    expect(text).toMatch(/\/Info \d+ 0 R/);
  });

  it('escapes parentheses and backslashes in a title', () => {
    const text = latin1(pdfFromJpegs([page(40, 1)], 'Report (Oct) 2026 \\ draft'));
    expect(text).toContain('/Title (Report \\(Oct\\) 2026 \\\\ draft)');
  });

  it('writes a Marathi title as a UTF-16BE hex string with a byte order mark', () => {
    const text = latin1(pdfFromJpegs([page(40, 1)], 'ध्येय'));
    // ध U+0927, ् U+094D, ये U+092F U+0947, य U+092F.
    expect(text).toContain('/Title <FEFF0927094D092F0947092F>');
  });

  it('writes a title outside the basic plane as a surrogate pair', () => {
    const text = latin1(pdfFromJpegs([page(40, 1)], 'A\u{1F600}'));
    expect(text).toContain('/Title <FEFF0041D83DDE00>');
  });

  it('points the Info entry at a real object when there is a title', () => {
    const text = latin1(pdfFromJpegs([page(40, 1), page(55, 2)], 'Report'));
    const info = /\/Info (\d+) 0 R/.exec(text);
    expect(info).not.toBeNull();
    const n = Number(info![1]);
    expect(text).toContain(`${n} 0 obj\n<< /Title (Report) >>\nendobj\n`);
    expect(text).toContain('/Size 10');
    const xrefAt = xrefStart(text);
    const entries = text.slice(xrefAt).split('\n').slice(2);
    expect(text.startsWith(`${n} 0 obj`, Number(entries[n].slice(0, 10)))).toBe(true);
  });

  it('throws on zero pages', () => {
    expect(() => pdfFromJpegs([])).toThrow();
  });

  it('throws on a page with no bytes or a size that is not a whole positive number', () => {
    expect(() => pdfFromJpegs([{ jpeg: new Uint8Array(0), width: 10, height: 10 }])).toThrow();
    expect(() => pdfFromJpegs([{ jpeg: fakeJpeg(10, 1), width: 0, height: 10 }])).toThrow();
    expect(() => pdfFromJpegs([{ jpeg: fakeJpeg(10, 1), width: 10, height: 1.5 }])).toThrow();
    expect(() => pdfFromJpegs([{ jpeg: fakeJpeg(10, 1), width: NaN, height: 10 }])).toThrow();
  });
});
