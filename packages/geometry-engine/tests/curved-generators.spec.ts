import { describe, expect, it } from 'vitest';
import { LoftGenerator, type LoftStyle } from '../src/generators/loft-generator';
import { ProfileVesselGenerator } from '../src/generators/profile-vessel-generator';

const loftParameters = {
  sides: 8,
  bottomWidth: 70,
  bottomDepth: 60,
  midWidth: 110,
  midDepth: 90,
  topWidth: 50,
  topDepth: 45,
  height: 140,
  rotation: 15,
  cornerRadius: 12,
  wallThickness: 5,
  includeBase: 1,
};

describe('curved profile generators', () => {
  it.each<LoftStyle>(['polygon', 'ellipse', 'organic', 'teardrop', 'rounded'])('generates %s loft meshes and panels', (style) => {
    const shape = new LoftGenerator(loftParameters, style);
    expect(shape.generateMesh().vertices.length).toBeGreaterThan(20);
    expect(shape.generatePanels()).toHaveLength(17);
    expect(shape.generateTemplate().warnings).toHaveLength(1);
    expect(shape.calculateDimensions()).toEqual({ width: 110, depth: 90, height: 140 });
    expect(shape.calculateSurfaceArea()).toBeGreaterThan(0);
    expect(shape.calculateVolume()).toBeGreaterThan(0);
  });

  it('uses fallback section counts and middle dimensions', () => {
    const shape = new LoftGenerator({ ...loftParameters, sides: 0, points: 2, midWidth: 0, midDepth: 0, includeBase: 0 });
    expect(shape.generatePanels()).toHaveLength(6);
    expect(shape.calculateDimensions().width).toBeCloseTo(80.5);
  });

  it('validates invalid loft dimensions and rounded corners', () => {
    const shape = new LoftGenerator({ ...loftParameters, topWidth: 0, cornerRadius: 40 }, 'rounded');
    expect(shape.validate().map((issue) => issue.field)).toEqual(expect.arrayContaining(['topWidth', 'cornerRadius']));
  });

  it('generates open profile vessels and rejects invalid openings', () => {
    const open = new ProfileVesselGenerator({ diameter: 120, height: 150, baseDiameter: 0, rimDiameter: 30, gores: 8, wallThickness: 5, includeBase: 1 });
    expect(open.generatePanels()).toHaveLength(8);
    expect(open.generateMesh().vertices).toHaveLength(24);
    expect(open.calculateDimensions()).toEqual({ width: 120, depth: 120, height: 150 });
    expect(open.calculateSurfaceArea()).toBeGreaterThan(0);
    expect(open.calculateVolume()).toBeCloseTo((Math.PI * 120 ** 2 * 150) / 6);
    const invalid = new ProfileVesselGenerator({ diameter: 120, height: 150, baseDiameter: -1, rimDiameter: -2, gores: 2, wallThickness: 5, includeBase: 1 });
    expect(invalid.validate()).toContainEqual({ field: 'diameter', message: 'Openings cannot be negative' });
  });
});
