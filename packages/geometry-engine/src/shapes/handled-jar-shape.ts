import type { SlabTemplate } from '../core/model';
import { addArchHandle, archHandlePath } from '../utils/handle-utils';
import { templateBounds } from '../utils/template-utils';
import { VaseShape } from './vase-shape';
import { positive } from './shape-params';

export class HandledJarShape extends VaseShape {
  override readonly kind = 'handled-jar';

  override validate() {
    return super.validate().concat(
      positive(this.parameters, ['handleHeight', 'handleProjection', 'handleWidth']),
    );
  }

  override calculateDimensions() {
    const body = super.calculateDimensions();
    return {
      ...body,
      width: body.width + this.parameters.handleProjection + this.parameters.handleWidth / 2,
    };
  }

  override generateMesh() {
    const mesh = super.generateMesh();
    addArchHandle(
      mesh,
      Math.max(this.parameters.topDiameter, this.parameters.bottomDiameter) / 2,
      this.parameters.height * 0.55,
      this.parameters.handleHeight,
      this.parameters.handleProjection,
      this.parameters.handleWidth,
    );
    return mesh;
  }

  override generateTemplate(): SlabTemplate {
    const template = super.generateTemplate();
    const gap = 10;
    const handle = archHandlePath(
      template.dimensions.width + gap,
      this.parameters.handleHeight / 2 + this.parameters.handleWidth / 2,
      this.parameters.handleHeight,
      this.parameters.handleProjection,
      this.parameters.handleWidth,
      template.paths.length + 1,
    );
    const paths = [...template.paths, handle];
    return {
      ...template,
      paths,
      dimensions: templateBounds(paths),
      notes: [...template.notes, 'Score and slip both handle ends securely to the jar wall.'],
    };
  }
}
