import { describe, expect, it } from 'vitest';
import { BoxShape } from '../src/shapes/box-shape';
import { OvalBoxShape } from '../src/shapes/oval-box-shape';
import { VaseShape } from '../src/shapes/vase-shape';

describe('lid validation', () => {
  it('rejects invalid box clearances, lift, skirt, and interior dimensions', () => {
    const shape = new BoxShape({ width: 20, depth: 15, height: 30, wallThickness: 8, hasLid: 1, lidStyle: 2, lidClearance: Number.NaN, lidLift: -1, lidSkirtHeight: 0 });
    expect(shape.validate().map((issue) => issue.field)).toEqual(expect.arrayContaining(['wallThickness', 'lidClearance', 'lidLift', 'lidSkirtHeight']));
    const inset = new BoxShape({ width: 20, depth: 15, height: 30, wallThickness: 8, hasLid: 1, lidStyle: 0, lidClearance: 5, lidLift: 1, lidSkirtHeight: 5 });
    expect(inset.validate().some((issue) => issue.message.includes('no room'))).toBe(true);
  });

  it('rejects invalid oval roundness and lid dimensions', () => {
    for (const roundness of [Number.NaN, -1, 101]) {
      const shape = new OvalBoxShape({ width: 30, depth: 20, height: 30, wallThickness: 5, roundness, hasLid: 0, lidStyle: 0, lidClearance: 1, lidLift: 1, lidSkirtHeight: 5 });
      expect(shape.validate().some((issue) => issue.field === 'roundness')).toBe(true);
    }
    const lid = new OvalBoxShape({ width: 20, depth: 15, height: 30, wallThickness: 8, roundness: 50, hasLid: 1, lidStyle: 2, lidClearance: -1, lidLift: Number.NaN, lidSkirtHeight: 0 });
    expect(lid.validate().map((issue) => issue.field)).toEqual(expect.arrayContaining(['wallThickness', 'lidClearance', 'lidLift', 'lidSkirtHeight']));
  });

  it('rejects invalid vase lid clearances, lift, skirt, and inset diameter', () => {
    const invalid = new VaseShape({ topDiameter: 20, bottomDiameter: 40, height: 50, wallThickness: 5, hasLid: 1, lidStyle: 2, lidClearance: -1, lidLift: -2, lidSkirtHeight: 0 });
    expect(invalid.validate().map((issue) => issue.field)).toEqual(expect.arrayContaining(['lidClearance', 'lidLift', 'lidSkirtHeight']));
    const inset = new VaseShape({ topDiameter: 10, bottomDiameter: 40, height: 50, wallThickness: 5, hasLid: 1, lidStyle: 0, lidClearance: 6, lidLift: 1, lidSkirtHeight: 4 });
    expect(inset.validate().some((issue) => issue.message.includes('no room'))).toBe(true);
  });
});
