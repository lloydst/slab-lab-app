import { describe, expect, it } from 'vitest';
import {
  circlePath,
  polygonArea,
  polygonPerimeter,
  radialOutline,
  rectangularLidNet,
  roundedRectanglePoints,
  sectorPoints,
  superellipsePoints,
  templateBounds,
} from '../src/utils/template-utils';

describe('template utilities', () => {
  it('creates a box-lid cut outline with four fold lines', () => {
    const net = rectangularLidNet(5, 10, 100, 60, 12);
    expect(net).toHaveLength(5);
    expect(net[0]).toMatchObject({ kind: 'cut', closed: true, label: 'Box lid net' });
    expect(net.slice(1).every((path) => path.kind === 'fold' && !path.closed)).toBe(true);
  });

  it('creates radial, circular, and annular-sector outlines', () => {
    expect(radialOutline(10, 8)).toHaveLength(8);
    expect(circlePath(5, 6, 10, 'Base', 2)).toMatchObject({ closed: true, label: 'Base', assemblyNumber: 2 });
    const sector = sectorPoints(20, 40, Math.PI);
    expect(sector).toHaveLength(130);
    expect(sector.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });

  it('clamps superellipse roundness and rounds rectangle corners', () => {
    expect(superellipsePoints(100, 60, -50, 12)).toEqual(superellipsePoints(100, 60, 0, 12));
    expect(superellipsePoints(100, 60, 150, 12)).toEqual(superellipsePoints(100, 60, 100, 12));
    const rounded = roundedRectanglePoints(100, 60, 100, 16);
    expect(rounded).toHaveLength(16);
    expect(Math.max(...rounded.map((point) => Math.abs(point.y)))).toBeCloseTo(30);
  });

  it('calculates perimeter, area, and bounds including negative origins', () => {
    const rectangle = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    expect(polygonPerimeter(rectangle)).toBe(14);
    expect(polygonArea([...rectangle].reverse())).toBe(12);
    expect(templateBounds([{ points: [{ x: -5, y: -2 }, { x: 10, y: 8 }], closed: false, kind: 'cut' }])).toEqual({ width: 15, height: 10 });
  });
});
