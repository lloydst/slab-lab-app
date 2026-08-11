import { BoxShape } from './box-shape';
import type { Params } from './shape-params';

export class CubeShape extends BoxShape {
  override readonly kind = 'cube';
  protected override readonly includeTop: boolean = true;

  constructor(parameters: Params) {
    super({ ...parameters, depth: parameters.width, height: parameters.width });
  }
}
