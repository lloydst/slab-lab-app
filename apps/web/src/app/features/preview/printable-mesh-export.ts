import type { MeshData } from '@slablab/geometry-engine';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { createBodyGeometry, createInnerSurface, createRim } from './preview-geometry';

const bufferGeometry = (data: MeshData): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      data.vertices.flatMap(({ x, y, z }) => [x, y, z]),
      3,
    ),
  );
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
};

const reverseFaces = (geometry: THREE.BufferGeometry): void => {
  const index = geometry.getIndex();
  if (!index) throw new Error('Printable mesh must use indexed triangles');
  for (let offset = 0; offset < index.count; offset += 3) {
    const second = index.getX(offset + 1);
    index.setX(offset + 1, index.getX(offset + 2));
    index.setX(offset + 2, second);
  }
  index.needsUpdate = true;
  geometry.computeVertexNormals();
};

export const printableMeshToStl = (data: MeshData, wallThickness: number, closedTop: boolean): Blob => {
  if (data.indices.length === 0 || data.indices.length % 3 !== 0)
    throw new Error('The model does not contain valid triangles');

  const outerGeometry = bufferGeometry(data);
  const printable = new THREE.Group();
  // The preview is Y-up; STL slicers conventionally treat Z as the build axis.
  printable.rotation.x = Math.PI / 2;
  printable.add(new THREE.Mesh(outerGeometry));

  if (!closedTop) {
    const bodyGeometry = createBodyGeometry(outerGeometry, data.bodyVertexCount);
    bodyGeometry.computeBoundingBox();
    const inner = createInnerSurface(bodyGeometry, wallThickness);
    const rim = createRim(bodyGeometry, wallThickness);
    if (!inner || !rim) throw new Error('Wall thickness is too large or invalid for this model');
    reverseFaces(inner.geometry);
    printable.add(inner, rim);
  }

  const result = new STLExporter().parse(printable, { binary: true });
  const bytes = new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
  return new Blob([bytes], { type: 'model/stl' });
};
