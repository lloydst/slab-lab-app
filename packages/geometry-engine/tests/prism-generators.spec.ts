import { describe, expect, it } from 'vitest';
import { PolygonPrismGenerator } from '../src/generators/polygon-prism-generator';
import { TaperedBoxGenerator } from '../src/generators/tapered-box-generator';

describe('prismatic generators', () => {
  it('supports tapered polygon prisms without bases and with closed tops', () => {
    const shape = new PolygonPrismGenerator({ sides: 5, bottomRadius: 40, topRadius: 25, height: 80, wallThickness: 4, includeBase: 0, closedTop: 1 });
    expect(shape.generatePanels()).toHaveLength(6);
    expect(shape.generateTemplate().paths.at(-1)?.label).toBe('Top');
    expect(shape.generateMesh().vertices).toHaveLength(11);
    expect(shape.calculateDimensions()).toEqual({ width: 80, depth: 80, height: 80 });
    expect(shape.calculateSurfaceArea()).toBeGreaterThan(0);
    expect(shape.calculateVolume()).toBeGreaterThan(0);
    expect(shape.validate()).toEqual([]);
  });

  it('uses the bottom radius when a polygon top radius is omitted', () => {
    const shape = new PolygonPrismGenerator({ sides: 4, bottomRadius: 30, height: 50, wallThickness: 3, includeBase: 1, closedTop: 0 });
    expect(shape.calculateDimensions().width).toBe(60);
    expect(shape.generatePanels()).toHaveLength(5);
  });

  it('rejects polygon side counts outside the supported range', () => {
    for (const sides of [2, 65]) {
      const shape = new PolygonPrismGenerator({ sides, bottomRadius: 30, topRadius: 30, height: 50, wallThickness: 3, includeBase: 1 });
      expect(shape.validate()).toContainEqual({ field: 'sides', message: 'Must be an integer from 3 to 64' });
    }
  });

  it('calculates tapered-box dimensions, panels, area, and frustum volume', () => {
    const shape = new TaperedBoxGenerator({ bottomWidth: 100, bottomDepth: 80, topWidth: 70, topDepth: 60, height: 90, wallThickness: 5, includeBase: 0, closedTop: 1 });
    expect(shape.generatePanels()).toHaveLength(5);
    expect(shape.generateTemplate().paths.at(-1)?.label).toBe('Top');
    expect(shape.generateMesh().vertices).toHaveLength(9);
    expect(shape.calculateDimensions()).toEqual({ width: 100, depth: 80, height: 90 });
    expect(shape.calculateSurfaceArea()).toBeGreaterThan(8000);
    expect(shape.calculateVolume()).toBeGreaterThan(400_000);
  });

  it('rejects non-positive and interior-consuming tapered-box dimensions', () => {
    const shape = new TaperedBoxGenerator({ bottomWidth: 20, bottomDepth: 20, topWidth: 10, topDepth: 10, height: 0, wallThickness: 6, includeBase: 1 });
    expect(shape.validate().map((issue) => issue.field)).toEqual(expect.arrayContaining(['height', 'wallThickness']));
  });
});
