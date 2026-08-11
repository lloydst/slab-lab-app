import { describe, expect, it } from 'vitest';
import { BoxShape } from '../src/shapes/box-shape';
import { CylinderShape } from '../src/shapes/cylinder-shape';
import { RoundedRectangleBoxShape } from '../src/shapes/rounded-rectangle-box-shape';

describe('basic shape measurements', () => {
  it('calculates cylinder bounds, surface, clay volume, mesh, and template', () => {
    const cylinder = new CylinderShape({ diameter: 100, height: 120, wallThickness: 5 });
    expect(cylinder.calculateDimensions()).toEqual({ width: 100, depth: 100, height: 120 });
    expect(cylinder.calculateBoundingBox()).toEqual(cylinder.calculateDimensions());
    expect(cylinder.calculateSurfaceArea()).toBeCloseTo(17_000 * Math.PI);
    expect(cylinder.calculateVolume()).toBeGreaterThan(0);
    expect(cylinder.generateMesh().indices.length).toBeGreaterThan(0);
    expect(cylinder.generateTemplate().paths).toHaveLength(3);
  });

  it('validates cylinder dimensions and interior wall clearance', () => {
    const cylinder = new CylinderShape({ diameter: 10, height: 0, wallThickness: 5 });
    expect(cylinder.validate().map((issue) => issue.field)).toEqual(expect.arrayContaining(['height', 'wallThickness']));
  });

  it('calculates open box measurements without a lid', () => {
    const box = new BoxShape({ width: 100, depth: 80, height: 60, wallThickness: 5, hasLid: 0, lidStyle: 0, lidClearance: 1, lidLift: 10, lidSkirtHeight: 20 });
    expect(box.calculateDimensions()).toEqual({ width: 100, depth: 80, height: 60 });
    expect(box.calculateSurfaceArea()).toBe(29_600);
    expect(box.calculateVolume()).toBeGreaterThan(0);
    expect(box.generateTemplate().paths).toHaveLength(5);
  });

  it('covers rounded-box base and cap combinations', () => {
    const base = { width: 120, depth: 80, height: 70, cornerRadius: 15, points: 0, wallThickness: 5 };
    const open = new RoundedRectangleBoxShape({ ...base, includeBase: 0, closedTop: 0 });
    const closed = new RoundedRectangleBoxShape({ ...base, includeBase: 1, closedTop: 1 });
    expect(open.generatePanels()).toHaveLength(1);
    expect(open.generateTemplate().paths).toHaveLength(1);
    expect(closed.generatePanels()).toHaveLength(2);
    expect(closed.generateTemplate().paths).toHaveLength(2);
    expect(closed.generateMesh().indices.length).toBeGreaterThan(open.generateMesh().indices.length);
    expect(closed.calculateSurfaceArea()).toBeGreaterThan(open.calculateSurfaceArea());
    expect(closed.calculateVolume()).toBeGreaterThan(0);
  });

  it('validates rounded-box radius, thickness, and positive dimensions', () => {
    const shape = new RoundedRectangleBoxShape({ width: 20, depth: 10, height: -1, cornerRadius: 8, points: 8, wallThickness: 5, includeBase: 1 });
    expect(shape.validate().map((issue) => issue.field)).toEqual(expect.arrayContaining(['height', 'cornerRadius', 'wallThickness']));
  });
});
