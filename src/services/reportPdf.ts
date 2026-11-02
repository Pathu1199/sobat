import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { A4_PT, pdfFromJpegs } from '../core/pdfWriter';
import type { ReportColors, ReportDoc } from '../core/reportDoc';
import { reportHtml } from '../core/reportHtml';
import { reportJpegPages } from './reportCanvas';

/**
 * Making the monthly report a PDF and sharing it. On the phone apps `expo-print` prints the HTML to a file and `expo-sharing` opens
 * the share sheet on it. On the web there is no file to print to, so the pages are drawn on canvases (reportCanvas), joined into a PDF
 * by `pdfFromJpegs` and shared as a `File` with the browser's Share sheet, or downloaded where the browser cannot share files.
 *
 * Safari only allows a share straight from a tap, and making the PDF takes a moment, so it is two steps: `prepareReport`, then
 * `shareReport` on the next tap. The phone apps can do both on one tap.
 */
export type PreparedReport = { kind: 'native'; uri: string } | { kind: 'web'; file: File; canShare: boolean };

const isWeb = Platform.OS === 'web';

/** 14 mm of paper round the page, in points. iOS prints the HTML without its `@page` margin and takes these instead; Android does the opposite, so the HTML's 14 mm and this are the same. */
const PAGE_MARGINS = { top: 40, right: 40, bottom: 40, left: 40 };

export async function prepareReport(doc: ReportDoc, colors: ReportColors): Promise<PreparedReport> {
  if (!isWeb) {
    const { uri } = await Print.printToFileAsync({ html: reportHtml(doc, colors), width: A4_PT.width, height: A4_PT.height, margins: PAGE_MARGINS });
    return { kind: 'native', uri };
  }
  const bytes = pdfFromJpegs(await reportJpegPages(doc, colors), `${doc.title} ${doc.month}`);
  const file = new File([bytes as BlobPart], doc.fileName, { type: 'application/pdf' });
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  return { kind: 'web', file, canShare };
}

/** A cancelled share sheet rejects with an AbortError: the user changed their mind, which is not a failure. */
function cancelled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/** Saves the file through a link the browser clicks, then lets go of its address a moment later. */
function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function shareReport(prepared: PreparedReport, dialogTitle: string): Promise<void> {
  if (prepared.kind === 'native') {
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(prepared.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
    return;
  }
  if (prepared.canShare) {
    try {
      await navigator.share({ files: [prepared.file], title: dialogTitle });
      return;
    } catch (error) {
      // A cancelled sheet is the end of it. Any other refusal (NotAllowedError when the tap's allowance has run out, TypeError when the
      // browser will not take the file) is no reason to leave the user with nothing: the file is saved instead.
      if (cancelled(error)) return;
    }
  }
  download(prepared.file);
}
