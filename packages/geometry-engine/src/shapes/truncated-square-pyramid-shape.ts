import { TaperedBoxGenerator } from '../generators/tapered-box-generator';
import type { Params } from './shape-params';

export class TruncatedSquarePyramidShape extends TaperedBoxGenerator {
  override readonly kind = 'truncated-square-pyramid';
  constructor(parameters: Params) {
    super({ ...parameters, bottomDepth: parameters.bottomWidth, topDepth: parameters.topWidth });
  }
}
