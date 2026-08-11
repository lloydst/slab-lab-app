import { BaseShape } from '../core/base-shape';
import { distance, validatePanels } from '../core/geometry';
import type { BoundingBox } from '../core/model';
import { positive } from '../shapes/shape-params';
import { polygonArea } from '../utils/template-utils';
import {
  createBasePanel,
  layoutPanels,
  meshBetweenSections,
  panelBetweenRings,
  regularPolygon,
} from './generator-utils';

export class PolygonPrismGenerator extends BaseShape {
  readonly kind: string = 'polygon-prism';

  protected sides() {
    return Math.round(this.parameters.sides);
  }

  protected radii() {
    return {
      bottom: this.parameters.bottomRadius,
      top: this.parameters.topRadius ?? this.parameters.bottomRadius,
    };
  }

  protected rings() {
    const { bottom, top } = this.radii();
    return { bottom: regularPolygon(this.sides(), bottom), top: regularPolygon(this.sides(), top) };
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
        rings.bottom[(index + 1) % this.sides()]!,
        rings.top[index]!,
        rings.top[(index + 1) % this.sides()]!,
        this.parameters.height,
        index,
        this.sides(),
      ),
    );
    if (this.parameters.includeBase !== 0) panels.push(createBasePanel(rings.bottom));
    if (this.parameters.closedTop === 1) panels.push(createBasePanel(rings.top, 'top', 'Top'));
    return panels;
  }

  generateTemplate() {
    return layoutPanels(this.generatePanels());
  }

  validate() {
    const issues = positive(this.parameters, [
      'sides',
      'bottomRadius',
      'topRadius',
      'height',
      'wallThickness',
    ]);
    if (this.sides() < 3 || this.sides() > 64)
      issues.push({ field: 'sides', message: 'Must be an integer from 3 to 64' });
    return [...issues, ...validatePanels(this.generatePanels())];
  }

  calculateDimensions(): BoundingBox {
    const { bottom, top } = this.radii(),
      diameter = Math.max(bottom, top) * 2;
    return { width: diameter, depth: diameter, height: this.parameters.height };
  }

  calculateSurfaceArea() {
    const rings = this.rings();
    return (
      polygonArea(rings.bottom) +
      rings.bottom.reduce(
        (sum, point, index) =>
          sum + distance(point, rings.bottom[(index + 1) % this.sides()]!) * this.parameters.height,
        0,
      )
    );
  }

  calculateVolume() {
    const { bottom, top } = this.radii();
    return (Math.PI * this.parameters.height * (bottom ** 2 + bottom * top + top ** 2)) / 3;
  }
}
