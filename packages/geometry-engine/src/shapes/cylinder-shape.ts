import { rectangle, type SlabTemplate } from '../core/model';
import { BaseShape } from '../core/base-shape';
import { positive } from './shape-params';
import { radialMesh } from '../utils/mesh-utils';
import { circlePath } from '../utils/template-utils';

export class CylinderShape extends BaseShape {
  readonly kind: string = 'cylinder';

  validate() {
    return positive(this.parameters, ['diameter', 'height', 'wallThickness']).concat(
      this.parameters.wallThickness * 2 >= this.parameters.diameter
        ? [{ field: 'wallThickness', message: 'Wall thickness must be less than the radius' }]
        : [],
    );
  }

  calculateDimensions() {
    return {
      width: this.parameters.diameter,
      depth: this.parameters.diameter,
      height: this.parameters.height,
    };
  }

  calculateSurfaceArea() {
    const r = this.parameters.diameter / 2,
      h = this.parameters.height;
    return 2 * Math.PI * r * h + 2 * Math.PI * r * r;
  }

  calculateVolume() {
    const r = this.parameters.diameter / 2,
      ri = Math.max(0, r - this.parameters.wallThickness),
      h = this.parameters.height;
    return Math.PI * (r * r - ri * ri) * h + Math.PI * ri * ri * this.parameters.wallThickness;
  }

  generateMesh() {
    return radialMesh(this.parameters.diameter / 2, this.parameters.diameter / 2, this.parameters.height);
  }
  
  generateTemplate(): SlabTemplate {
    const d = this.parameters.diameter,
      h = this.parameters.height,
      c = Math.PI * d,
      g = 10;
    return {
      paths: [
        rectangle(0, 0, c, h, 'Wall', 1),
        circlePath(c + d / 2 + g, d / 2, d / 2, 'Bottom', 2),
        circlePath(c + d + g * 2 + d / 2, d / 2, d / 2, 'Top', 3),
      ],
      dimensions: { width: c + 2 * d + 2 * g, height: Math.max(h, d) },
      unit: 'mm',
      notes: ['Join wall edges Aâ€“A. Attach base edge B.'],
    };
  }
}
