import type { Shape } from '../core/model';
import { BowlShape } from './bowl-shape';
import { BoxShape } from './box-shape';
import { CubeShape } from './cube-shape';
import { CylinderShape } from './cylinder-shape';
import { FrustumShape } from './frustum-shape';
import { OvalBoxShape } from './oval-box-shape';
import type { Params } from './shape-params';
import { VaseShape } from './vase-shape';

type ShapeConstructor = new (parameters: Params) => Shape<Params>;

const shapeClasses = new Map<string, ShapeConstructor>([
  ['cylinder', CylinderShape],
  ['truncated-cone', FrustumShape],
  ['bowl', BowlShape],
  ['vase', VaseShape],
  ['oval-box', OvalBoxShape],
  ['cube', CubeShape],
]);

export class ShapeFactory {
  create(kind: string, parameters: Params): Shape<Params> {
    const ShapeClass = shapeClasses.get(kind) ?? BoxShape;
    return new ShapeClass(parameters);
  }
}
