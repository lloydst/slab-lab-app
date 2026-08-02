import type { Panel, Point2D, ValidationIssue } from './model';

export const GEOMETRY_TOLERANCE = 1e-6;
export const distance = (a: Point2D, b: Point2D) => Math.hypot(b.x - a.x, b.y - a.y);
export const signedArea = (points: readonly Point2D[]) =>
  points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]!;
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;

const orientation = (a: Point2D, b: Point2D, c: Point2D) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
const intersects = (a: Point2D, b: Point2D, c: Point2D, d: Point2D) =>
  orientation(a, b, c) !== orientation(a, b, d) && orientation(c, d, a) !== orientation(c, d, b);
export const isSelfIntersecting = (points: readonly Point2D[]) =>
  points.some((a, i) => {
    const b = points[(i + 1) % points.length]!;
    return points.some((c, j) => {
      if (i === j || (i + 1) % points.length === j || i === (j + 1) % points.length) return false;
      return intersects(a, b, c, points[(j + 1) % points.length]!);
    });
  });

export const validatePanels = (panels: readonly Panel[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  for (const panel of panels) {
    if (panel.outline.length < 3 || Math.abs(signedArea(panel.outline)) <= GEOMETRY_TOLERANCE)
      issues.push({ field: panel.id, message: 'Panel has no usable area' });
    if (isSelfIntersecting(panel.outline)) issues.push({ field: panel.id, message: 'Panel self-intersects' });
    if (panel.outline.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
      issues.push({ field: panel.id, message: 'Panel contains a non-finite coordinate' });
  }
  const edges = panels.flatMap((panel) => panel.edges);
  for (const edge of edges.filter((candidate) => candidate.mateId)) {
    const mate = edges.find((candidate) => candidate.id === edge.mateId);
    if (
      !mate ||
      Math.abs(distance(edge.start, edge.end) - distance(mate.start, mate.end)) > GEOMETRY_TOLERANCE
    )
      issues.push({ field: edge.id, message: `Shared edge ${edge.mateId} does not match` });
  }
  return issues;
};
