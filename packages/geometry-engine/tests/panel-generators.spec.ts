import { describe, expect, it } from 'vitest';
import {
  createBasePanel,
  ellipsePoints,
  layoutPanels,
  meshBetweenSections,
  panelBetweenRings,
  regularPolygon,
} from '../src/generators/generator-utils';

describe('panel generator utilities', () => {
  it('creates regular polygons and rotated ellipses', () => {
    expect(regularPolygon(6, 10)).toHaveLength(6);
    const ellipse = ellipsePoints(20, 10, 8, Math.PI / 2);
    expect(ellipse).toHaveLength(8);
    expect(ellipse[0]!.x).toBeCloseTo(0);
    expect(ellipse[0]!.y).toBeCloseTo(10);
  });

  it('meshes multiple rings with optional top and bottom caps', () => {
    const points = regularPolygon(4, 10);
    const mesh = meshBetweenSections([{ y: 0, points }, { y: 10, points }, { y: 20, points }], true, true);
    expect(mesh.vertices).toHaveLength(14);
    expect(mesh.indices).toHaveLength(72);
  });

  it('flattens straight and asymmetric tapered panels with seam mates', () => {
    const straight = panelBetweenRings('panel-0', { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 20, 0, 4);
    const tapered = panelBetweenRings('panel-1', { x: 0, y: 0 }, { x: 12, y: 0 }, { x: 1, y: 0 }, { x: 9, y: 1 }, 20, 1, 4);
    expect(straight.outline.every((point) => Number.isFinite(point.x + point.y))).toBe(true);
    expect(tapered.edges[1]!.mateId).toBe('panel-2-e3');
    expect(tapered.edges[3]!.mateId).toBe('panel-0-e1');
  });

  it('creates base panels and wraps wide layouts onto a new row', () => {
    const wide = createBasePanel([{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 20 }, { x: 0, y: 20 }], 'wide');
    const template = layoutPanels([wide, { ...wide, id: 'second', label: 'Second' }], ['Approximation']);
    expect(template.paths[1]!.points[0]!.y).toBeGreaterThan(20);
    expect(template.dimensions.width).toBe(500);
    expect(template.warnings).toEqual(['Approximation']);
    expect(template.panels).toHaveLength(2);
  });
});
