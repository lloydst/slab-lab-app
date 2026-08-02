import type { Shape } from '../core/model';
import { BowlShape } from './bowl-shape';
import { BoxShape } from './box-shape';
import { CubeShape } from './cube-shape';
import { CylinderShape } from './cylinder-shape';
import { FrustumShape } from './frustum-shape';
import { EllipticalVaseShape } from './elliptical-vase-shape';
import { FacetedBowlShape } from './faceted-bowl-shape';
import { GoredSphereShape } from './gored-sphere-shape';
import { HexagonalPrismShape } from './hexagonal-prism-shape';
import { OctagonalPrismShape } from './octagonal-prism-shape';
import { OrganicLoftedVesselShape } from './organic-lofted-vessel-shape';
import { OvalBoxShape } from './oval-box-shape';
import { PolygonalVaseShape } from './polygonal-vase-shape';
import { RoundedRectangleBoxShape } from './rounded-rectangle-box-shape';
import type { Params } from './shape-params';
import { VaseShape } from './vase-shape';
import { TaperedBoxShape } from './tapered-box-shape';
import { TeardropVesselShape } from './teardrop-vessel-shape';
import { TruncatedSquarePyramidShape } from './truncated-square-pyramid-shape';

type ShapeConstructor = new (parameters: Params) => Shape<Params>;

const shapeClasses = new Map<string, ShapeConstructor>([
  ['cylinder', CylinderShape],
  ['truncated-cone', FrustumShape],
  ['bowl', BowlShape],
  ['vase', VaseShape],
  ['oval-box', OvalBoxShape],
  ['cube', CubeShape],
  ['hexagonal-prism', HexagonalPrismShape],
  ['octagonal-prism', OctagonalPrismShape],
  ['tapered-box', TaperedBoxShape],
  ['truncated-square-pyramid', TruncatedSquarePyramidShape],
  ['polygonal-vase', PolygonalVaseShape],
  ['rounded-rectangle-box', RoundedRectangleBoxShape],
  ['elliptical-vase', EllipticalVaseShape],
  ['faceted-bowl', FacetedBowlShape],
  ['gored-sphere', GoredSphereShape],
  ['teardrop-vessel', TeardropVesselShape],
  ['organic-lofted-vessel', OrganicLoftedVesselShape],
]);

export class ShapeFactory {
  create(kind: string, parameters: Params): Shape<Params> {
    const ShapeClass = shapeClasses.get(kind) ?? BoxShape;
    return new ShapeClass(parameters);
  }
}
