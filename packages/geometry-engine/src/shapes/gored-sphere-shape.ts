import { ProfileVesselGenerator } from '../generators/profile-vessel-generator';
import type { Params } from './shape-params';
export class GoredSphereShape extends ProfileVesselGenerator {
  override readonly kind = 'gored-sphere';
  constructor(parameters: Params) {
    super({ ...parameters, baseDiameter: parameters.bottomOpening, rimDiameter: parameters.topOpening });
  }
  protected override profile() {
    const { diameter, height, baseDiameter, rimDiameter } = this.parameters,
      radius = diameter / 2;
    // Sample one circular meridian so the mesh and orange-peel gore share a profile.
    return Array.from({ length: 13 }, (_, index) => {
      const y = (index / 12) * height,
        sphereY = (y / height - 0.5) * Math.min(height, diameter),
        sphericalRadius = Math.sqrt(Math.max(0, radius * radius - sphereY * sphereY));
      return { y, r: index === 0 ? baseDiameter / 2 : index === 12 ? rimDiameter / 2 : sphericalRadius };
    });
  }
}
