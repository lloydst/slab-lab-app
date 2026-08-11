import { describe, expect, it } from 'vitest';
import { FrustumShape } from '../src/shapes/frustum-shape';
import { OvalBoxShape } from '../src/shapes/oval-box-shape';
import { RoundedRectangleBoxShape } from '../src/shapes/rounded-rectangle-box-shape';
import { resolvedLidLift } from '../src/shapes/shape-params';

class OpenFrustum extends FrustumShape {
  protected override readonly includeTop = false;
}

const frustum = { topDiameter: 60, bottomDiameter: 100, height: 120, wallThickness: 5, hasLid: 1, lidClearance: 2, lidLift: 10, lidSkirtHeight: 16 };

describe('shape edge cases', () => {
  it.each([0, 1, 2, 3])('covers generic open-frustum lid style %i', (lidStyle) => {
    const shape = new OpenFrustum({ ...frustum, lidStyle });
    expect(shape.validate()).toEqual([]);
    expect(shape.generateMesh().vertices.length).toBeGreaterThan(97);
    expect(shape.generateTemplate().paths.length).toBeGreaterThanOrEqual(3);
    expect(shape.calculateSurfaceArea()).toBeGreaterThan(0);
    expect(shape.calculateDimensions()).toEqual({ width: 100, depth: 100, height: 120 });
  });

  it('uses a cylinder template for effectively equal frustum diameters', () => {
    const shape = new FrustumShape({ topDiameter: 80, bottomDiameter: 80.0005, height: 100, wallThickness: 5 });
    expect(shape.generateTemplate().paths.map((path) => path.label)).toEqual(['Wall', 'Bottom', 'Top']);
  });

  it('covers oval dimensions and no-lid volume paths', () => {
    const shape = new OvalBoxShape({ width: 100, depth: 60, height: 50, roundness: 50, wallThickness: 5, hasLid: 0, lidStyle: 0, lidClearance: 1 });
    expect(shape.calculateDimensions()).toEqual({ width: 100, depth: 60, height: 50 });
    expect(shape.calculateSurfaceArea()).toBeGreaterThan(0);
    expect(shape.calculateVolume()).toBeGreaterThan(0);
  });

  it('covers rounded-box dimensions and minimum inner radius', () => {
    const shape = new RoundedRectangleBoxShape({ width: 100, depth: 70, height: 4, cornerRadius: 3, points: 16, wallThickness: 5, includeBase: 1 });
    expect(shape.calculateDimensions()).toEqual({ width: 100, depth: 70, height: 4 });
    expect(shape.calculateVolume()).toBeGreaterThan(0);
  });

  it('derives default lid lift and clamps explicit negative lift', () => {
    expect(resolvedLidLift({ wallThickness: 10, lidLift: Number.NaN })).toBe(0.8);
    expect(resolvedLidLift({ wallThickness: 2, lidLift: Number.NaN })).toBe(0.5);
    expect(resolvedLidLift({ wallThickness: 5, lidLift: -10 })).toBe(0);
  });
});
