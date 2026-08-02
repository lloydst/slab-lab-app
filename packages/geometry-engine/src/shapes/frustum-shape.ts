import { rectangle, type SlabTemplate } from '../core/model';
import { BaseShape } from '../core/base-shape';
import { CylinderShape } from './cylinder-shape';
import { isBoxLid, isCombinationLid, isCoverLid, lidLabel, positive, resolvedLidLift } from './shape-params';
import { addPolygonSkirt, addRadialCap, radialMesh } from '../utils/mesh-utils';
import { circlePath, radialOutline, sectorPoints, templateBounds } from '../utils/template-utils';

export class FrustumShape extends BaseShape {
  readonly kind: string = 'frustum';
  protected readonly includeTop: boolean = true;

  validate() {
    const issues = positive(this.parameters, ['topDiameter', 'bottomDiameter', 'height', 'wallThickness']);
    const slant = Math.hypot(
      (this.parameters.topDiameter - this.parameters.bottomDiameter) / 2,
      this.parameters.height,
    );
    const result = issues.concat(
      slant <= Math.abs(this.parameters.topDiameter - this.parameters.bottomDiameter) / 2
        ? [{ field: 'height', message: 'Invalid taper angle' }]
        : [],
    );
    if (this.hasLid && (!Number.isFinite(this.parameters.lidClearance) || this.parameters.lidClearance < 0))
      result.push({ field: 'lidClearance', message: 'Lid clearance cannot be negative' });
    if (
      this.hasLid &&
      this.parameters.lidLift !== undefined &&
      (!Number.isFinite(this.parameters.lidLift) || this.parameters.lidLift < 0)
    )
      result.push({ field: 'lidLift', message: 'Preview gap cannot be negative' });
    if (this.hasLid && this.lidDiameter <= 0)
      result.push({ field: 'lidClearance', message: 'Wall thickness and clearance leave no room for a lid' });
    if (
      this.hasLid &&
      isBoxLid(this.parameters) &&
      (!Number.isFinite(this.parameters.lidSkirtHeight) || this.parameters.lidSkirtHeight <= 0)
    )
      result.push({ field: 'lidSkirtHeight', message: 'Skirt height must be greater than zero' });
    return result;
  }

  protected get hasLid() {
    return !this.includeTop && this.parameters.hasLid >= 0.5;
  }

  protected get lidDiameter() {
    if (isBoxLid(this.parameters))
      return this.parameters.topDiameter + 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
    if (isCombinationLid(this.parameters)) return this.parameters.topDiameter;
    return isCoverLid(this.parameters) ? this.coverDiameter : this.insetDiameter;
  }

  protected get insetDiameter() {
    return this.parameters.topDiameter - 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
  }

  private get coverDiameter() {
    return this.parameters.topDiameter + 2 * this.parameters.lidClearance;
  }

  calculateDimensions() {
    const diameter = Math.max(this.parameters.topDiameter, this.parameters.bottomDiameter);
    return { width: diameter, depth: diameter, height: this.parameters.height };
  }

  calculateSurfaceArea() {
    const r1 = this.parameters.topDiameter / 2,
      r2 = this.parameters.bottomDiameter / 2,
      s = Math.hypot(r1 - r2, this.parameters.height);
    return (
      Math.PI * (r1 + r2) * s +
      Math.PI * r2 * r2 +
      (this.includeTop ? Math.PI * r1 * r1 : 0) +
      (this.hasLid
        ? Math.PI * (this.lidDiameter / 2) ** 2 +
          (isCombinationLid(this.parameters) ? Math.PI * (this.insetDiameter / 2) ** 2 : 0) +
          (isBoxLid(this.parameters)
            ? Math.PI * (this.lidDiameter - this.parameters.wallThickness) * this.parameters.lidSkirtHeight
            : 0)
        : 0)
    );
  }

  calculateVolume() {
    const r1 = this.parameters.topDiameter / 2,
      r2 = this.parameters.bottomDiameter / 2,
      h = this.parameters.height;
    return (Math.PI * h * (r1 * r1 + r1 * r2 + r2 * r2)) / 3;
  }

