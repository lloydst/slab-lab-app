import { LoftGenerator } from '../generators/loft-generator';
import type { Params } from './shape-params';

export class TeardropVesselShape extends LoftGenerator {
  override readonly kind = 'teardrop-vessel';
  constructor(parameters: Params) {
    super(
      {
        ...parameters,
        midWidth: parameters.bodyWidth,
        midDepth: parameters.bodyDepth,
        topWidth: parameters.topOpening,
        topDepth: parameters.topOpening,
        bottomWidth: parameters.baseWidth,
        bottomDepth: parameters.baseDepth,
      },
      'teardrop',
    );
  }
}
