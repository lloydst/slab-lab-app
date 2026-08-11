import { LoftGenerator } from '../generators/loft-generator';
import type { Params } from './shape-params';

export class OrganicLoftedVesselShape extends LoftGenerator {
  override readonly kind = 'organic-lofted-vessel';
  constructor(parameters: Params) {
    super(parameters, 'organic');
  }
}
