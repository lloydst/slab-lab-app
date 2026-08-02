import { BoxShape } from './box-shape';

export class CubeShape extends BoxShape {
  override readonly kind = 'cube';
  protected override readonly includeTop: boolean = true;
}
