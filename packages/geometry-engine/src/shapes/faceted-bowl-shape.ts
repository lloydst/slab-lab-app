import { ProfileVesselGenerator } from '../generators/profile-vessel-generator';
import { createBasePanel, regularPolygon } from '../generators/generator-utils';
import { addPolygonCap } from '../utils/mesh-utils';
import {
  isCombinationLid,
  isCoverLid,
  lidLabel,
  resolvedLidLift,
  type Params,
} from './shape-params';

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

  private get hasLid() {
    return this.parameters.hasLid >= 0.5;
  }

  private get insetDiameter() {
    return this.parameters.rimDiameter -
      2 * (this.parameters.wallThickness + this.parameters.lidClearance);
  }

  private get lidDiameter() {
    if (isCombinationLid(this.parameters)) return this.parameters.rimDiameter;
    return isCoverLid(this.parameters)
      ? this.parameters.rimDiameter + 2 * this.parameters.lidClearance
      : this.insetDiameter;
  }

  override generateMesh() {
    const mesh = super.generateMesh();
    if (this.hasLid)
      addPolygonCap(
        mesh,
        regularPolygon(this.gores(), this.lidDiameter / 2),
        this.parameters.height,
        this.parameters.wallThickness,
        this.parameters.lidLift,
      );
    if (this.hasLid && isCombinationLid(this.parameters))
      addPolygonCap(
        mesh,
        regularPolygon(this.gores(), this.insetDiameter / 2),
        this.parameters.height + resolvedLidLift(this.parameters) - this.parameters.wallThickness,
        this.parameters.wallThickness,
        0,
      );
    return mesh;
  }

  override generatePanels() {
    const panels = super.generatePanels();
    if (this.hasLid)
      panels.push(
        createBasePanel(
          regularPolygon(this.gores(), this.lidDiameter / 2),
          'lid',
          lidLabel(this.parameters),
        ),
      );
    if (this.hasLid && isCombinationLid(this.parameters))
      panels.push(
        createBasePanel(
          regularPolygon(this.gores(), this.insetDiameter / 2),
          'inset-stopper',
          'Inset stopper',
        ),
      );
    return panels;
  }

  override validate() {
    const issues = super.validate();
    if (this.hasLid) {
      if (!Number.isFinite(this.parameters.lidClearance) || this.parameters.lidClearance < 0)
        issues.push({ field: 'lidClearance', message: 'Lid clearance cannot be negative' });
      if (this.insetDiameter <= 0)
        issues.push({ field: 'lidClearance', message: 'Wall thickness and clearance leave no room for a lid' });
      if (
        this.parameters.lidLift !== undefined &&
        (!Number.isFinite(this.parameters.lidLift) || this.parameters.lidLift < 0)
      )
        issues.push({ field: 'lidLift', message: 'Preview gap cannot be negative' });
    }
    return issues;
  }
}
