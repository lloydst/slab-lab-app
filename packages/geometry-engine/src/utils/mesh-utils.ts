import type { MeshData } from '../core/model';

export const prismMesh = (width: number, depth: number, height: number, includeTop = false): MeshData => ({
  vertices: [
    { x: -width / 2, y: 0, z: -depth / 2 },
    { x: width / 2, y: 0, z: -depth / 2 },
    { x: width / 2, y: height, z: -depth / 2 },
    { x: -width / 2, y: height, z: -depth / 2 },
    { x: -width / 2, y: 0, z: depth / 2 },
    { x: width / 2, y: 0, z: depth / 2 },
    { x: width / 2, y: height, z: depth / 2 },
    { x: -width / 2, y: height, z: depth / 2 },
  ],
  indices: [
    0,
    1,
    2,
    0,
    2,
    3,
    4,
    6,
    5,
    4,
    7,
    6,
    0,
    4,
    5,
    0,
    5,
    1,
    1,
    5,
    6,
    1,
    6,
    2,
    0,
    3,
    7,
    0,
    7,
    4,
    ...(includeTop ? [3, 2, 6, 3, 6, 7] : []),
  ],
});

export const addCuboid = (
  mesh: MeshData,
  centerX: number,
  centerZ: number,
  width: number,
  depth: number,
  bottom: number,
  top: number,
) => {
  const start = mesh.vertices.length;
  mesh.vertices.push(
    { x: centerX - width / 2, y: bottom, z: centerZ - depth / 2 },
    { x: centerX + width / 2, y: bottom, z: centerZ - depth / 2 },
    { x: centerX + width / 2, y: top, z: centerZ - depth / 2 },
    { x: centerX - width / 2, y: top, z: centerZ - depth / 2 },
    { x: centerX - width / 2, y: bottom, z: centerZ + depth / 2 },
    { x: centerX + width / 2, y: bottom, z: centerZ + depth / 2 },
    { x: centerX + width / 2, y: top, z: centerZ + depth / 2 },
    { x: centerX - width / 2, y: top, z: centerZ + depth / 2 },
  );
  mesh.indices.push(
    ...[
      0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 0, 3, 7, 0, 7, 4, 3, 2, 6, 3, 6,
      7,
    ].map((index) => start + index),
  );
};

export const addRectangularSkirt = (
  mesh: MeshData,
  width: number,
  depth: number,
  top: number,
  height: number,
  thickness: number,
) => {
  const bottom = top - height;
  addCuboid(mesh, 0, -(depth - thickness) / 2, width, thickness, bottom, top);
  addCuboid(mesh, 0, (depth - thickness) / 2, width, thickness, bottom, top);
  addCuboid(mesh, -(width - thickness) / 2, 0, thickness, depth - 2 * thickness, bottom, top);
  addCuboid(mesh, (width - thickness) / 2, 0, thickness, depth - 2 * thickness, bottom, top);
};

export const addPolygonSkirt = (
  mesh: MeshData,
  outline: { x: number; y: number }[],
  top: number,
  height: number,
  thickness: number,
) => {
  const width = Math.max(...outline.map((point) => point.x)) - Math.min(...outline.map((point) => point.x));
  const depth = Math.max(...outline.map((point) => point.y)) - Math.min(...outline.map((point) => point.y));
  const scaleX = (width - 2 * thickness) / width;
  const scaleY = (depth - 2 * thickness) / depth;
  const bottom = top - height;
  const start = mesh.vertices.length;
  for (const point of outline)
    mesh.vertices.push(
      { x: point.x, y: bottom, z: point.y },
      { x: point.x, y: top, z: point.y },
      { x: point.x * scaleX, y: bottom, z: point.y * scaleY },
      { x: point.x * scaleX, y: top, z: point.y * scaleY },
    );
  for (let index = 0; index < outline.length; index++) {
    const next = (index + 1) % outline.length;
    const outerBottom = start + index * 4,
      outerTop = outerBottom + 1,
      innerBottom = outerBottom + 2,
      innerTop = outerBottom + 3,
      nextOuterBottom = start + next * 4,
      nextOuterTop = nextOuterBottom + 1,
      nextInnerBottom = nextOuterBottom + 2,
      nextInnerTop = nextOuterBottom + 3;
    mesh.indices.push(
      outerBottom,
      nextOuterBottom,
      outerTop,
      nextOuterBottom,
      nextOuterTop,
      outerTop,
      innerBottom,
      innerTop,
      nextInnerBottom,
      nextInnerBottom,
      innerTop,
      nextInnerTop,
      outerBottom,
      innerBottom,
      nextOuterBottom,
      nextOuterBottom,
      innerBottom,
      nextInnerBottom,
      outerTop,
      nextOuterTop,
      innerTop,
      nextOuterTop,
      nextInnerTop,
      innerTop,
    );
  }
};