  generateMesh() {
    const mesh = radialMesh(
      this.parameters.bottomDiameter / 2,
      this.parameters.topDiameter / 2,
      this.parameters.height,
      48,
      true,
      this.includeTop,
    );
    if (this.hasLid)
      addRadialCap(
        mesh,
        this.lidDiameter / 2,
        this.parameters.height,
        this.parameters.wallThickness,
        this.parameters.lidLift,
      );
    if (this.hasLid && isCombinationLid(this.parameters))
      addRadialCap(
        mesh,
        this.insetDiameter / 2,
        this.parameters.height + resolvedLidLift(this.parameters) - this.parameters.wallThickness,
        this.parameters.wallThickness,
        0,
      );
    if (this.hasLid && isBoxLid(this.parameters))
      addPolygonSkirt(
        mesh,
        radialOutline(this.lidDiameter / 2),
        this.parameters.height + resolvedLidLift(this.parameters),
        this.parameters.lidSkirtHeight,
        this.parameters.wallThickness,
      );
    return mesh;
  }

  generateTemplate(): SlabTemplate {
    const { topDiameter: td, bottomDiameter: bd, height: h } = this.parameters;
    if (Math.abs(td - bd) < 0.001)
      return new CylinderShape({
        diameter: td,
        height: h,
        wallThickness: this.parameters.wallThickness,
      }).generateTemplate();
    const r1 = bd / 2,
      r2 = td / 2,
      s = Math.hypot(r1 - r2, h),
      outer = (s * Math.max(r1, r2)) / Math.abs(r1 - r2),
      inner = outer - s,
      angle = (2 * Math.PI * Math.abs(r1 - r2)) / s;
    const rawPoints = sectorPoints(inner, outer, angle),
      rotatedPoints = rawPoints.map((point) => ({ x: point.y, y: -point.x })),
      minimumX = Math.min(...rotatedPoints.map((point) => point.x)),
      minimumY = Math.min(...rotatedPoints.map((point) => point.y));
    const points = rotatedPoints.map((point) => ({ x: point.x - minimumX, y: point.y - minimumY }));
    const sectorHeight = Math.max(...points.map((point) => point.y)),
      gap = 10,
      capRowCenterY = sectorHeight + gap + Math.max(bd, td, this.hasLid ? this.lidDiameter : 0) / 2,
      baseCenterX = bd / 2;
    const paths: SlabTemplate['paths'] = [
      { points, closed: true, kind: 'cut', label: 'Tapered wall', assemblyNumber: 1 },
      circlePath(baseCenterX, capRowCenterY, bd / 2, 'Bottom', 2),
    ];
    let nextCapX = bd + gap;
    if (this.includeTop) {
      paths.push(circlePath(nextCapX + td / 2, capRowCenterY, td / 2, 'Top', 3));
      nextCapX += td + gap;
    }
    if (this.hasLid) {
      paths.push(
        circlePath(
          nextCapX + this.lidDiameter / 2,
          capRowCenterY,
          this.lidDiameter / 2,
          lidLabel(this.parameters),
          3,
        ),
      );
      nextCapX += this.lidDiameter + gap;
    }
    if (this.hasLid && isCombinationLid(this.parameters)) {
      paths.push(
        circlePath(
          nextCapX + this.insetDiameter / 2,
          capRowCenterY,
          this.insetDiameter / 2,
          'Inset stopper',
          4,
        ),
      );
    }
    if (this.hasLid && isBoxLid(this.parameters))
      paths.push(
        rectangle(
          0,
          capRowCenterY + Math.max(bd, td, this.lidDiameter) / 2 + gap,
          Math.PI * (this.lidDiameter - this.parameters.wallThickness),
          this.parameters.lidSkirtHeight,
          'Lid skirt',
          4,
        ),
      );
    return {
      paths,
      dimensions: templateBounds(paths),
      unit: 'mm',
      notes: ['Join radial edges Aâ€“A.'],
    };
  }
}
