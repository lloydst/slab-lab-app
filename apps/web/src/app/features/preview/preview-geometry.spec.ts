// @vitest-environment jsdom
import { VaseShape } from '@slablab/geometry-engine';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createInnerSurface, createRim } from './preview-geometry';

const vaseGeometry = (): THREE.BufferGeometry => {
  const mesh = new VaseShape({
    topDiameter: 80,
    bottomDiameter: 130,
    height: 200,
    wallThickness: 6,
    hasLid: 0,
  }).generateMesh();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      mesh.vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]),
      3,
    ),
  );
  geometry.setIndex(mesh.indices);
  geometry.computeBoundingBox();
  return geometry;
};

const widthAtTop = (geometry: THREE.BufferGeometry): number => {
  geometry.computeBoundingBox();
  const positions = geometry.getAttribute('position');
  const top = geometry.boundingBox!.max.y;
  const xValues = Array.from({ length: positions.count }, (_, index) => index)
    .filter((index) => Math.abs(positions.getY(index) - top) < 0.001)
    .map((index) => positions.getX(index));
  return Math.max(...xValues) - Math.min(...xValues);
};

describe('preview geometry', () => {
  it('insets a tapered vessel at each ring instead of its widest ring', () => {
    const geometry = vaseGeometry();
    const inner = createInnerSurface(geometry, 6)!;
    expect(widthAtTop(geometry)).toBeCloseTo(80);
    expect(widthAtTop(inner.geometry)).toBeCloseTo(68);
  });

  it('uses the top ring dimensions for the visible rim opening', () => {
    const rim = createRim(vaseGeometry(), 6)!;
    const positions = rim.geometry.getAttribute('position');
    const innerX = Array.from({ length: positions.count / 2 }, (_, index) =>
      positions.getX(index * 2 + 1),
    );
    expect(Math.max(...innerX) - Math.min(...innerX)).toBeCloseTo(68);
  });
});
