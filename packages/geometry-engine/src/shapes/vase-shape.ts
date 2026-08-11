import { FrustumShape } from './frustum-shape';

export class VaseShape extends FrustumShape {
  override readonly kind: string = 'vase';
  protected override readonly includeTop: boolean = false;
}
