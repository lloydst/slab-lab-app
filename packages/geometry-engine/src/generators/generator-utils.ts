import { distance } from '../core/geometry';
import type { MeshData, Panel, Point2D, SlabTemplate } from '../core/model';
import { templateBounds } from '../utils/template-utils';

export const regularPolygon = (count: number, radius: number, rotation = -Math.PI / 2): Point2D[] =>
  Array.from({ length: count }, (_, index) => ({
    x: Math.cos(rotation + (index * Math.PI * 2) / count) * radius,
    y: Math.sin(rotation + (index * Math.PI * 2) / count) * radius,
  }));

export const ellipsePoints = (width: number, depth: number, count: number, rotation = 0): Point2D[] =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index * Math.PI * 2) / count;
    const x = (Math.cos(angle) * width) / 2,
      y = (Math.sin(angle) * depth) / 2;
    return {
      x: x * Math.cos(rotation) - y * Math.sin(rotation),
      y: x * Math.sin(rotation) + y * Math.cos(rotation),
    };
  });

export const meshBetweenSections = (
  sections: readonly { y: number; points: readonly Point2D[] }[],
  capBottom = true,
  capTop = false,
): MeshData => {
  const vertices = sections.flatMap((section) =>
    section.points.map((point) => ({ x: point.x, y: section.y, z: point.y })),
  );
  const indices: number[] = [],
    count = sections[0]!.points.length;
  for (let section = 0; section < sections.length - 1; section++)
    for (let index = 0; index < count; index++) {
      const next = (index + 1) % count,
        lower = section * count + index,
        lowerNext = section * count + next,
        upper = (section + 1) * count + index,
        upperNext = (section + 1) * count + next;
      indices.push(lower, lowerNext, upper, lowerNext, upperNext, upper);
    }
  if (capBottom) {
    const center = vertices.length;
    vertices.push({ x: 0, y: sections[0]!.y, z: 0 });
    for (let index = 0; index < count; index++) indices.push(center, (index + 1) % count, index);
  }
  if (capTop) {
    const center = vertices.length,
      start = (sections.length - 1) * count;
    vertices.push({ x: 0, y: sections.at(-1)!.y, z: 0 });
    for (let index = 0; index < count; index++)
      indices.push(center, start + index, start + ((index + 1) % count));
  }
  return { vertices, indices };
};

export const panelBetweenRings = (
  id: string,
  bottomA: Point2D,
  bottomB: Point2D,
  topA: Point2D,
  topB: Point2D,
  height: number,
  index: number,
  total: number,
): Panel => {
  const bottom = distance(bottomA, bottomB),
    top = distance(topA, topB),
    lateralA = Math.hypot(height, distance(bottomA, topA)),
    lateralB = Math.hypot(height, distance(bottomB, topB)),
    delta = bottom - top;
  // Trilateration preserves the true 3D seam lengths for asymmetric tapers.
  const x =
    Math.abs(delta) <= 1e-9 ? 0 : (lateralA * lateralA - lateralB * lateralB + delta * delta) / (2 * delta);
  const y = Math.sqrt(Math.max(0, lateralA * lateralA - x * x));
  const outline = [
    { x: 0, y: 0 },
    { x: bottom, y: 0 },
    { x: x + top, y },
    { x, y },
  ];
  return {
    id,
    label: `Panel ${index + 1}`,
    outline,
    edges: outline.map((point, edge) => ({
      id: `${id}-e${edge}`,
      start: point,
      end: outline[(edge + 1) % 4]!,
      mateId: id.startsWith('panel-')
        ? edge === 1
          ? `panel-${(index + 1) % total}-e3`
          : edge === 3
            ? `panel-${(index - 1 + total) % total}-e1`
            : undefined
        : undefined,
    })),
  };
};

export const createBasePanel = (points: readonly Point2D[], id = 'base'): Panel => ({
  id,
  label: 'Base',
  outline: [...points],
  edges: points.map((point, index) => ({
    id: `${id}-e${index}`,
    start: point,
    end: points[(index + 1) % points.length]!,
  })),
});

export const layoutPanels = (panels: readonly Panel[], notes: string[] = []): SlabTemplate => {
  let x = 0,
    y = 0,
    rowHeight = 0;
  const gap = 12;
  const paths = panels.map((panel, index) => {
    const minX = Math.min(...panel.outline.map((point) => point.x)),
      minY = Math.min(...panel.outline.map((point) => point.y)),
      width = Math.max(...panel.outline.map((point) => point.x)) - minX,
      height = Math.max(...panel.outline.map((point) => point.y)) - minY;
    if (x && x + width > 800) {
      x = 0;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const points = panel.outline.map((point) => ({ x: point.x - minX + x, y: point.y - minY + y }));
    x += width + gap;
    rowHeight = Math.max(rowHeight, height);
    return {
      points,
      closed: true,
      kind: 'cut' as const,
      label: panel.label,
      assemblyNumber: index + 1,
      panelId: panel.id,
      edgeLabels: panel.edges.map((edge) => edge.id),
    };
  });
  return {
    paths,
    dimensions: templateBounds(paths),
    unit: 'mm',
    notes,
    panels: [...panels],
    warnings: notes,
  };
};
