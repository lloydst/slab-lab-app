import { describe, expect, it } from 'vitest';
import {
  addCuboid,
  addPolygonCap,
  addPolygonSkirt,
  addRadialCap,
  addRectangularCap,
  addRectangularSkirt,
  prismMesh,
  radialMesh,
} from '../src/utils/mesh-utils';

describe('mesh utilities', () => {
  it('creates open and closed prism meshes', () => {
    expect(prismMesh(10, 20, 30).indices).toHaveLength(30);
    expect(prismMesh(10, 20, 30, true).indices).toHaveLength(36);
  });

  it('appends cuboids and rectangular skirts with correctly offset indices', () => {
    const mesh = prismMesh(2, 2, 2);
    addCuboid(mesh, 5, 6, 4, 3, 2, 8);
    expect(mesh.vertices).toHaveLength(16);
    expect(Math.min(...mesh.indices.slice(30))).toBe(8);
    addRectangularSkirt(mesh, 20, 16, 15, 5, 2);
    expect(mesh.vertices).toHaveLength(48);
  });

  it('adds polygon skirts and caps with explicit and default lift', () => {
    const outline = [{ x: -5, y: -4 }, { x: 5, y: -4 }, { x: 5, y: 4 }, { x: -5, y: 4 }];
    const mesh = { vertices: [], indices: [] };
    addPolygonSkirt(mesh, outline, 20, 6, 1);
    expect(mesh.vertices).toHaveLength(16);
    addPolygonCap(mesh, outline, 20, 5);
    expect(mesh.bodyVertexCount).toBe(16);
    expect(Math.min(...mesh.vertices.slice(16).map((vertex) => vertex.y))).toBe(20.5);
    addRectangularCap(mesh, 12, 8, 30, 4, -10);
    addRadialCap(mesh, 6, 40, 3, 2, 8);
    expect(mesh.vertices.every((vertex) => Number.isFinite(vertex.x + vertex.y + vertex.z))).toBe(true);
  });

  it('builds radial meshes for every cap combination', () => {
    expect(radialMesh(10, 8, 20, 8, false, false).vertices).toHaveLength(16);
    expect(radialMesh(10, 8, 20, 8, true, false).vertices).toHaveLength(17);
    const closed = radialMesh(10, 8, 20, 8, true, true);
    expect(closed.vertices).toHaveLength(18);
    expect(closed.indices).toHaveLength(96);
  });
});
