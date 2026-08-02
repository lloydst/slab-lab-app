import type { SlabTemplate } from '../core/model';

export const rectangularLidNet = (x: number, y: number, width: number, depth: number, skirt: number) => {
  const left = x + skirt,
    right = left + width,
    top = y + skirt,
    bottom = top + depth;
  return [
    {
      points: [
        { x: left, y },
        { x: right, y },
        { x: right, y: top },
        { x: right + skirt, y: top },
        { x: right + skirt, y: bottom },
        { x: right, y: bottom },
        { x: right, y: bottom + skirt },
        { x: left, y: bottom + skirt },
        { x: left, y: bottom },
        { x, y: bottom },
        { x, y: top },
        { x: left, y: top },
      ],
      closed: true,
      kind: 'cut' as const,
      label: 'Box lid net',
      assemblyNumber: 6,
    },
    {
      points: [
        { x: left, y: top },
        { x: right, y: top },
      ],
      closed: false,
      kind: 'fold' as const,
    },
    {
      points: [
        { x: right, y: top },
        { x: right, y: bottom },
      ],
      closed: false,
      kind: 'fold' as const,
    },
    {
      points: [
        { x: right, y: bottom },
        { x: left, y: bottom },
      ],
      closed: false,
      kind: 'fold' as const,
    },
    {
      points: [
        { x: left, y: bottom },
        { x: left, y: top },
      ],
      closed: false,
      kind: 'fold' as const,
    },
  ];
};

export const radialOutline = (radius: number, segments = 64) =>
  Array.from({ length: segments }, (_, index) => ({
    x: Math.cos((index / segments) * Math.PI * 2) * radius,
    y: Math.sin((index / segments) * Math.PI * 2) * radius,
  }));

export const circlePath = (cx: number, cy: number, r: number, label: string, assemblyNumber: number) => ({
  points: Array.from({ length: 64 }, (_, i) => ({
    x: cx + Math.cos((i / 64) * Math.PI * 2) * r,
    y: cy + Math.sin((i / 64) * Math.PI * 2) * r,
  })),
  closed: true,
  kind: 'cut' as const,
  label,
  assemblyNumber,
});

export const sectorPoints = (inner: number, outer: number, angle: number) => {
  const steps = 64;
  const outerPts = Array.from({ length: steps + 1 }, (_, i) => ({
    x: outer + Math.cos(-angle / 2 + (i / steps) * angle) * outer,
    y: outer + Math.sin(-angle / 2 + (i / steps) * angle) * outer,
  }));
  const innerPts = Array.from({ length: steps + 1 }, (_, i) => ({
    x: outer + Math.cos(angle / 2 - (i / steps) * angle) * inner,
    y: outer + Math.sin(angle / 2 - (i / steps) * angle) * inner,
  }));
  return [...outerPts, ...innerPts];
};

export const superellipsePoints = (width: number, depth: number, roundness: number, segments = 96) => {
  const exponent = 8 - (Math.min(100, Math.max(0, roundness)) / 100) * 6;
  return Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return {
      x: (width / 2) * Math.sign(cosine) * Math.pow(Math.abs(cosine), 2 / exponent),
      y: (depth / 2) * Math.sign(sine) * Math.pow(Math.abs(sine), 2 / exponent),
    };
  });
};

export const polygonPerimeter = (points: { x: number; y: number }[]) =>
  points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0);

export const polygonArea = (points: { x: number; y: number }[]) =>
  Math.abs(
    points.reduce((total, point, index) => {
      const next = points[(index + 1) % points.length];
      return total + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );

export const templateBounds = (paths: SlabTemplate['paths']) => {
  const points = paths.flatMap((path) => path.points);
  return {
    width: Math.max(...points.map((point) => point.x)) - Math.min(0, ...points.map((point) => point.x)),
    height: Math.max(...points.map((point) => point.y)) - Math.min(0, ...points.map((point) => point.y)),
  };
};
