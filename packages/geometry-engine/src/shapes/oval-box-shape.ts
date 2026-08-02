import { rectangle, type MeshData, type SlabTemplate } from '../core/model';
import { BaseShape } from '../core/base-shape';
import { isBoxLid, isCombinationLid, isCoverLid, lidLabel, positive, resolvedLidLift } from './shape-params';
import { addPolygonCap, addPolygonSkirt } from '../utils/mesh-utils';
import { polygonArea, polygonPerimeter, superellipsePoints, templateBounds } from '../utils/template-utils';

export class OvalBoxShape extends BaseShape {
  readonly kind = 'oval-box';

  validate() {
    const issues = positive(this.parameters, ['width', 'depth', 'height', 'wallThickness']);
    if (this.parameters.wallThickness * 2 >= Math.min(this.parameters.width, this.parameters.depth))
      issues.push({
        field: 'wallThickness',
        message: 'Wall thickness must be less than half the smallest side',
      });
    if (
      !Number.isFinite(this.parameters.roundness) ||
      this.parameters.roundness < 0 ||
      this.parameters.roundness > 100
    )
      issues.push({ field: 'roundness', message: 'Roundness must be between 0 and 100' });
    if (this.hasLid && (!Number.isFinite(this.parameters.lidClearance) || this.parameters.lidClearance < 0))
      issues.push({ field: 'lidClearance', message: 'Lid clearance cannot be negative' });
    if (
      this.hasLid &&
      this.parameters.lidLift !== undefined &&
      (!Number.isFinite(this.parameters.lidLift) || this.parameters.lidLift < 0)
    )
      issues.push({ field: 'lidLift', message: 'Preview gap cannot be negative' });
    if (this.hasLid && (this.lidWidth <= 0 || this.lidDepth <= 0))
      issues.push({ field: 'lidClearance', message: 'Wall thickness and clearance leave no room for a lid' });
    if (
      this.hasLid &&
      isBoxLid(this.parameters) &&
      (!Number.isFinite(this.parameters.lidSkirtHeight) || this.parameters.lidSkirtHeight <= 0)
    )
      issues.push({ field: 'lidSkirtHeight', message: 'Skirt height must be greater than zero' });
    return issues;
  }

  private get hasLid() {
    return this.parameters.hasLid >= 0.5;
  }

  private get lidWidth() {
    if (isBoxLid(this.parameters))
      return this.parameters.width + 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
    if (isCombinationLid(this.parameters)) return this.parameters.width;
    return isCoverLid(this.parameters) ? this.coverWidth : this.insetWidth;
  }

