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
  bodyVertexCount?: number;
}

export type TemplateLineKind = 'cut' | 'fold';
export interface TemplatePath {
  points: Point2D[];
  closed: boolean;
  kind: TemplateLineKind;
  label?: string;
  assemblyNumber?: number;
  panelId?: string;
  edgeLabels?: string[];
}

export type MeasurementUnit = 'mm' | 'cm' | 'in';
export type DimensionStage = 'wet' | 'leather-hard' | 'fired';
export type ValidationSeverity = 'error' | 'warning';
export interface PanelEdge {
  readonly id: string;
  readonly start: Point2D;
  readonly end: Point2D;
  readonly mateId?: string;
}
export interface Panel {
  readonly id: string;
  readonly label: string;
  readonly outline: readonly Point2D[];
  readonly edges: readonly PanelEdge[];
  readonly approximation?: string;
}
export interface CrossSection {
  readonly height: number;
  readonly width: number;
  readonly depth: number;
  readonly rotation?: number;
  readonly cornerStyle?: 'sharp' | 'rounded' | 'ellipse' | 'custom';
  readonly controlPoints?: readonly Point2D[];
}
export interface ProfilePoint {
  readonly height: number;
  readonly radius: number;
}
export interface ShrinkageSettings {
  readonly percentage: number;
  readonly inputStage: DimensionStage;
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
  panels?: Panel[];
  warnings?: string[];
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity?: ValidationSeverity;
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
export const unitToMillimetres = (value: number, unit: MeasurementUnit): number =>
  value * ({ mm: 1, cm: 10, in: 25.4 } as const)[unit];
export const millimetresToUnit = (value: number, unit: MeasurementUnit): number =>
  value / ({ mm: 1, cm: 10, in: 25.4 } as const)[unit];
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
