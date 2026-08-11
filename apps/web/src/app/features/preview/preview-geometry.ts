import * as THREE from 'three';
import { previewColor } from './preview-theme';

export const createBodyGeometry = (geometry: THREE.BufferGeometry, bodyVertexCount?: number) => {
  if (!bodyVertexCount) return geometry;
  const sourcePositions = geometry.getAttribute('position');
  const sourceIndices = geometry.getIndex();
  const bodyGeometry = new THREE.BufferGeometry();
  bodyGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      Array.from(sourcePositions.array).slice(0, bodyVertexCount * sourcePositions.itemSize),
      3,
    ),
  );
  if (sourceIndices)
    bodyGeometry.setIndex(Array.from(sourceIndices.array).filter((index) => index < bodyVertexCount));
  bodyGeometry.computeVertexNormals();
  return bodyGeometry;
};

export const createInnerSurface = (
  outerGeometry: THREE.BufferGeometry,
  thickness: number,
): THREE.Mesh | undefined => {
  if (!Number.isFinite(thickness) || thickness <= 0) return undefined;
  outerGeometry.computeBoundingBox();
  const bounds = outerGeometry.boundingBox;
  if (!bounds) return undefined;
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  const height = bounds.max.y - bounds.min.y;
  if (thickness * 2 >= Math.min(width, depth) || thickness >= height) return undefined;

  const innerGeometry = outerGeometry.clone();
  const positions = innerGeometry.getAttribute('position');
  const sections = new Map<number, { minX: number; maxX: number; minZ: number; maxZ: number }>();
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    const section = sections.get(y) ?? {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    };
    section.minX = Math.min(section.minX, positions.getX(index));
    section.maxX = Math.max(section.maxX, positions.getX(index));
    section.minZ = Math.min(section.minZ, positions.getZ(index));
    section.maxZ = Math.max(section.maxZ, positions.getZ(index));
    sections.set(y, section);
  }
  const innerBottom = bounds.min.y + thickness;
  const innerTop = bounds.max.y;

  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    const section = sections.get(y)!;
    const sectionWidth = section.maxX - section.minX;
    const sectionDepth = section.maxZ - section.minZ;
    const centerX = (section.minX + section.maxX) / 2;
    const centerZ = (section.minZ + section.maxZ) / 2;
    const scaleX = Math.max(0, sectionWidth - thickness * 2) / sectionWidth;
    const scaleZ = Math.max(0, sectionDepth - thickness * 2) / sectionDepth;
    const normalizedHeight = (y - bounds.min.y) / height;
    positions.setXYZ(
      index,
      centerX + (positions.getX(index) - centerX) * scaleX,
      innerBottom + normalizedHeight * (innerTop - innerBottom),
      centerZ + (positions.getZ(index) - centerZ) * scaleZ,
    );
  }
  positions.needsUpdate = true;
  innerGeometry.computeVertexNormals();

  const innerSurface = new THREE.Mesh(
    innerGeometry,
    new THREE.MeshStandardMaterial({
      color: previewColor('--color-preview-clay-inner', '#e3a06f'),
      roughness: 0.86,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  innerSurface.renderOrder = 1;
  return innerSurface;
};

export const createEdgeLines = (geometry: THREE.BufferGeometry): THREE.LineSegments => {
  const edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 24),
    new THREE.LineBasicMaterial({
      color: previewColor('--color-preview-edge', '#000'),
      transparent: true,
      opacity: 0.92,
    }),
  );
  edgeLines.renderOrder = 2;
  return edgeLines;
};

const convexHull = (points: THREE.Vector2[]): THREE.Vector2[] => {
  if (points.length <= 3) return points;
  const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (origin: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
  const half: THREE.Vector2[] = [];
  const append = (point: THREE.Vector2) => {
    while (half.length >= 2 && cross(half.at(-2)!, half.at(-1)!, point) <= 0) half.pop();
    half.push(point);
  };
  sorted.forEach(append);
  half.pop();
  const lower = [...half];
  half.length = 0;
  sorted.reverse().forEach(append);
  half.pop();
  return lower.concat(half);
};

export const createBottomEdge = (geometry: THREE.BufferGeometry): THREE.LineLoop | undefined => {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) return undefined;
  const positions = geometry.getAttribute('position');
  const points = new Map<string, THREE.Vector2>();
  for (let index = 0; index < positions.count; index += 1) {
    if (Math.abs(positions.getY(index) - bounds.min.y) > 0.001) continue;
    const point = new THREE.Vector2(positions.getX(index), positions.getZ(index));
    points.set(`${point.x.toFixed(5)}:${point.y.toFixed(5)}`, point);
  }
  const outline = convexHull([...points.values()]);
  if (outline.length < 3) return undefined;
  const edgeGeometry = new THREE.BufferGeometry().setFromPoints(
    outline.map((point) => new THREE.Vector3(point.x, bounds.min.y + 0.08, point.y)),
  );
  const edge = new THREE.LineLoop(
    edgeGeometry,
    new THREE.LineBasicMaterial({ color: previewColor('--color-preview-edge', '#000') }),
  );
  edge.renderOrder = 3;
  return edge;
};

export const createRim = (outerGeometry: THREE.BufferGeometry, thickness: number): THREE.Mesh | undefined => {
  const bounds = outerGeometry.boundingBox;
  if (!bounds || !Number.isFinite(thickness) || thickness <= 0) return undefined;
  const width = bounds.max.x - bounds.min.x;
  const depth = bounds.max.z - bounds.min.z;
  if (thickness * 2 >= Math.min(width, depth)) return undefined;

  const positions = outerGeometry.getAttribute('position');
  const topPoints = new Map<string, THREE.Vector2>();
  for (let index = 0; index < positions.count; index += 1) {
    if (Math.abs(positions.getY(index) - bounds.max.y) > 0.001) continue;
    const point = new THREE.Vector2(positions.getX(index), positions.getZ(index));
    topPoints.set(`${point.x.toFixed(5)}:${point.y.toFixed(5)}`, point);
  }
  const outline = convexHull([...topPoints.values()]);
  if (outline.length < 3) return undefined;

  const topMinX = Math.min(...outline.map((point) => point.x));
  const topMaxX = Math.max(...outline.map((point) => point.x));
  const topMinZ = Math.min(...outline.map((point) => point.y));
  const topMaxZ = Math.max(...outline.map((point) => point.y));
  const topWidth = topMaxX - topMinX;
  const topDepth = topMaxZ - topMinZ;
  const centerX = (topMinX + topMaxX) / 2;
  const centerZ = (topMinZ + topMaxZ) / 2;
  const scaleX = (topWidth - thickness * 2) / topWidth;
  const scaleZ = (topDepth - thickness * 2) / topDepth;
  const rimPositions = outline.flatMap((point) => [
    point.x,
    bounds.max.y,
    point.y,
    centerX + (point.x - centerX) * scaleX,
    bounds.max.y,
    centerZ + (point.y - centerZ) * scaleZ,
  ]);
  const indices: number[] = [];
  for (let index = 0; index < outline.length; index += 1) {
    const next = (index + 1) % outline.length;
    indices.push(index * 2, next * 2, index * 2 + 1, next * 2, next * 2 + 1, index * 2 + 1);
  }
  const rimGeometry = new THREE.BufferGeometry();
  rimGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rimPositions, 3));
  rimGeometry.setIndex(indices);
  rimGeometry.computeVertexNormals();
  return new THREE.Mesh(
    rimGeometry,
    new THREE.MeshStandardMaterial({
      color: previewColor('--color-preview-clay-edge', '#d98c5a'),
      roughness: 0.84,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
};
