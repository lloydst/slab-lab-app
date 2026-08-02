import type { BoundingBox, MeshData, Shape, SlabTemplate, ValidationIssue } from './model';
import type { Params } from '../shapes/shape-params';

export abstract class BaseShape implements Shape<Params> {
  abstract readonly kind: string;
  constructor(public readonly parameters: Params) {}
  abstract generateMesh(): MeshData;
  abstract generateTemplate(): SlabTemplate;
  abstract calculateDimensions(): BoundingBox;
  abstract calculateSurfaceArea(): number;
  abstract calculateVolume(): number;
  abstract validate(): ValidationIssue[];
  calculateBoundingBox(): BoundingBox {
    return this.calculateDimensions();
  }
}
