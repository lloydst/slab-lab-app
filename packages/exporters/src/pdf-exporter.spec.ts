import type { SlabTemplate } from '@slablab/geometry-engine';
import { describe, expect, it } from 'vitest';
import { PdfExporter } from './pdf-exporter';

const template: SlabTemplate = {
  paths: [
    {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 20 },
      ],
      closed: true,
      kind: 'cut',
      label: 'Wall',
      assemblyNumber: 1,
    },
    {
      points: [
        { x: 0, y: 10 },
        { x: 10, y: 10 },
      ],
      closed: false,
      kind: 'fold',
    },
  ],
  dimensions: { width: 10, height: 20 },
  unit: 'mm',
  notes: [],
};

const blobText = async (blob: Blob) => new TextDecoder('windows-1252').decode(await blob.arrayBuffer());

describe('PDF exporter', () => {
  it('writes a single-page PDF at the exact template size', async () => {
    const blob = await new PdfExporter().export(template);
    const pdf = await blobText(blob);

    expect(blob.type).toBe('application/pdf');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('/MediaBox [0 0 96.378 181.417]');
    expect(pdf).toContain('/BaseFont /Helvetica');
    expect(pdf).toContain('xref');
    expect(pdf).toContain('%%EOF');
  });

  it('writes cut, fold, closed-path, and label instructions', async () => {
    const pdf = await blobText(await new PdfExporter().export(template));

    expect(pdf).toContain('0.992 w\n[] 0 d');
    expect(pdf).toContain('0.709 w\n[8.504 5.669] 0 d');
    expect(pdf).toContain('\nh\nS');
    expect(pdf).toContain('<312057616c6c> Tj');
  });

  it('writes a valid startxref offset', async () => {
    const pdf = await blobText(await new PdfExporter().export(template));
    const offset = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);

    expect(offset).toBeGreaterThan(0);
    expect(pdf.slice(offset, offset + 4)).toBe('xref');
  });
});
