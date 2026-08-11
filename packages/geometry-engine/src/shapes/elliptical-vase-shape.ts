import { LoftGenerator } from '../generators/loft-generator';
import type { Params } from './shape-params';

export class EllipticalVaseShape extends LoftGenerator {
  override readonly kind = 'elliptical-vase';
  constructor(parameters: Params) {
    super(parameters, 'ellipse');
  }
}
