import { BaseShape } from '../core/base-shape';
import { rectangle, type SlabTemplate } from '../core/model';
import { addArchHandle, archHandlePath } from '../utils/handle-utils';
import { radialMesh } from '../utils/mesh-utils';
import { circlePath, templateBounds } from '../utils/template-utils';
import { positive } from './shape-params';

export class CupShape extends BaseShape {
  readonly kind = 'cup';

  validate() {
    return positive(this.parameters, [
      'diameter',
      'height',
      'wallThickness',
      'handleHeight',
      'handleProjection',
      'handleWidth',
    ]);
  }

  calculateDimensions() {
    return {
      width: this.parameters.diameter + this.parameters.handleProjection + this.parameters.handleWidth / 2,
      depth: this.parameters.diameter,
      height: this.parameters.height,
    };
  }

  calculateSurfaceArea() {
    const radius = this.parameters.diameter / 2;
    return 2 * Math.PI * radius * this.parameters.height + Math.PI * radius ** 2;
  }

  calculateVolume() {
    const radius = this.parameters.diameter / 2;
    return Math.PI * radius ** 2 * this.parameters.height;
  }

  generateMesh() {
    const mesh = radialMesh(
      this.parameters.diameter / 2,
      this.parameters.diameter / 2,
      this.parameters.height,
      48,
      true,
      false,
    );
    addArchHandle(
      mesh,
      this.parameters.diameter / 2,
      this.parameters.height * 0.55,
      this.parameters.handleHeight,
      this.parameters.handleProjection,
      this.parameters.handleWidth,
    );
    return mesh;
  }

  generateTemplate(): SlabTemplate {
    const diameter = this.parameters.diameter;
    const gap = 10;
    const wallWidth = Math.PI * diameter;
    const paths = [
      rectangle(0, 0, wallWidth, this.parameters.height, 'Cup wall', 1),
      circlePath(wallWidth + gap + diameter / 2, diameter / 2, diameter / 2, 'Bottom', 2),
      archHandlePath(
        wallWidth + diameter + gap * 2,
        this.parameters.handleHeight / 2 + this.parameters.handleWidth / 2,
        this.parameters.handleHeight,
        this.parameters.handleProjection,
        this.parameters.handleWidth,
        3,
      ),
    ];
    return {
      paths,
      dimensions: templateBounds(paths),
      unit: 'mm',
      notes: ['Join the cup wall seam, attach the bottom, then score and slip both handle ends to the wall.'],
    };
  }
}
