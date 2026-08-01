export interface Point2D {
  x: number;
  y: number;
}
export interface Point3D {
  x: number;
  y: number;
  z: number;
}
export interface BoundingBox {
  width: number;
  depth: number;
  height: number;
}
export interface MeshData {
  vertices: Point3D[];
  indices: number[];
}
export type TemplateLineKind = 'cut' | 'fold';
export interface TemplatePath {
  points: Point2D[];
  closed: boolean;
  kind: TemplateLineKind;
  label?: string;
  assemblyNumber?: number;
}
export interface TemplateDimensions {
  width: number;
  height: number;
}
export interface SlabTemplate {
  paths: TemplatePath[];
  dimensions: TemplateDimensions;
  unit: 'mm';
  notes: string[];
}
export interface ValidationIssue {
  field: string;
  message: string;
}

export interface Shape<T extends object = Record<string, number>> {
  readonly kind: string;
  readonly parameters: T;
  generateMesh(): MeshData;
  generateTemplate(): SlabTemplate;
  calculateDimensions(): BoundingBox;
  calculateSurfaceArea(): number;
  calculateVolume(): number;
  calculateBoundingBox(): BoundingBox;
  validate(): ValidationIssue[];
}

export const compensate = (value: number, shrinkage: number): number => value / (1 - shrinkage / 100);
export const rectangle = (
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  assemblyNumber: number,
): TemplatePath => ({
  points: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ],
  closed: true,
  kind: 'cut',
  label,
  assemblyNumber,
});
