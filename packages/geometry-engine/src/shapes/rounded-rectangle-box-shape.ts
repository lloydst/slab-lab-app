import { BaseShape } from '../core/base-shape';
import { rectangle, type BoundingBox, type Panel, type SlabTemplate } from '../core/model';
import { createBasePanel, meshBetweenSections } from '../generators/generator-utils';
import {
  polygonArea,
  polygonPerimeter,
  roundedRectanglePoints,
  templateBounds,
} from '../utils/template-utils';
import { positive } from './shape-params';

export class RoundedRectangleBoxShape extends BaseShape {
  readonly kind = 'rounded-rectangle-box';

  private outline() {
    return roundedRectanglePoints(
      this.parameters.width,
      this.parameters.depth,
      this.parameters.cornerRadius,
      this.parameters.points || 32,
    );
  }

  validate() {
    const issues = positive(this.parameters, ['width', 'depth', 'height', 'cornerRadius', 'wallThickness']);
    if (this.parameters.cornerRadius > Math.min(this.parameters.width, this.parameters.depth) / 2)
      issues.push({ field: 'cornerRadius', message: 'Corner radius must fit within half the smaller side' });
    if (this.parameters.wallThickness * 2 >= Math.min(this.parameters.width, this.parameters.depth))
      issues.push({ field: 'wallThickness', message: 'Wall thickness leaves no interior opening' });
    return issues;
  }

  calculateDimensions(): BoundingBox {
    return { width: this.parameters.width, depth: this.parameters.depth, height: this.parameters.height };
  }

  calculateSurfaceArea() {
    const outline = this.outline();
    return (
      polygonPerimeter(outline) * this.parameters.height +
      (this.parameters.includeBase !== 0 ? polygonArea(outline) : 0)
    );
  }

  calculateVolume() {
    const outerArea = polygonArea(this.outline());
    const innerArea = polygonArea(
      roundedRectanglePoints(
        this.parameters.width - this.parameters.wallThickness * 2,
        this.parameters.depth - this.parameters.wallThickness * 2,
        Math.max(0.01, this.parameters.cornerRadius - this.parameters.wallThickness),
        this.parameters.points || 32,
      ),
    );
    return (
      outerArea * this.parameters.height -
      innerArea * Math.max(0, this.parameters.height - this.parameters.wallThickness)
    );
  }

  generateMesh() {
    const outline = this.outline();
    return meshBetweenSections(
      [
        { y: 0, points: outline },
        { y: this.parameters.height, points: outline },
      ],
      this.parameters.includeBase !== 0,
      this.parameters.closedTop === 1,
    );
  }

  generatePanels(): Panel[] {
    const perimeter = polygonPerimeter(this.outline());
    const wallOutline = [
      { x: 0, y: 0 },
      { x: perimeter, y: 0 },
      { x: perimeter, y: this.parameters.height },
      { x: 0, y: this.parameters.height },
    ];
    const panels: Panel[] = [
      {
        id: 'wall',
        label: 'Continuous wall band',
        outline: wallOutline,
        edges: wallOutline.map((point, index) => ({
          id: `wall-e${index}`,
          start: point,
          end: wallOutline[(index + 1) % wallOutline.length]!,
          mateId: index === 1 ? 'wall-e3' : index === 3 ? 'wall-e1' : undefined,
        })),
      },
    ];
    if (this.parameters.includeBase !== 0) panels.push(createBasePanel(this.outline()));
    return panels;
  }

  generateTemplate(): SlabTemplate {
    const outline = this.outline(),
      perimeter = polygonPerimeter(outline),
      gap = 10;
    const paths: SlabTemplate['paths'] = [
      rectangle(0, 0, perimeter, this.parameters.height, 'Continuous wall band', 1),
    ];
    if (this.parameters.includeBase !== 0)
      paths.push({
        points: outline.map((point) => ({
          x: point.x + perimeter + gap + this.parameters.width / 2,
          y: point.y + this.parameters.depth / 2,
        })),
        closed: true,
        kind: 'cut',
        label: 'Rounded rectangle base',
        assemblyNumber: 2,
      });
    return {
      paths,
      dimensions: templateBounds(paths),
      unit: 'mm',
      notes: ['Exact developable wall band. Join end edges A-A, then attach the base.'],
      panels: this.generatePanels(),
    };
  }
}
