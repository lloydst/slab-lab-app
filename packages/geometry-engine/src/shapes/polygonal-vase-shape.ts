import { LoftGenerator } from '../generators/loft-generator';
import type { Params } from './shape-params';

export class PolygonalVaseShape extends LoftGenerator {
  override readonly kind = 'polygonal-vase';
  constructor(parameters: Params) {
    super(
      {
        ...parameters,
        bottomDepth: parameters.bottomWidth,
        midDepth: parameters.midWidth,
        topDepth: parameters.topWidth,
      },
      'polygon',
    );
  }
}