export const addPolygonCap = (
  mesh: MeshData,
  outline: { x: number; y: number }[],
  height: number,
  thickness: number,
  lift?: number,
) => {
  mesh.bodyVertexCount ??= mesh.vertices.length;
  const bottomHeight =
    height + (Number.isFinite(lift) ? Math.max(0, lift!) : Math.max(0.5, thickness * 0.08));
  const topHeight = bottomHeight + thickness;
  const bottomStart = mesh.vertices.length;
  mesh.vertices.push(...outline.map((point) => ({ x: point.x, y: bottomHeight, z: point.y })));
  const topStart = mesh.vertices.length;
  mesh.vertices.push(...outline.map((point) => ({ x: point.x, y: topHeight, z: point.y })));
  const bottomCenter = mesh.vertices.length;
  mesh.vertices.push({ x: 0, y: bottomHeight, z: 0 });
  const topCenter = mesh.vertices.length;
  mesh.vertices.push({ x: 0, y: topHeight, z: 0 });
  for (let index = 0; index < outline.length; index++) {
    const next = (index + 1) % outline.length;
    mesh.indices.push(
      bottomCenter,
      bottomStart + next,
      bottomStart + index,
      topCenter,
      topStart + index,
      topStart + next,
      bottomStart + index,
      bottomStart + next,
      topStart + index,
      bottomStart + next,
      topStart + next,
      topStart + index,
    );
  }
};

export const addRectangularCap = (
  mesh: MeshData,
  width: number,
  depth: number,
  height: number,
  thickness: number,
  lift?: number,
) =>
  addPolygonCap(
    mesh,
    [
      { x: -width / 2, y: -depth / 2 },
      { x: width / 2, y: -depth / 2 },
      { x: width / 2, y: depth / 2 },
      { x: -width / 2, y: depth / 2 },
    ],
    height,
    thickness,
    lift,
  );

export const addRadialCap = (
  mesh: MeshData,
  radius: number,
  height: number,
  thickness: number,
  lift?: number,
  segments = 64,
) =>
  addPolygonCap(
    mesh,
    Array.from({ length: segments }, (_, index) => ({
      x: Math.cos((index / segments) * Math.PI * 2) * radius,
      y: Math.sin((index / segments) * Math.PI * 2) * radius,
    })),
    height,
    thickness,
    lift,
  );
  
export const radialMesh = (
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments = 48,
  includeBottom = true,
  includeTop = true,
): MeshData => {
  const vertices = [];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    vertices.push(
      { x: Math.cos(a) * bottomRadius, y: 0, z: Math.sin(a) * bottomRadius },
      { x: Math.cos(a) * topRadius, y: height, z: Math.sin(a) * topRadius },
    );
  }
  for (let i = 0; i < segments; i++) {
    const n = (i + 1) % segments,
      b = i * 2,
      t = b + 1,
      bn = n * 2,
      tn = bn + 1;
    indices.push(b, bn, t, bn, tn, t);
  }
  if (includeBottom) {
    const bottomCenter = vertices.length;
    vertices.push({ x: 0, y: 0, z: 0 });
    for (let i = 0; i < segments; i++) {
      const nextBottom = ((i + 1) % segments) * 2;
      indices.push(bottomCenter, nextBottom, i * 2);
    }
  }
  if (includeTop) {
    const topCenter = vertices.length;
    vertices.push({ x: 0, y: height, z: 0 });
    for (let i = 0; i < segments; i++) {
      const nextTop = ((i + 1) % segments) * 2 + 1;
      indices.push(topCenter, i * 2 + 1, nextTop);
    }
  }
  return { vertices, indices };
};
