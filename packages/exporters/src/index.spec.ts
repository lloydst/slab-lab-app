import { describe, expect, it } from 'vitest';
import { SvgExporter, svgDocumentDimensions, templateToSvg } from './index';
describe('SVG exporter', () => {
  it('preserves millimetre dimensions and labels', () => {
    const svg = templateToSvg({
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
      ],
      dimensions: { width: 10, height: 20 },
      unit: 'mm',
      notes: [],
    });
    expect(svg).toContain('width="74mm"');
    expect(svg).toContain('50 mm calibration');
    expect(svg).toContain('1 Wall');
    expect(svg).toContain('Print at 100%');
    expect(
      svgDocumentDimensions({
        paths: [],
        dimensions: { width: 10, height: 20 },
        unit: 'mm',
        notes: [],
      }),
    ).toEqual({ width: 74, height: 114 });
  });

  it('creates a downloadable UTF-8 SVG blob', async () => {
    const blob = await new SvgExporter().export({
      paths: [],
      dimensions: { width: 50, height: 50 },
      unit: 'mm',
      notes: [],
    });
    expect(blob.type).toBe('image/svg+xml;charset=utf-8');
    expect(await blob.text()).toContain('<svg');
  });
});
