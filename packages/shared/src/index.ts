export type MeasurementUnit = 'mm' | 'cm' | 'in';
export type ShapeKind =
  | 'cylinder'
  | 'cube'
  | 'box'
  | 'truncated-cone'
  | 'vase'
  | 'bowl'
  | 'oval-box'
  | 'hexagonal-prism'
  | 'octagonal-prism'
  | 'tapered-box'
  | 'truncated-square-pyramid'
  | 'polygonal-vase'
  | 'rounded-rectangle-box'
  | 'elliptical-vase'
  | 'faceted-bowl'
  | 'gored-sphere'
  | 'teardrop-vessel'
  | 'organic-lofted-vessel';

export interface SlabProject {
  id: string;
  name: string;
  shape: ShapeKind;
  parameters: Record<string, number>;
  shrinkage: number;
  unit: MeasurementUnit;
  /** True when dimensional values in parameters use the canonical millimetre unit. */
  parametersInMillimetres: true;
  createdAt: string;
  updatedAt: string;
}