  private get lidDepth() {
    if (isBoxLid(this.parameters))
      return this.parameters.depth + 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
    if (isCombinationLid(this.parameters)) return this.parameters.depth;
    return isCoverLid(this.parameters) ? this.coverDepth : this.insetDepth;
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

  private outline(width = this.parameters.width, depth = this.parameters.depth) {
    return superellipsePoints(width, depth, this.parameters.roundness);
  }

  calculateDimensions() {
    const { width, depth, height } = this.parameters;
    return { width, depth, height };
  }

  calculateSurfaceArea() {
    const outline = this.outline();
    return (
      polygonArea(outline) +
      polygonPerimeter(outline) * this.parameters.height +
      (this.hasLid
        ? polygonArea(this.outline(this.lidWidth, this.lidDepth)) +
          (isCombinationLid(this.parameters)
            ? polygonArea(this.outline(this.insetWidth, this.insetDepth))
            : 0) +
          (isBoxLid(this.parameters)
            ? polygonPerimeter(
                this.outline(
                  this.lidWidth - this.parameters.wallThickness,
                  this.lidDepth - this.parameters.wallThickness,
                ),
              ) * this.parameters.lidSkirtHeight
            : 0)
        : 0)
    );
  }

  calculateVolume() {
    const { width, depth, height, wallThickness: thickness } = this.parameters;
    const outerArea = polygonArea(this.outline());
    const innerArea = polygonArea(this.outline(width - 2 * thickness, depth - 2 * thickness));
    return (
      outerArea * height -
      innerArea * Math.max(0, height - thickness) +
      (this.hasLid
        ? (polygonArea(this.outline(this.lidWidth, this.lidDepth)) +
            (isCombinationLid(this.parameters)
              ? polygonArea(this.outline(this.insetWidth, this.insetDepth))
              : 0) +
            (isBoxLid(this.parameters)
              ? polygonPerimeter(
                  this.outline(
                    this.lidWidth - this.parameters.wallThickness,
                    this.lidDepth - this.parameters.wallThickness,
                  ),
                ) * this.parameters.lidSkirtHeight
              : 0)) *
          thickness
        : 0)
    );
  }

  generateMesh(): MeshData {
    const outline = this.outline();
    const vertices = outline.flatMap((point) => [
      { x: point.x, y: 0, z: point.y },
      { x: point.x, y: this.parameters.height, z: point.y },
    ]);
    const indices: number[] = [];
    for (let i = 0; i < outline.length; i++) {
      const next = (i + 1) % outline.length;
      const bottom = i * 2,
        top = bottom + 1,
        nextBottom = next * 2,
        nextTop = nextBottom + 1;
      indices.push(bottom, nextBottom, top, nextBottom, nextTop, top);
    }
    const bottomCenter = vertices.length;
    vertices.push({ x: 0, y: 0, z: 0 });
    for (let i = 0; i < outline.length; i++)
      indices.push(bottomCenter, ((i + 1) % outline.length) * 2, i * 2);
    const mesh = { vertices, indices };
    if (this.hasLid)
      addPolygonCap(
        mesh,
        this.outline(this.lidWidth, this.lidDepth),
        this.parameters.height,
        this.parameters.wallThickness,
        this.parameters.lidLift,
      );
    if (this.hasLid && isCombinationLid(this.parameters))
      addPolygonCap(
        mesh,
        this.outline(this.insetWidth, this.insetDepth),
        this.parameters.height + resolvedLidLift(this.parameters) - this.parameters.wallThickness,
        this.parameters.wallThickness,
        0,
      );
    if (this.hasLid && isBoxLid(this.parameters))
      addPolygonSkirt(
        mesh,
        this.outline(this.lidWidth, this.lidDepth),
        this.parameters.height + resolvedLidLift(this.parameters),
        this.parameters.lidSkirtHeight,
        this.parameters.wallThickness,
      );
    return mesh;
  }
  
  generateTemplate(): SlabTemplate {
    const outline = this.outline();
    const perimeter = polygonPerimeter(outline);
    const gap = 10;
    const paths: SlabTemplate['paths'] = [
      rectangle(0, 0, perimeter, this.parameters.height, 'Wall', 1),
      {
        points: outline.map((point) => ({
          x: point.x + perimeter + gap + this.parameters.width / 2,
          y: point.y + this.parameters.depth / 2,
        })),
        closed: true,
        kind: 'cut',
        label: 'Base',
        assemblyNumber: 2,
      },
    ];
    if (this.hasLid)
      paths.push({
        points: this.outline(this.lidWidth, this.lidDepth).map((point) => ({
          x: point.x + perimeter + gap + this.parameters.width + gap + this.lidWidth / 2,
          y: point.y + this.lidDepth / 2,
        })),
        closed: true,
        kind: 'cut',
        label: lidLabel(this.parameters),
        assemblyNumber: 3,
      });
    if (this.hasLid && isCombinationLid(this.parameters))
      paths.push({
        points: this.outline(this.insetWidth, this.insetDepth).map((point) => ({
          x:
            point.x +
            perimeter +
            gap +
            this.parameters.width +
            gap +
            this.lidWidth +
            gap +
            this.insetWidth / 2,
          y: point.y + this.insetDepth / 2,
        })),
        closed: true,
        kind: 'cut',
        label: 'Inset stopper',
        assemblyNumber: 4,
      });
    if (this.hasLid && isBoxLid(this.parameters))
      paths.push(
        rectangle(
          0,
          Math.max(this.parameters.height, this.lidDepth) + gap,
          polygonPerimeter(
            this.outline(
              this.lidWidth - this.parameters.wallThickness,
              this.lidDepth - this.parameters.wallThickness,
            ),
          ),
          this.parameters.lidSkirtHeight,
          'Lid skirt',
          4,
        ),
      );
    return {
      paths,
      dimensions: templateBounds(paths),
      unit: 'mm',
      notes: ['Join wall edges Aâ€“A. Attach the wall around base edge B.'],
    };
  }
}
