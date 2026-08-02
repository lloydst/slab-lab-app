import { OvalBoxShape, type SlabTemplate } from '@slablab/geometry-engine';
import { describe, expect, it } from 'vitest';
import { PdfExporter } from './pdf-exporter';

const readPdf = async (template: SlabTemplate) =>
  new TextDecoder('windows-1252').decode(await (await new PdfExporter().export(template)).arrayBuffer());

describe('PDF exporter', () => {
  it('uses true-size A4 pages with a 50 mm calibration square', async () => {
    const pdf = await readPdf({ paths: [], dimensions: { width: 100, height: 100 }, unit: 'mm', notes: [] });
    expect(pdf).toContain('/MediaBox [0 0 595.276 841.89]');
    expect(pdf).toContain('34.016 34.016 141.732 141.732 re S');
    expect(pdf).toContain('0.714 0.31 0.184 RG');
    expect(pdf).toContain('0.157 0.388 0.247 rg');
    expect(pdf).toContain('/Count 1');
  });

  it('tiles an oversized oval-box template across multiple A4 pages', async () => {
    const template = new OvalBoxShape({
      width: 170,
      depth: 110,
      height: 80,
      roundness: 80,
      wallThickness: 6,
    }).generateTemplate();
    const pdf = await readPdf(template);
    const pageCount = Number(/\/Count (\d+)/.exec(pdf)?.[1]);
    expect(pageCount).toBeGreaterThan(1);
    expect(pdf.match(/\/Type \/Page /g) ?? []).toHaveLength(pageCount);
    expect(pdf.match(/34\.016 34\.016 141\.732 141\.732 re S/g) ?? []).toHaveLength(pageCount);
  });

  it('uses the full page edges in optional borderless mode', async () => {
    const template = { paths: [], dimensions: { width: 200, height: 200 }, unit: 'mm' as const, notes: [] };
    const pdf = new TextDecoder('windows-1252').decode(
      await (await new PdfExporter({ borderless: true }).export(template)).arrayBuffer(),
    );
    expect(pdf).toContain('0 232.441 595.276 609.449 re W n');
    expect(pdf).toContain('/MediaBox [0 0 595.276 841.89]');
  });
});
