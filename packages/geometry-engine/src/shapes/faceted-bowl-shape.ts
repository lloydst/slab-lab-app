import { ProfileVesselGenerator } from '../generators/profile-vessel-generator';
import type { Params } from './shape-params';

export class FacetedBowlShape extends ProfileVesselGenerator {
  override readonly kind = 'faceted-bowl';
  constructor(parameters: Params) {
    super({
      ...parameters,
      diameter: parameters.bowlDiameter,
      height: parameters.bowlDepth,
      baseDiameter: parameters.baseDiameter,
      rimDiameter: parameters.rimDiameter,
      gores: parameters.facets,
    });
  }
}
