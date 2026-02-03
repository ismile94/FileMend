import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  PageBreak,
  HeadingLevel,
  convertInchesToTwip,
} from 'docx';
import { readFileAsArrayBuffer } from '@/utils/fileHelpers';

// PDF.js worker (same pattern as PDFCompress)
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

const MAX_FILE_SIZE_MB = 50;
const BACKEND_API_URL = import.meta.env.VITE_PDF_TO_DOCX_API_URL as string | undefined;

// PDF uses points (1/72 inch). Word OOXML uses twips (1/20 point). 1 pt = 20 twips.
const PT_TO_TWIPS = 20;
const DEFAULT_MARGIN_PT = 72; // 1 inch
const LINE_Y_TOLERANCE_PT = 3; // same line if Y within 3 pt
const PARAGRAPH_GAP_FACTOR = 1.4; // new paragraph if vertical gap > avgLineHeight * this
const SPACE_GAP_PT = 2; // gap between items > this → insert space

interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
}

function parsePdfTextItems(
  items: Array<Record<string, unknown>>,
  viewport: { height: number }
): PdfTextItem[] {
  const result: PdfTextItem[] = [];
  for (const item of items) {
    if (!('str' in item) || typeof (item as { str: string }).str !== 'string') continue;
    const str = (item as { str: string }).str;
    const transform = (item as { transform?: number[] }).transform;
    const width = typeof (item as { width?: number }).width === 'number' ? (item as { width: number }).width : 0;
    const height = typeof (item as { height?: number }).height === 'number' ? (item as { height: number }).height : 12;
    const fontName = typeof (item as { fontName?: string }).fontName === 'string' ? (item as { fontName: string }).fontName : '';
    let x = 0,
      y = 0;
    if (Array.isArray(transform) && transform.length >= 6) {
      x = transform[4];
      y = transform[5];
    }
    // PDF Y is bottom-up; convert to top-down for sorting (higher yTop = higher on page)
    const yTop = viewport.height - y;
    result.push({ str, x, y: yTop, width, height, fontName });
  }
  return result;
}

function groupItemsIntoLines(items: PdfTextItem[]): { line: PdfTextItem[]; minX: number; maxX: number; avgHeight: number }[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => {
    const dy = a.y - b.y;
    if (Math.abs(dy) > LINE_Y_TOLERANCE_PT) return dy;
    return a.x - b.x;
  });
  const lines: { line: PdfTextItem[]; minX: number; maxX: number; avgHeight: number }[] = [];
  let current: PdfTextItem[] = [];
  let refY = sorted[0].y;
  let minX = sorted[0].x;
  let maxX = sorted[0].x + sorted[0].width;
  let sumHeight = 0;

  for (const it of sorted) {
    if (Math.abs(it.y - refY) <= LINE_Y_TOLERANCE_PT) {
      current.push(it);
      minX = Math.min(minX, it.x);
      maxX = Math.max(maxX, it.x + it.width);
      sumHeight += it.height;
    } else {
      if (current.length > 0) {
        lines.push({
          line: current,
          minX,
          maxX,
          avgHeight: sumHeight / current.length,
        });
      }
      current = [it];
      refY = it.y;
      minX = it.x;
      maxX = it.x + it.width;
      sumHeight = it.height;
    }
  }
  if (current.length > 0) {
    lines.push({ line: current, minX, maxX, avgHeight: sumHeight / current.length });
  }
  return lines;
}

function lineToRuns(
  line: PdfTextItem[],
  defaultSizePt: number
): { text: string; sizePt: number; fontName: string }[] {
  const sorted = [...line].sort((a, b) => a.x - b.x);
  const runs: { text: string; sizePt: number; fontName: string }[] = [];
  let lastEndX = -1000;
  for (const it of sorted) {
    const gap = it.x - lastEndX;
    const space = gap > SPACE_GAP_PT ? ' ' : '';
    const sizePt = it.height > 0 ? it.height : defaultSizePt;
    const last = runs[runs.length - 1];
    const canAppend = last && last.sizePt === sizePt && last.fontName === it.fontName;
    if (canAppend) {
      last.text += space + it.str;
    } else {
      runs.push({ text: (runs.length ? space : '') + it.str, sizePt, fontName: it.fontName });
    }
    lastEndX = it.x + it.width;
  }
  return runs.filter((r) => r.text.length > 0);
}

function mapPdfFontToWordFont(pdfFontName: string): string {
  const lower = pdfFontName.toLowerCase();
  if (lower.includes('arial') || lower.includes('helvetica')) return 'Arial';
  if (lower.includes('times') || lower.includes('serif')) return 'Times New Roman';
  if (lower.includes('courier') || lower.includes('mono')) return 'Courier New';
  return 'Times New Roman';
}

