import { BaseShape } from '../core/base-shape';
import { validatePanels } from '../core/geometry';
import type { BoundingBox, Panel } from '../core/model';
import { positive } from '../shapes/shape-params';
import { polygonArea } from '../utils/template-utils';
import { createBasePanel, layoutPanels, meshBetweenSections, regularPolygon } from './generator-utils';

export class ProfileVesselGenerator extends BaseShape {
  readonly kind: string = 'profile-vessel';

  protected profile() {
    const p = this.parameters;
    return [
      { y: 0, r: p.baseDiameter / 2 },
      { y: p.height * 0.55, r: p.diameter / 2 },
      { y: p.height, r: p.rimDiameter / 2 },
    ];
  }

  protected gores() {
    return Math.max(3, Math.round(this.parameters.gores));
  }

  generateMesh() {
    const count = this.gores();
    return meshBetweenSections(
      this.profile().map((section) => ({ y: section.y, points: regularPolygon(count, section.r) })),
      this.parameters.baseDiameter > 0,
    );
  }

  generatePanels() {
    const profile = this.profile(),
      count = this.gores(),
      panels: Panel[] = [];
    for (let index = 0; index < count; index++) {
      const left = profile.map((section) => ({ x: (-Math.PI * section.r) / count, y: section.y }));
      const right = [...profile]
        .reverse()
        .map((section) => ({ x: (Math.PI * section.r) / count, y: section.y }));
      const outline = [...left, ...right];
      panels.push({
        id: `gore-${index}`,
        label: `Gore ${index + 1}`,
        outline,
        approximation: 'Gored approximation',
        edges: outline.map((point, edge) => ({
          id: `gore-${index}-e${edge}`,
          start: point,
          end: outline[(edge + 1) % outline.length]!,
        })),
      });
    }
    if (this.parameters.includeBase !== 0 && this.parameters.baseDiameter > 0)
      panels.push(createBasePanel(regularPolygon(count, this.parameters.baseDiameter / 2)));
    return panels;
  }

  generateTemplate() {
    return layoutPanels(this.generatePanels(), [
      'Gored approximation: compound curvature requires controlled clay deformation during assembly.',
    ]);
  }

  validate() {
    const issues = positive(this.parameters, ['diameter', 'height', 'gores', 'wallThickness']);
    if (this.parameters.baseDiameter < 0 || this.parameters.rimDiameter < 0)
      issues.push({ field: 'diameter', message: 'Openings cannot be negative' });
    return [...issues, ...validatePanels(this.generatePanels())];
  }

  calculateDimensions(): BoundingBox {
    return {
      width: this.parameters.diameter,
      depth: this.parameters.diameter,
      height: this.parameters.height,
    };
  }
  calculateSurfaceArea() {
    return this.generatePanels().reduce((sum, panel) => sum + polygonArea([...panel.outline]), 0);
  }
  calculateVolume() {
    return (Math.PI * this.parameters.diameter ** 2 * this.parameters.height) / 6;
  }
}
