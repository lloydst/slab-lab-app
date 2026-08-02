import { FrustumShape } from './frustum-shape';
import { isBoxLid, isCombinationLid, isCoverLid } from './shape-params';

export class VaseShape extends FrustumShape {
  override readonly kind = 'vase';
  protected override readonly includeTop: boolean = false;

  protected override get insetDiameter() {
    return this.parameters.topDiameter - 2 * this.parameters.lidClearance;
  }

  protected override get lidDiameter() {
    if (isBoxLid(this.parameters))
      return this.parameters.topDiameter + 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
    if (isCombinationLid(this.parameters)) return this.parameters.topDiameter;
    if (isCoverLid(this.parameters)) return this.parameters.topDiameter + 2 * this.parameters.lidClearance;
    return this.insetDiameter;
  }
}
