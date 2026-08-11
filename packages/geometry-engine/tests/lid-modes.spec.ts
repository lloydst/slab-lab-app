import { describe, expect, it } from 'vitest';
import { BoxShape } from '../src/shapes/box-shape';
import { FacetedBowlShape } from '../src/shapes/faceted-bowl-shape';
import { OvalBoxShape } from '../src/shapes/oval-box-shape';
import { VaseShape } from '../src/shapes/vase-shape';

const boxBase = { width: 120, depth: 80, height: 70, wallThickness: 5, hasLid: 1, lidClearance: 2, lidLift: 12, lidSkirtHeight: 18 };
const ovalBase = { ...boxBase, roundness: 75 };
const vaseBase = { topDiameter: 70, bottomDiameter: 110, height: 150, wallThickness: 5, hasLid: 1, lidClearance: 2, lidLift: 12, lidSkirtHeight: 18 };
const facetedBowlBase = {
  bowlDiameter: 180,
  bowlDepth: 90,
  baseDiameter: 65,
  rimDiameter: 160,
  facets: 10,
  wallThickness: 6,
  includeBase: 1,
  hasLid: 1,
  lidClearance: 2,
  lidLift: 12,
};

describe('lid modes', () => {
  it.each([
    [0, 'Inset lid', 6],
    [1, 'Cover lid', 6],
    [2, 'Box lid net', 10],
    [3, 'Flush lid top', 7],
  ])('builds box lid style %i', (lidStyle, label, pathCount) => {
    const shape = new BoxShape({ ...boxBase, lidStyle });
    expect(shape.validate()).toEqual([]);
    expect(shape.generateTemplate().paths).toHaveLength(pathCount);
    expect(shape.generateTemplate().paths.some((path) => path.label === label)).toBe(true);
    expect(shape.generateMesh().vertices.length).toBeGreaterThan(8);
    expect(shape.calculateSurfaceArea()).toBeGreaterThan(29_600);
    expect(shape.calculateVolume()).toBeGreaterThan(0);
  });

  it.each([
    [0, 'Inset lid', 3],
    [1, 'Cover lid', 3],
    [2, 'Box lid top', 4],
    [3, 'Flush lid top', 4],
  ])('builds oval lid style %i', (lidStyle, label, pathCount) => {
    const shape = new OvalBoxShape({ ...ovalBase, lidStyle });
    expect(shape.validate()).toEqual([]);
    expect(shape.generateTemplate().paths).toHaveLength(pathCount);
    expect(shape.generateTemplate().paths.some((path) => path.label === label)).toBe(true);
    expect(shape.generateMesh().vertices.length).toBeGreaterThan(193);
    expect(shape.calculateSurfaceArea()).toBeGreaterThan(0);
    expect(shape.calculateVolume()).toBeGreaterThan(0);
  });

  it.each([
    [0, 'Inset lid', 3],
    [1, 'Cover lid', 3],
    [2, 'Box lid top', 4],
    [3, 'Flush lid top', 4],
  ])('builds vase lid style %i', (lidStyle, label, pathCount) => {
    const shape = new VaseShape({ ...vaseBase, lidStyle });
    expect(shape.validate()).toEqual([]);
    expect(shape.generateTemplate().paths).toHaveLength(pathCount);
    expect(shape.generateTemplate().paths.some((path) => path.label === label)).toBe(true);
    expect(shape.generateMesh().vertices.length).toBeGreaterThan(97);
    expect(shape.calculateSurfaceArea()).toBeGreaterThan(0);
  });

  it('sizes both vase inset styles from the inside opening', () => {
    for (const lidStyle of [0, 3]) {
      const template = new VaseShape({ ...vaseBase, lidStyle }).generateTemplate();
      const inset = template.paths.find((path) =>
        lidStyle === 0 ? path.label === 'Inset lid' : path.label === 'Inset stopper',
      )!;
      const diameter =
        Math.max(...inset.points.map((point) => point.x)) -
        Math.min(...inset.points.map((point) => point.x));
      expect(diameter).toBeCloseTo(
        vaseBase.topDiameter - 2 * (vaseBase.wallThickness + vaseBase.lidClearance),
      );
    }
  });

  it.each([
    [0, 'Inset lid', 1],
    [1, 'Cover lid', 1],
    [3, 'Flush lid top', 2],
  ])('builds faceted bowl lid style %i', (lidStyle, label, lidPanelCount) => {
    const shape = new FacetedBowlShape({ ...facetedBowlBase, lidStyle });
    expect(shape.validate()).toEqual([]);
    const lidPanels = shape
      .generateTemplate()
      .paths.filter((path) => path.label === label || path.label === 'Inset stopper');
    expect(lidPanels).toHaveLength(lidPanelCount);
    expect(lidPanels.every((path) => path.points.length === facetedBowlBase.facets)).toBe(true);
    expect(shape.generateMesh().vertices.length).toBeGreaterThan(
      facetedBowlBase.facets * 3 + 1,
    );
  });
});