function getHeadingLevel(sizePt: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined {
  if (sizePt >= 16) return HeadingLevel.HEADING_1;
  if (sizePt >= 14) return HeadingLevel.HEADING_2;
  if (sizePt >= 12) return HeadingLevel.HEADING_3;
  return undefined;
}

export const usePDFToWord = () => {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState<string | undefined>();

  const convertViaBackend = useCallback(
    async (file: File, onProgress: (p: number, msg?: string) => void): Promise<Blob> => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${BACKEND_API_URL}/convert`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail || res.statusText);
      }

      const blob = await res.blob();
      onProgress(100, 'docx');
      return blob;
    },
    []
  );

  const convertClientSide = useCallback(
    async (file: File, onProgress: (p: number, msg?: string) => void): Promise<Blob> => {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;
      const allParagraphs: Paragraph[] = [];
      let defaultBodySizePt = 11;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        onProgress(Math.round((pageNum / numPages) * 90), 'extract');
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const items = parsePdfTextItems(textContent.items as Array<Record<string, unknown>>, viewport);
        if (items.length === 0) {
          if (pageNum < numPages) {
            allParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
          }
          continue;
        }

        const lines = groupItemsIntoLines(items);
        const marginLeftPt = DEFAULT_MARGIN_PT;
        let prevBottomY = -1000;
        let avgLineHeightPt = lines.length ? lines.reduce((s, l) => s + l.avgHeight, 0) / lines.length : 12;
        if (avgLineHeightPt <= 0) avgLineHeightPt = 12;

        for (let i = 0; i < lines.length; i++) {
          const { line, minX, avgHeight } = lines[i];
          const lineRuns = lineToRuns(line, defaultBodySizePt);
          const firstRun = lineRuns[0];
          const firstSizePt = firstRun?.sizePt ?? defaultBodySizePt;
          if (defaultBodySizePt === 11 && firstSizePt > 0) defaultBodySizePt = Math.min(12, firstSizePt);

          const indentLeftPt = Math.max(0, minX - marginLeftPt);
          const indentLeftTwips = Math.round(indentLeftPt * PT_TO_TWIPS);
          const spaceBeforePt = prevBottomY >= 0 ? line[0].y - prevBottomY - avgLineHeightPt : 0;
          const spaceBeforeTwips =
            spaceBeforePt > avgLineHeightPt * (PARAGRAPH_GAP_FACTOR - 1)
              ? Math.round(spaceBeforePt * PT_TO_TWIPS)
              : 0;

          const children = lineRuns.map(
            (r) =>
              new TextRun({
                text: r.text,
                size: Math.round(r.sizePt * 2),
                font: mapPdfFontToWordFont(r.fontName),
              })
          );
          const headingLevel = getHeadingLevel(firstSizePt);
          const isLikelyHeading =
            headingLevel != null &&
            (lineRuns.length <= 2 || firstSizePt >= defaultBodySizePt + 2) &&
            line.map((it) => it.str).join('').trim().length < 120;

          allParagraphs.push(
            new Paragraph({
              children,
              indent: { left: indentLeftTwips },
              spacing: {
                before: spaceBeforeTwips,
                after: 0,
                line: Math.round(avgHeight * PT_TO_TWIPS * 1.15),
              },
              ...(isLikelyHeading && headingLevel ? { heading: headingLevel } : {}),
            })
          );
          const lastItem = line[line.length - 1];
          prevBottomY = lastItem.y + lastItem.height;
        }

        if (pageNum < numPages) {
          allParagraphs.push(new Paragraph({ children: [new PageBreak()] }));
        }
      }

      onProgress(95, 'docx');
      const sectionChildren =
        allParagraphs.length > 0 ? allParagraphs : [new Paragraph({ children: [new TextRun('')] })];
      const doc = new Document({
        sections: [
          {
properties: {
                page: {
                  margin: {
                    top: convertInchesToTwip(1),
                    right: convertInchesToTwip(1),
                    bottom: convertInchesToTwip(1),
                    left: convertInchesToTwip(1),
                  },
                },
              },
            children: sectionChildren,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      onProgress(100, 'docx');
      return blob;
    },
    []
  );

  const convertToDocx = useCallback(
    async (file: File): Promise<Blob> => {
      setProcessing(true);
      setProgress(0);
      setStageMessage(undefined);

      const onProgress = (p: number, msg?: string) => {
        setProgress(p);
        setStageMessage(msg);
      };

      try {
        if (BACKEND_API_URL?.trim()) {
          return await convertViaBackend(file, onProgress);
        }
        return await convertClientSide(file, onProgress);
      } finally {
        setProcessing(false);
        setProgress(100);
      }
    },
    [convertViaBackend, convertClientSide]
  );

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return 'Only PDF files are allowed';
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      return `File size must be under ${MAX_FILE_SIZE_MB} MB`;
    }
    return null;
  }, []);

  return {
    processing,
    progress,
    stageMessage,
    convertToDocx,
    validateFile,
    maxFileSizeMB: MAX_FILE_SIZE_MB,
  };
};
