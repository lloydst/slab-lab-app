import { describe, expect, it } from 'vitest';
import { ShapeFactory, shapeDefaults } from '../src';

describe('handled vessels', () => {
  const factory = new ShapeFactory();

  it('creates an open cup with a separate printable handle', () => {
    const cup = factory.create('cup', shapeDefaults.cup);
    const mesh = cup.generateMesh();
    const template = cup.generateTemplate();

    expect(cup.kind).toBe('cup');
    expect(cup.validate()).toEqual([]);
    expect(mesh.bodyVertexCount).toBeLessThan(mesh.vertices.length);
    expect(mesh.vertices.every((point) => [point.x, point.y, point.z].every(Number.isFinite))).toBe(true);
    expect(template.paths.map((path) => path.label)).toEqual(['Cup wall', 'Bottom', 'Handle']);
    expect(template.paths.map((path) => path.label)).not.toContain('Top');
  });

  it('creates a lidded tapered jar with an arched handle', () => {
    const jar = factory.create('handled-jar', shapeDefaults['handled-jar']);
    const mesh = jar.generateMesh();
    const template = jar.generateTemplate();

    expect(jar.kind).toBe('handled-jar');
    expect(jar.validate()).toEqual([]);
    expect(mesh.bodyVertexCount).toBeLessThan(mesh.vertices.length);
    expect(template.paths.map((path) => path.label)).toEqual(
      expect.arrayContaining(['Tapered wall', 'Bottom', 'Inset lid', 'Handle']),
    );
    expect(jar.calculateDimensions().width).toBeGreaterThan(shapeDefaults['handled-jar'].bottomDiameter);
  });

  it('validates handle dimensions', () => {
    const cup = factory.create('cup', { ...shapeDefaults.cup, handleWidth: 0 });
    const jar = factory.create('handled-jar', {
      ...shapeDefaults['handled-jar'],
      handleProjection: -1,
    });

    expect(cup.validate()).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'handleWidth' })]));
    expect(jar.validate()).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'handleProjection' })]),
    );
  });
});
