import { BaseShape } from '../core/base-shape';
import { distance, validatePanels } from '../core/geometry';
import type { BoundingBox } from '../core/model';
import { positive } from '../shapes/shape-params';
import { polygonArea } from '../utils/template-utils';
import { createBasePanel, layoutPanels, meshBetweenSections, panelBetweenRings } from './generator-utils';

export class TaperedBoxGenerator extends BaseShape {
  readonly kind: string = 'tapered-box';

  protected rings() {
    const p = this.parameters;
    return {
      bottom: [
        { x: -p.bottomWidth / 2, y: -p.bottomDepth / 2 },
        { x: p.bottomWidth / 2, y: -p.bottomDepth / 2 },
        { x: p.bottomWidth / 2, y: p.bottomDepth / 2 },
        { x: -p.bottomWidth / 2, y: p.bottomDepth / 2 },
      ],
      top: [
        { x: -p.topWidth / 2, y: -p.topDepth / 2 },
        { x: p.topWidth / 2, y: -p.topDepth / 2 },
        { x: p.topWidth / 2, y: p.topDepth / 2 },
        { x: -p.topWidth / 2, y: p.topDepth / 2 },
      ],
    };
  }

  generateMesh() {
    const rings = this.rings();
    return meshBetweenSections(
      [
        { y: 0, points: rings.bottom },
        { y: this.parameters.height, points: rings.top },
      ],
      this.parameters.includeBase !== 0,
      this.parameters.closedTop === 1,
    );
  }

  generatePanels() {
    const rings = this.rings();
    const panels = rings.bottom.map((point, index) =>
      panelBetweenRings(
        `panel-${index}`,
        point,
        rings.bottom[(index + 1) % 4]!,
        rings.top[index]!,
        rings.top[(index + 1) % 4]!,
        this.parameters.height,
        index,
        4,
      ),
    );
    if (this.parameters.includeBase !== 0) panels.push(createBasePanel(rings.bottom));
    return panels;
  }

  generateTemplate() {
    return layoutPanels(this.generatePanels());
  }

  validate() {
    const issues = positive(this.parameters, [
      'bottomWidth',
      'bottomDepth',
      'topWidth',
      'topDepth',
      'height',
      'wallThickness',
    ]);
    if (
      this.parameters.wallThickness * 2 >=
      Math.min(
        this.parameters.topWidth,
        this.parameters.topDepth,
        this.parameters.bottomWidth,
        this.parameters.bottomDepth,
      )
    )
      issues.push({ field: 'wallThickness', message: 'Wall thickness leaves no interior opening' });
    return [...issues, ...validatePanels(this.generatePanels())];
  }

  calculateDimensions(): BoundingBox {
    return {
      width: Math.max(this.parameters.bottomWidth, this.parameters.topWidth),
      depth: Math.max(this.parameters.bottomDepth, this.parameters.topDepth),
      height: this.parameters.height,
    };
  }

  calculateSurfaceArea() {
    const rings = this.rings();
    return (
      polygonArea(rings.bottom) +
      rings.bottom.reduce(
        (sum, point, index) =>
          sum +
          ((distance(point, rings.bottom[(index + 1) % 4]!) +
            distance(rings.top[index]!, rings.top[(index + 1) % 4]!)) /
            2) *
            Math.hypot(this.parameters.height, distance(point, rings.top[index]!)),
        0,
      )
    );
  }

  calculateVolume() {
    const bottomArea = this.parameters.bottomWidth * this.parameters.bottomDepth,
      topArea = this.parameters.topWidth * this.parameters.topDepth;
    return (this.parameters.height * (bottomArea + Math.sqrt(bottomArea * topArea) + topArea)) / 3;
  }
}
