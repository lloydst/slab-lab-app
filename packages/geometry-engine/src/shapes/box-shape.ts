import { rectangle, type SlabTemplate } from '../core/model';
import { BaseShape } from '../core/base-shape';
import { isBoxLid, isCombinationLid, isCoverLid, lidLabel, positive, resolvedLidLift } from './shape-params';
import { addRectangularCap, addRectangularSkirt, prismMesh } from '../utils/mesh-utils';
import { rectangularLidNet, templateBounds } from '../utils/template-utils';

export class BoxShape extends BaseShape {
  readonly kind: string = 'box';
  protected readonly includeTop: boolean = false;

  validate() {
    const issues = positive(this.parameters, ['width', 'depth', 'height', 'wallThickness']).concat(
      this.parameters.wallThickness * 2 >= Math.min(this.parameters.width, this.parameters.depth)
        ? [{ field: 'wallThickness', message: 'Wall thickness must be less than half the smallest side' }]
        : [],
    );
    if (!this.includeTop && this.parameters.hasLid >= 0.5) {
      if (!Number.isFinite(this.parameters.lidClearance) || this.parameters.lidClearance < 0)
        issues.push({ field: 'lidClearance', message: 'Lid clearance cannot be negative' });
      if (
        this.parameters.lidLift !== undefined &&
        (!Number.isFinite(this.parameters.lidLift) || this.parameters.lidLift < 0)
      )
        issues.push({ field: 'lidLift', message: 'Preview gap cannot be negative' });
      if (
        isBoxLid(this.parameters) &&
        (!Number.isFinite(this.parameters.lidSkirtHeight) || this.parameters.lidSkirtHeight <= 0)
      )
        issues.push({ field: 'lidSkirtHeight', message: 'Skirt height must be greater than zero' });
      if (this.lidWidth <= 0 || this.lidDepth <= 0)
        issues.push({
          field: 'lidClearance',
          message: 'Wall thickness and clearance leave no room for a lid',
        });
    }
    return issues;
  }

  protected get hasLid() {
    return !this.includeTop && this.parameters.hasLid >= 0.5;
  }

  protected get lidWidth() {
    if (isBoxLid(this.parameters))
      return this.parameters.width + 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
    if (isCombinationLid(this.parameters)) return this.parameters.width;
    if (isCoverLid(this.parameters)) return this.coverWidth;
    return this.insetWidth;
  }

  protected get lidDepth() {
    if (isBoxLid(this.parameters))
      return this.parameters.depth + 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
    if (isCombinationLid(this.parameters)) return this.parameters.depth;
    if (isCoverLid(this.parameters)) return this.coverDepth;
    return this.insetDepth;
  }
  private get insetWidth() {
    return this.parameters.width - 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
  }

  private get insetDepth() {
    return this.parameters.depth - 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
  }

  private get coverWidth() {
    return this.parameters.width + 2 * this.parameters.lidClearance;
  }

  private get coverDepth() {
    return this.parameters.depth + 2 * this.parameters.lidClearance;
  }

  private get additionalLidArea() {
    if (isCombinationLid(this.parameters)) return this.insetWidth * this.insetDepth;
    if (isBoxLid(this.parameters))
      return 2 * (this.lidWidth + this.lidDepth) * this.parameters.lidSkirtHeight;
    return 0;
  }

  calculateDimensions() {
    const { width, depth, height } = this.parameters;
    return { width, depth, height };
  }

  calculateSurfaceArea() {
    const { width: w, depth: d, height: h } = this.parameters;
    return (
      w * d * (this.includeTop ? 2 : 1) +
      2 * w * h +
      2 * d * h +
      (this.hasLid ? this.lidWidth * this.lidDepth + this.additionalLidArea : 0)
    );
  }

  calculateVolume() {
    const { width: w, depth: d, height: h, wallThickness: t } = this.parameters;
    const body =
      w * d * h -
      Math.max(0, w - 2 * t) * Math.max(0, d - 2 * t) * Math.max(0, h - (this.includeTop ? 2 * t : t));
    return body + (this.hasLid ? (this.lidWidth * this.lidDepth + this.additionalLidArea) * t : 0);
  }

  generateMesh() {
    const { width, depth, height } = this.parameters;
    const mesh = prismMesh(width, depth, height, this.includeTop);
    if (this.hasLid)
      addRectangularCap(
        mesh,
        this.lidWidth,
        this.lidDepth,
        height,
        this.parameters.wallThickness,
        this.parameters.lidLift,
      );
    if (this.hasLid && isCombinationLid(this.parameters))
      addRectangularCap(
        mesh,
        this.insetWidth,
        this.insetDepth,
        height + resolvedLidLift(this.parameters) - this.parameters.wallThickness,
        this.parameters.wallThickness,
        0,
      );
    if (this.hasLid && isBoxLid(this.parameters))
      addRectangularSkirt(
        mesh,
        this.lidWidth,
        this.lidDepth,
        height + resolvedLidLift(this.parameters),
        this.parameters.lidSkirtHeight,
        this.parameters.wallThickness,
      );
    return mesh;
  }
  
  generateTemplate(): SlabTemplate {
    const { width: w, depth: d, height: h } = this.parameters;
    const gap = 10;
    const paths = [
      rectangle(0, 0, w, d, 'Base', 1),
      rectangle(w + gap, 0, w, h, 'Front', 2),
      rectangle(w + gap, h + gap, w, h, 'Back', 3),
      rectangle(2 * w + 2 * gap, 0, d, h, 'Right', 4),
      rectangle(2 * w + 2 * gap, h + gap, d, h, 'Left', 5),
    ];
    if (this.includeTop) paths.push(rectangle(0, d + gap, w, d, 'Top', 6));
    if (this.hasLid && !isBoxLid(this.parameters))
      paths.push(rectangle(0, d + gap, this.lidWidth, this.lidDepth, lidLabel(this.parameters), 6));
    if (this.hasLid && isCombinationLid(this.parameters))
      paths.push(
        rectangle(this.lidWidth + gap, d + gap, this.insetWidth, this.insetDepth, 'Inset stopper', 7),
      );
    if (this.hasLid && isBoxLid(this.parameters))
      paths.push(
        ...rectangularLidNet(0, d + gap, this.lidWidth, this.lidDepth, this.parameters.lidSkirtHeight),
      );
    return {
      paths,
      dimensions: templateBounds(paths),
      unit: 'mm',
      notes: ['Score and slip matching labelled edges.'],
    };
  }
}
