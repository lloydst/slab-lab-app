import { PolygonPrismGenerator } from '../generators/polygon-prism-generator';
import type { Params } from './shape-params';
export class HexagonalPrismShape extends PolygonPrismGenerator {
  override readonly kind = 'hexagonal-prism';
  constructor(parameters: Params) {
    super({ ...parameters, sides: 6 });
  }
}
