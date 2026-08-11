import { PolygonPrismGenerator } from '../generators/polygon-prism-generator';
import type { Params } from './shape-params';

export class OctagonalPrismShape extends PolygonPrismGenerator {
  override readonly kind = 'octagonal-prism';
  constructor(parameters: Params) {
    super({ ...parameters, topRadius: parameters.bottomRadius, sides: 8 });
  }
}
