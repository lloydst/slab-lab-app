export type MeasurementUnit = 'mm' | 'cm' | 'in';
export type ShapeKind = 'cylinder' | 'cube' | 'box' | 'truncated-cone' | 'vase' | 'bowl' | 'oval-box';

export interface SlabProject {
  id: string;
  name: string;
  shape: ShapeKind;
  parameters: Record<string, number>;
  shrinkage: number;
  unit: MeasurementUnit;
  createdAt: string;
  updatedAt: string;
}
