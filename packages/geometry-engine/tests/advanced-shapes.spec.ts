import { describe, expect, it } from 'vitest';
import {
  compensate,
  distance,
  millimetresToUnit,
  ShapeFactory,
  shapeDefaults,
  unitToMillimetres,
} from '../src';

const kinds = [
  'hexagonal-prism',
  'octagonal-prism',
  'tapered-box',
  'truncated-square-pyramid',
  'polygonal-vase',
  'rounded-rectangle-box',
  'elliptical-vase',
  'faceted-bowl',
  'gored-sphere',
  'teardrop-vessel',
  'organic-lofted-vessel',
] as const;

describe('advanced parametric generators', () => {
  const factory = new ShapeFactory();
  for (const kind of kinds)
    it(`${kind} produces finite mesh and printable panels`, () => {
      const shape = factory.create(kind, shapeDefaults[kind]);
      expect(shape.kind).toBe(kind);
      expect(shape.validate()).toEqual([]);
      expect(shape.generateMesh().vertices.length).toBeGreaterThan(3);
      expect(shape.generateMesh().vertices.every((p) => [p.x, p.y, p.z].every(Number.isFinite))).toBe(true);
      const template = shape.generateTemplate();
      expect(template.paths.length).toBeGreaterThan(1);
      expect(template.dimensions.width).toBeGreaterThan(0);
      expect(template.dimensions.height).toBeGreaterThan(0);
    });

  it('creates six and eight matching prism walls plus bases', () => {
    for (const [kind, sides] of [
      ['hexagonal-prism', 6],
      ['octagonal-prism', 8],
    ] as const) {
      const template = factory.create(kind, shapeDefaults[kind]).generateTemplate();
      expect(template.panels).toHaveLength(sides + 1);
      const walls = template.panels!.slice(0, sides);
      const lengths = walls.map((panel) => distance(panel.outline[0]!, panel.outline[1]!));
      expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThan(1e-6);
    }
  });

  it('keeps tapered box adjacent vertical seams equal', () => {
    const panels = factory
      .create('tapered-box', shapeDefaults['tapered-box'])
      .generateTemplate()
      .panels!.slice(0, 4);
    for (let i = 0; i < panels.length; i++)
      expect(distance(panels[i]!.outline[1]!, panels[i]!.outline[2]!)).toBeCloseTo(
        distance(panels[(i + 1) % 4]!.outline[3]!, panels[(i + 1) % 4]!.outline[0]!),
        6,
      );
  });

  it('uses consistent fired-size shrinkage and unit conversion', () => {
    expect(compensate(100, 12)).toBeCloseTo(113.63636);
    expect(millimetresToUnit(unitToMillimetres(2, 'in'), 'in')).toBeCloseTo(2);
    for (const rate of [1, 5, 12, 25]) expect(compensate(100, rate)).toBeGreaterThan(100);
  });

  it('rejects invalid dimensions and facet counts', () => {
    expect(
      factory.create('tapered-box', { ...shapeDefaults['tapered-box'], topWidth: -1 }).validate().length,
    ).toBeGreaterThan(0);
    expect(
      factory.create('hexagonal-prism', { ...shapeDefaults['hexagonal-prism'], bottomRadius: 0 }).validate()
        .length,
    ).toBeGreaterThan(0);
  });

  it('marks curved flattenings as approximations', () => {
    for (const kind of [
      'elliptical-vase',
      'faceted-bowl',
      'gored-sphere',
      'teardrop-vessel',
      'organic-lofted-vessel',
    ] as const)
      expect(factory.create(kind, shapeDefaults[kind]).generateTemplate().warnings?.length).toBeGreaterThan(
        0,
      );
  });
});
