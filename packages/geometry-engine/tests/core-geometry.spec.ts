import { describe, expect, it } from 'vitest';
import { distance, isSelfIntersecting, signedArea, validatePanels } from '../src/core/geometry';
import type { Panel } from '../src/core/model';

const panel = (outline: Panel['outline'], edges: Panel['edges'] = []): Panel => ({
  id: 'panel',
  label: 'Panel',
  outline,
  edges,
});

describe('core geometry', () => {
  it('measures distance and signed polygon orientation', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    const square = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    expect(signedArea(square)).toBe(4);
    expect(signedArea([...square].reverse())).toBe(-4);
  });

  it('distinguishes simple and self-intersecting outlines', () => {
    expect(isSelfIntersecting([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }])).toBe(true);
    expect(isSelfIntersecting([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 2 }])).toBe(false);
  });

  it('reports degenerate, crossing, and non-finite panels', () => {
    const issues = validatePanels([
      panel([{ x: 0, y: 0 }, { x: 1, y: 0 }]),
      { ...panel([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }]), id: 'crossing' },
      { ...panel([{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }, { x: 2, y: 0 }]), id: 'invalid' },
    ]);
    expect(issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      'Panel has no usable area',
      'Panel self-intersects',
      'Panel contains a non-finite coordinate',
    ]));
  });

  it('validates matching shared-edge lengths and missing mates', () => {
    const edge = (id: string, length: number, mateId?: string) => ({
      id,
      start: { x: 0, y: 0 },
      end: { x: length, y: 0 },
      mateId,
    });
    const outline = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 2 }];
    expect(validatePanels([panel(outline, [edge('a', 3, 'b'), edge('b', 3, 'a')])])).toEqual([]);
    const issues = validatePanels([panel(outline, [edge('a', 3, 'b'), edge('b', 2, 'a'), edge('c', 1, 'missing')])]);
    expect(issues.filter((issue) => issue.message.includes('does not match'))).toHaveLength(3);
  });
});
