import type { Params } from './shape-params';

export const shapeDefaults: Record<string, Params> = {
  cylinder: { diameter: 120, height: 140, wallThickness: 6 },
  cube: { width: 120, depth: 120, height: 120, wallThickness: 6 },
  box: {
    width: 160,
    depth: 110,
    height: 90,
    wallThickness: 6,
    hasLid: 0,
    lidStyle: 0,
    lidClearance: 1.5,
    lidLift: 30,
    lidSkirtHeight: 24,
  },
  'truncated-cone': { topDiameter: 90, bottomDiameter: 150, height: 130, wallThickness: 6 },
  vase: {
    topDiameter: 80,
    bottomDiameter: 130,
    height: 200,
    wallThickness: 6,
    hasLid: 0,
    lidStyle: 0,
    lidClearance: 1.5,
    lidLift: 30,
    lidSkirtHeight: 24,
  },
  bowl: {
    topDiameter: 180,
    bottomDiameter: 80,
    height: 90,
    wallThickness: 6,
    hasLid: 0,
    lidStyle: 0,
    lidClearance: 1.5,
    lidLift: 30,
  },
  'oval-box': {
    width: 170,
    depth: 110,
    height: 80,
    roundness: 80,
    wallThickness: 6,
    hasLid: 0,
    lidStyle: 0,
    lidClearance: 1.5,
    lidLift: 30,
    lidSkirtHeight: 24,
  },
};

export const frustumPresets: Record<'tapered' | 'frustum', Params> = {
  tapered: { topDiameter: 110, bottomDiameter: 140, height: 160, wallThickness: 6 },
  frustum: { topDiameter: 90, bottomDiameter: 150, height: 130, wallThickness: 6 },
};
