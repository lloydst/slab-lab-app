import { BaseShape } from '../core/base-shape';
import { validatePanels } from '../core/geometry';
import type { BoundingBox, Panel } from '../core/model';
import { positive, type Params } from '../shapes/shape-params';
import { polygonArea, roundedRectanglePoints, superellipsePoints } from '../utils/template-utils';
import {
  createBasePanel,
  ellipsePoints,
  layoutPanels,
  meshBetweenSections,
  panelBetweenRings,
  regularPolygon,
} from './generator-utils';

export type LoftStyle = 'polygon' | 'ellipse' | 'organic' | 'teardrop' | 'rounded';

export class LoftGenerator extends BaseShape {
  readonly kind: string = 'loft';

  constructor(
    parameters: Params,
    protected readonly style: LoftStyle = 'ellipse',
  ) {
    super(parameters);
  }

  protected sectionCount() {
    return Math.max(3, Math.round(this.parameters.sides || this.parameters.points || 12));
  }

  protected sectionValues() {
    const p = this.parameters,
      middleWidth = p.midWidth || Math.max(p.bottomWidth, p.topWidth) * 1.15,
      middleHeight = this.style === 'teardrop' ? p.height * 0.36 : p.height * 0.5;
    return [
      { y: 0, width: p.bottomWidth, depth: p.bottomDepth },
      { y: middleHeight, width: middleWidth, depth: p.midDepth || middleWidth },
      { y: p.height, width: p.topWidth, depth: p.topDepth },
    ];
  }

  protected sections() {
    const count = this.sectionCount(),
      values = this.sectionValues();
    return values.map((section, index) => ({
      y: section.y,
      points: this.sectionPoints(section.width, section.depth, count, index, values.length),
    }));
  }

  private sectionPoints(width: number, depth: number, count: number, index: number, sectionCount: number) {
    if (this.style === 'polygon')
      return regularPolygon(count, width / 2, ((this.parameters.rotation || 0) * Math.PI) / 180);
    if (this.style === 'rounded')
      return roundedRectanglePoints(width, depth, this.parameters.cornerRadius, count);
    if (this.style === 'organic') return superellipsePoints(width, depth, 35 + 30 * index, count);
    return ellipsePoints(
      width,
      depth,
      count,
      ((((this.parameters.rotation || 0) * Math.PI) / 180) * index) / (sectionCount - 1),
    );
  }

  generateMesh() {
    return meshBetweenSections(this.sections(), this.parameters.includeBase !== 0);
  }

  generatePanels() {
    const sections = this.sections(),
      count = this.sectionCount(),
      panels: Panel[] = [],
      usesAssemblyLabels = this.style === 'teardrop' || this.style === 'organic';
    for (let section = 0; section < sections.length - 1; section++)
      for (let index = 0; index < count; index++) {
        const lower = sections[section]!,
          upper = sections[section + 1]!;
        const panel = panelBetweenRings(
          `section-${section}-panel-${index}`,
          lower.points[index]!,
          lower.points[(index + 1) % count]!,
          upper.points[index]!,
          upper.points[(index + 1) % count]!,
          upper.y - lower.y,
          index,
          count,
        );
        const position = index + 1;
        panels.push({
          ...panel,
          label: usesAssemblyLabels
            ? section === 0
              ? `L${position} base→belly`
              : `U${position} belly→rim`
            : `Band ${section + 1}, panel ${position}`,
        });
      }
    if (this.parameters.includeBase !== 0) panels.push(createBasePanel(sections[0]!.points));
    return panels;
  }

  generateTemplate() {
    const assemblyNotes =
      this.style === 'teardrop' || this.style === 'organic'
        ? [
            'Assembly: join each lower panel to the upper panel with the same number (L1 to U1, L2 to U2, etc.).',
            `Join numbered positions in order around the form; position ${this.sectionCount()} wraps back to position 1.`,
            'Orient BASE edges downward, BELLY edges together, and RIM edges upward.',
          ]
        : [];
    return layoutPanels(this.generatePanels(), [
      ...assemblyNotes,
      'Loft panels are a faceted approximation; clay must accommodate small curvature changes at horizontal joins.',
    ]);
  }

  validate() {
    const issues = positive(this.parameters, [
      'bottomWidth',
      'bottomDepth',
      'midWidth',
      'midDepth',
      'topWidth',
      'topDepth',
      'height',
      'wallThickness',
    ]);
    if (
      this.style === 'rounded' &&
      (this.parameters.cornerRadius <= 0 ||
        this.parameters.cornerRadius > Math.min(this.parameters.bottomWidth, this.parameters.bottomDepth) / 2)
    )
      issues.push({ field: 'cornerRadius', message: 'Corner radius must fit within half the smaller side' });
    return [...issues, ...validatePanels(this.generatePanels())];
  }

  calculateDimensions(): BoundingBox {
    const sections = this.sectionValues();
    return {
      width: Math.max(...sections.map((section) => section.width)),
      depth: Math.max(...sections.map((section) => section.depth)),
      height: this.parameters.height,
    };
  }

  calculateSurfaceArea() {
    return this.generatePanels().reduce((sum, panel) => sum + Math.abs(polygonArea([...panel.outline])), 0);
  }

  calculateVolume() {
    const sections = this.sectionValues();
    let volume = 0;
    for (let index = 0; index < sections.length - 1; index++) {
      const lower = sections[index]!,
        upper = sections[index + 1]!,
        lowerArea = (Math.PI * lower.width * lower.depth) / 4,
        upperArea = (Math.PI * upper.width * upper.depth) / 4;
      volume += ((upper.y - lower.y) * (lowerArea + Math.sqrt(lowerArea * upperArea) + upperArea)) / 3;
    }
    return volume;
  }
}
