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

  it('keeps both ends of hexagonal and octagonal prisms equal', () => {
    for (const kind of ['hexagonal-prism', 'octagonal-prism'] as const) {
      const shape = factory.create(kind, {
        ...shapeDefaults[kind],
        bottomRadius: 75,
        topRadius: 30,
      });
      expect(shape.calculateDimensions()).toEqual({ width: 150, depth: 150, height: 140 });
      const walls = shape.generateTemplate().panels!.slice(0, kind === 'hexagonal-prism' ? 6 : 8);
      for (const wall of walls) {
        expect(distance(wall.outline[0]!, wall.outline[1]!)).toBeCloseTo(
          distance(wall.outline[2]!, wall.outline[3]!),
        );
      }
    }
  });

  it('adds a printable top panel when a regular prism is closed', () => {
    for (const kind of ['hexagonal-prism', 'octagonal-prism'] as const) {
      const open = factory.create(kind, shapeDefaults[kind]).generateTemplate();
      const closed = factory
        .create(kind, { ...shapeDefaults[kind], closedTop: 1 })
        .generateTemplate();
      expect(open.paths.map((path) => path.label)).not.toContain('Top');
      expect(closed.paths.map((path) => path.label)).toContain('Top');
      expect(closed.paths).toHaveLength(open.paths.length + 1);
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

  it('adds a printable tapered-box top only when it is closed', () => {
    const open = factory.create('tapered-box', shapeDefaults['tapered-box']).generateTemplate();
    const closed = factory
      .create('tapered-box', { ...shapeDefaults['tapered-box'], closedTop: 1 })
      .generateTemplate();
    expect(open.paths.map((path) => path.label)).not.toContain('Top');
    expect(closed.paths.map((path) => path.label)).toContain('Top');
    expect(closed.paths).toHaveLength(open.paths.length + 1);
  });

  it('keeps square and regular-polygon dimensions coupled', () => {
    const pyramid = factory.create('truncated-square-pyramid', {
      ...shapeDefaults['truncated-square-pyramid'],
      bottomDepth: 20,
      topDepth: 30,
    });
    expect(pyramid.calculateDimensions()).toEqual({ width: 150, depth: 150, height: 130 });

    const vase = factory.create('polygonal-vase', {
      ...shapeDefaults['polygonal-vase'],
      bottomDepth: 20,
      midDepth: 30,
      topDepth: 40,
    });
    expect(vase.calculateDimensions()).toEqual({ width: 150, depth: 150, height: 200 });
  });

  it('uses one exact continuous band for a rounded rectangle box', () => {
    const template = factory
      .create('rounded-rectangle-box', shapeDefaults['rounded-rectangle-box'])
      .generateTemplate();
    expect(template.paths.map((path) => path.label)).toEqual([
      'Continuous wall band',
      'Rounded rectangle base',
    ]);
    expect(template.panels).toHaveLength(2);
    expect(template.warnings).toBeUndefined();
  });

  it('gives the teardrop a low, full belly and narrow ends by default', () => {
    const shape = factory.create('teardrop-vessel', shapeDefaults['teardrop-vessel']);
    const mesh = shape.generateMesh();
    const sides = shapeDefaults['teardrop-vessel'].sides;
    expect(mesh.vertices[sides]!.y).toBeCloseTo(shapeDefaults['teardrop-vessel'].height * 0.36);
    expect(shape.calculateDimensions()).toEqual({ width: 185, depth: 155, height: 240 });
    expect(shapeDefaults['teardrop-vessel'].bodyWidth).toBeGreaterThan(
      shapeDefaults['teardrop-vessel'].baseWidth * 3,
    );
    expect(shapeDefaults['teardrop-vessel'].topOpening).toBeLessThan(
      shapeDefaults['teardrop-vessel'].bodyWidth / 8,
    );
  });

  it.each(['teardrop-vessel', 'organic-lofted-vessel'] as const)(
    'labels %s panels with matching vertical assembly positions',
    (kind) => {
      const template = factory.create(kind, shapeDefaults[kind]).generateTemplate();
      const count = shapeDefaults[kind].sides || shapeDefaults[kind].points;
      expect(template.paths[0]?.label).toBe('L1 base→belly');
      expect(template.paths[count]?.label).toBe('U1 belly→rim');
      expect(template.paths[count - 1]?.label).toBe(`L${count} base→belly`);
      expect(template.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('L1 to U1'),
          expect.stringContaining(`position ${count} wraps back to position 1`),
          expect.stringContaining('BASE edges downward'),
        ]),
      );
    },
  );

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
