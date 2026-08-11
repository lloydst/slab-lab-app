import type { MeshData, TemplatePath } from '../core/model';

export const addArchHandle = (
  mesh: MeshData,
  bodyRadius: number,
  centerHeight: number,
  handleHeight: number,
  projection: number,
  width: number,
  segments = 24,
  tubeSegments = 8,
): void => {
  mesh.bodyVertexCount ??= mesh.vertices.length;
  const start = mesh.vertices.length;
  const tubeRadius = width / 2;
  for (let segment = 0; segment <= segments; segment++) {
    const angle = -Math.PI / 2 + (segment / segments) * Math.PI;
    for (let tube = 0; tube < tubeSegments; tube++) {
      const tubeAngle = (tube / tubeSegments) * Math.PI * 2;
      const offset = Math.cos(tubeAngle) * tubeRadius;
      mesh.vertices.push({
        x: bodyRadius + (projection + offset) * Math.cos(angle),
        y: centerHeight + (handleHeight / 2 + offset) * Math.sin(angle),
        z: Math.sin(tubeAngle) * tubeRadius,
      });
    }
  }
  for (let segment = 0; segment < segments; segment++)
    for (let tube = 0; tube < tubeSegments; tube++) {
      const nextTube = (tube + 1) % tubeSegments;
      const current = start + segment * tubeSegments + tube;
      const next = start + (segment + 1) * tubeSegments + tube;
      mesh.indices.push(current, next, current - tube + nextTube, next, next - tube + nextTube, current - tube + nextTube);
    }
};

export const archHandlePath = (
  x: number,
  y: number,
  handleHeight: number,
  projection: number,
  width: number,
  assemblyNumber: number,
): TemplatePath => {
  const segments = 32;
  const outer = Array.from({ length: segments + 1 }, (_, index) => {
    const angle = -Math.PI / 2 + (index / segments) * Math.PI;
    return {
      x: x + (projection + width / 2) * Math.cos(angle),
      y: y + (handleHeight / 2 + width / 2) * Math.sin(angle),
    };
  });
  const inner = Array.from({ length: segments + 1 }, (_, reverseIndex) => {
    const index = segments - reverseIndex;
    const angle = -Math.PI / 2 + (index / segments) * Math.PI;
    return {
      x: x + Math.max(width / 2, projection - width / 2) * Math.cos(angle),
      y: y + Math.max(width / 2, handleHeight / 2 - width / 2) * Math.sin(angle),
    };
  });
  return {
    points: [...outer, ...inner],
    closed: true,
    kind: 'cut',
    label: 'Handle',
    assemblyNumber,
  };
};
