import { FrustumShape } from './frustum-shape';

export class BowlShape extends FrustumShape {
  override readonly kind = 'bowl';
  protected override readonly includeTop: boolean = false;
}
