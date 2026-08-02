import { LoftGenerator } from '../generators/loft-generator';
import type { Params } from './shape-params';
export class RoundedRectangleBoxShape extends LoftGenerator {
  override readonly kind = 'rounded-rectangle-box';
  constructor(parameters: Params) {
    super(
      {
        ...parameters,
        bottomWidth: parameters.width,
        bottomDepth: parameters.depth,
        midWidth: parameters.width,
        midDepth: parameters.depth,
        topWidth: parameters.width,
        topDepth: parameters.depth,
        points: parameters.points || 32,
      },
      'rounded',
    );
  }
}
