import { BoundingBox, MeshData, Shape, SlabTemplate, ValidationIssue, rectangle } from './model';

type Params = Record<string, number>;
const positive = (parameters: Params, fields: string[]): ValidationIssue[] =>
  fields
    .filter((field) => !Number.isFinite(parameters[field]) || parameters[field] <= 0)
    .map((field) => ({ field, message: 'Must be greater than zero' }));
const prismMesh = (width: number, depth: number, height: number, includeTop = false): MeshData => ({
  vertices: [
    { x: -width / 2, y: 0, z: -depth / 2 },
    { x: width / 2, y: 0, z: -depth / 2 },
    { x: width / 2, y: height, z: -depth / 2 },
    { x: -width / 2, y: height, z: -depth / 2 },
    { x: -width / 2, y: 0, z: depth / 2 },
    { x: width / 2, y: 0, z: depth / 2 },
    { x: width / 2, y: height, z: depth / 2 },
    { x: -width / 2, y: height, z: depth / 2 },
  ],
  indices: [
    0,
    1,
    2,
    0,
    2,
    3,
    4,
    6,
    5,
    4,
    7,
    6,
    0,
    4,
    5,
    0,
    5,
    1,
    1,
    5,
    6,
    1,
    6,
    2,
    0,
    3,
    7,
    0,
    7,
    4,
    ...(includeTop ? [3, 2, 6, 3, 6, 7] : []),
  ],
});

abstract class BaseShape implements Shape<Params> {
  abstract readonly kind: string;
  constructor(public readonly parameters: Params) {}
  abstract generateMesh(): MeshData;
  abstract generateTemplate(): SlabTemplate;
  abstract calculateDimensions(): BoundingBox;
  abstract calculateSurfaceArea(): number;
  abstract calculateVolume(): number;
  abstract validate(): ValidationIssue[];
  calculateBoundingBox(): BoundingBox {
    return this.calculateDimensions();
  }
}

export class BoxShape extends BaseShape {
  readonly kind: string = 'box';
  protected readonly includeTop: boolean = false;
  validate() {
    const issues = positive(this.parameters, ['width', 'depth', 'height', 'wallThickness']).concat(
      this.parameters.wallThickness * 2 >= Math.min(this.parameters.width, this.parameters.depth)
        ? [{ field: 'wallThickness', message: 'Wall thickness must be less than half the smallest side' }]
        : [],
    );
    if (!this.includeTop && this.parameters.hasLid >= 0.5) {
      if (!Number.isFinite(this.parameters.lidClearance) || this.parameters.lidClearance < 0)
        issues.push({ field: 'lidClearance', message: 'Lid clearance cannot be negative' });
      if (this.lidWidth <= 0 || this.lidDepth <= 0)
        issues.push({
          field: 'lidClearance',
          message: 'Wall thickness and clearance leave no room for a lid',
        });
    }
    return issues;
  }
  protected get hasLid() {
    return !this.includeTop && this.parameters.hasLid >= 0.5;
  }
  protected get lidWidth() {
    return this.parameters.width - 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
  }
  protected get lidDepth() {
    return this.parameters.depth - 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
  }
  calculateDimensions() {
    const { width, depth, height } = this.parameters;
    return { width, depth, height };
  }
  calculateSurfaceArea() {
    const { width: w, depth: d, height: h } = this.parameters;
    return (
      w * d * (this.includeTop ? 2 : 1) +
      2 * w * h +
      2 * d * h +
      (this.hasLid ? this.lidWidth * this.lidDepth : 0)
    );
  }
  calculateVolume() {
    const { width: w, depth: d, height: h, wallThickness: t } = this.parameters;
    const body =
      w * d * h -
      Math.max(0, w - 2 * t) * Math.max(0, d - 2 * t) * Math.max(0, h - (this.includeTop ? 2 * t : t));
    return body + (this.hasLid ? this.lidWidth * this.lidDepth * t : 0);
  }
  generateMesh() {
    const { width, depth, height } = this.parameters;
    const mesh = prismMesh(width, depth, height, this.includeTop);
    if (this.hasLid) addRectangularCap(mesh, this.lidWidth, this.lidDepth, height);
    return mesh;
  }
  generateTemplate(): SlabTemplate {
    const { width: w, depth: d, height: h } = this.parameters;
    const gap = 10;
    const paths = [
      rectangle(0, 0, w, d, 'Base', 1),
      rectangle(w + gap, 0, w, h, 'Front', 2),
      rectangle(w + gap, h + gap, w, h, 'Back', 3),
      rectangle(2 * w + 2 * gap, 0, d, h, 'Right', 4),
      rectangle(2 * w + 2 * gap, h + gap, d, h, 'Left', 5),
    ];
    if (this.includeTop) paths.push(rectangle(0, d + gap, w, d, 'Top', 6));
    if (this.hasLid) paths.push(rectangle(0, d + gap, this.lidWidth, this.lidDepth, 'Inset lid', 6));
    return {
      paths,
      dimensions: {
        width: 2 * w + d + 2 * gap,
        height: Math.max(
          2 * h + gap,
          this.includeTop ? 2 * d + gap : this.hasLid ? d + gap + this.lidDepth : d,
        ),
      },
      unit: 'mm',
      notes: ['Score and slip matching labelled edges.'],
    };
  }
}

export class CubeShape extends BoxShape {
  override readonly kind = 'cube';
  protected override readonly includeTop: boolean = true;
}

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
      notes: ['Join wall edges A–A. Attach base edge B.'],
    };
  }
}

export class FrustumShape extends BaseShape {
  readonly kind: string = 'frustum';
  protected readonly includeTop: boolean = true;
  validate() {
    const issues = positive(this.parameters, ['topDiameter', 'bottomDiameter', 'height', 'wallThickness']);
    const slant = Math.hypot(
      (this.parameters.topDiameter - this.parameters.bottomDiameter) / 2,
      this.parameters.height,
    );
    const result = issues.concat(
      slant <= Math.abs(this.parameters.topDiameter - this.parameters.bottomDiameter) / 2
        ? [{ field: 'height', message: 'Invalid taper angle' }]
        : [],
    );
    if (this.hasLid && (!Number.isFinite(this.parameters.lidClearance) || this.parameters.lidClearance < 0))
      result.push({ field: 'lidClearance', message: 'Lid clearance cannot be negative' });
    if (this.hasLid && this.lidDiameter <= 0)
      result.push({ field: 'lidClearance', message: 'Wall thickness and clearance leave no room for a lid' });
    return result;
  }
  protected get hasLid() {
    return !this.includeTop && this.parameters.hasLid >= 0.5;
  }
  protected get lidDiameter() {
    return this.parameters.topDiameter - 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
  }
  calculateDimensions() {
    const diameter = Math.max(this.parameters.topDiameter, this.parameters.bottomDiameter);
    return { width: diameter, depth: diameter, height: this.parameters.height };
  }
  calculateSurfaceArea() {
    const r1 = this.parameters.topDiameter / 2,
      r2 = this.parameters.bottomDiameter / 2,
      s = Math.hypot(r1 - r2, this.parameters.height);
    return (
      Math.PI * (r1 + r2) * s +
      Math.PI * r2 * r2 +
      (this.includeTop ? Math.PI * r1 * r1 : 0) +
      (this.hasLid ? Math.PI * (this.lidDiameter / 2) ** 2 : 0)
    );
  }
  calculateVolume() {
    const r1 = this.parameters.topDiameter / 2,
      r2 = this.parameters.bottomDiameter / 2,
      h = this.parameters.height;
    return (Math.PI * h * (r1 * r1 + r1 * r2 + r2 * r2)) / 3;
  }
  generateMesh() {
    const mesh = radialMesh(
      this.parameters.bottomDiameter / 2,
      this.parameters.topDiameter / 2,
      this.parameters.height,
      48,
      true,
      this.includeTop,
    );
    if (this.hasLid) addRadialCap(mesh, this.lidDiameter / 2, this.parameters.height);
    return mesh;
  }
  generateTemplate(): SlabTemplate {
    const { topDiameter: td, bottomDiameter: bd, height: h } = this.parameters;
    if (Math.abs(td - bd) < 0.001)
      return new CylinderShape({
        diameter: td,
        height: h,
        wallThickness: this.parameters.wallThickness,
      }).generateTemplate();
    const r1 = bd / 2,
      r2 = td / 2,
      s = Math.hypot(r1 - r2, h),
      outer = (s * Math.max(r1, r2)) / Math.abs(r1 - r2),
      inner = outer - s,
      angle = (2 * Math.PI * Math.abs(r1 - r2)) / s;
    const points = sectorPoints(inner, outer, angle);
    const paths: SlabTemplate['paths'] = [
      { points, closed: true, kind: 'cut', label: 'Tapered wall', assemblyNumber: 1 },
      circlePath(outer * 2 + bd / 2 + 10, bd / 2, bd / 2, 'Bottom', 2),
    ];
    if (this.includeTop) paths.push(circlePath(outer * 2 + bd + td / 2 + 20, td / 2, td / 2, 'Top', 3));
    if (this.hasLid)
      paths.push(
        circlePath(
          outer * 2 + bd + this.lidDiameter / 2 + 20,
          this.lidDiameter / 2,
          this.lidDiameter / 2,
          'Inset lid',
          3,
        ),
      );
    return {
      paths,
      dimensions: {
        width: outer * 2 + bd + (this.includeTop ? td + 20 : this.hasLid ? this.lidDiameter + 20 : 10),
        height: outer * 2,
      },
      unit: 'mm',
      notes: ['Join radial edges A–A.'],
    };
  }
}

export class BowlShape extends FrustumShape {
  override readonly kind = 'bowl';
  protected override readonly includeTop: boolean = false;
}
export class VaseShape extends FrustumShape {
  override readonly kind = 'vase';
  protected override readonly includeTop: boolean = false;
}
export class OvalBoxShape extends BaseShape {
  readonly kind = 'oval-box';
  validate() {
    const issues = positive(this.parameters, ['width', 'depth', 'height', 'wallThickness']);
    if (this.parameters.wallThickness * 2 >= Math.min(this.parameters.width, this.parameters.depth))
      issues.push({
        field: 'wallThickness',
        message: 'Wall thickness must be less than half the smallest side',
      });
    if (
      !Number.isFinite(this.parameters.roundness) ||
      this.parameters.roundness < 0 ||
      this.parameters.roundness > 100
    )
      issues.push({ field: 'roundness', message: 'Roundness must be between 0 and 100' });
    if (this.hasLid && (!Number.isFinite(this.parameters.lidClearance) || this.parameters.lidClearance < 0))
      issues.push({ field: 'lidClearance', message: 'Lid clearance cannot be negative' });
    if (this.hasLid && (this.lidWidth <= 0 || this.lidDepth <= 0))
      issues.push({ field: 'lidClearance', message: 'Wall thickness and clearance leave no room for a lid' });
    return issues;
  }
  private get hasLid() {
    return this.parameters.hasLid >= 0.5;
  }
  private get lidWidth() {
    return this.parameters.width - 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
  }
  private get lidDepth() {
    return this.parameters.depth - 2 * (this.parameters.wallThickness + this.parameters.lidClearance);
  }
  private outline(width = this.parameters.width, depth = this.parameters.depth) {
    return superellipsePoints(width, depth, this.parameters.roundness);
  }
  calculateDimensions() {
    const { width, depth, height } = this.parameters;
    return { width, depth, height };
  }
  calculateSurfaceArea() {
    const outline = this.outline();
    return (
      polygonArea(outline) +
      polygonPerimeter(outline) * this.parameters.height +
      (this.hasLid ? polygonArea(this.outline(this.lidWidth, this.lidDepth)) : 0)
    );
  }
  calculateVolume() {
    const { width, depth, height, wallThickness: thickness } = this.parameters;
    const outerArea = polygonArea(this.outline());
    const innerArea = polygonArea(this.outline(width - 2 * thickness, depth - 2 * thickness));
    return (
      outerArea * height -
      innerArea * Math.max(0, height - thickness) +
      (this.hasLid ? polygonArea(this.outline(this.lidWidth, this.lidDepth)) * thickness : 0)
    );
  }
  generateMesh(): MeshData {
    const outline = this.outline();
    const vertices = outline.flatMap((point) => [
      { x: point.x, y: 0, z: point.y },
      { x: point.x, y: this.parameters.height, z: point.y },
    ]);
    const indices: number[] = [];
    for (let i = 0; i < outline.length; i++) {
      const next = (i + 1) % outline.length;
      const bottom = i * 2,
        top = bottom + 1,
        nextBottom = next * 2,
        nextTop = nextBottom + 1;
      indices.push(bottom, nextBottom, top, nextBottom, nextTop, top);
    }
    const bottomCenter = vertices.length;
    vertices.push({ x: 0, y: 0, z: 0 });
    for (let i = 0; i < outline.length; i++)
      indices.push(bottomCenter, ((i + 1) % outline.length) * 2, i * 2);
    const mesh = { vertices, indices };
    if (this.hasLid) addPolygonCap(mesh, this.outline(this.lidWidth, this.lidDepth), this.parameters.height);
    return mesh;
  }
  generateTemplate(): SlabTemplate {
    const outline = this.outline();
    const perimeter = polygonPerimeter(outline);
    const gap = 10;
    const paths: SlabTemplate['paths'] = [
      rectangle(0, 0, perimeter, this.parameters.height, 'Wall', 1),
      {
        points: outline.map((point) => ({
          x: point.x + perimeter + gap + this.parameters.width / 2,
          y: point.y + this.parameters.depth / 2,
        })),
        closed: true,
        kind: 'cut',
        label: 'Base',
        assemblyNumber: 2,
      },
    ];
    if (this.hasLid)
      paths.push({
        points: this.outline(this.lidWidth, this.lidDepth).map((point) => ({
          x: point.x + perimeter + gap + this.parameters.width + gap + this.lidWidth / 2,
          y: point.y + this.lidDepth / 2,
        })),
        closed: true,
        kind: 'cut',
        label: 'Inset lid',
        assemblyNumber: 3,
      });
    return {
      paths,
      dimensions: {
        width: perimeter + gap + this.parameters.width + (this.hasLid ? gap + this.lidWidth : 0),
        height: Math.max(this.parameters.height, this.parameters.depth),
      },
      unit: 'mm',
      notes: ['Join wall edges A–A. Attach the wall around base edge B.'],
    };
  }
}

const circlePath = (cx: number, cy: number, r: number, label: string, assemblyNumber: number) => ({
  points: Array.from({ length: 64 }, (_, i) => ({
    x: cx + Math.cos((i / 64) * Math.PI * 2) * r,
    y: cy + Math.sin((i / 64) * Math.PI * 2) * r,
  })),
  closed: true,
  kind: 'cut' as const,
  label,
  assemblyNumber,
});
const sectorPoints = (inner: number, outer: number, angle: number) => {
  const steps = 64;
  const outerPts = Array.from({ length: steps + 1 }, (_, i) => ({
    x: outer + Math.cos(-angle / 2 + (i / steps) * angle) * outer,
    y: outer + Math.sin(-angle / 2 + (i / steps) * angle) * outer,
  }));
  const innerPts = Array.from({ length: steps + 1 }, (_, i) => ({
    x: outer + Math.cos(angle / 2 - (i / steps) * angle) * inner,
    y: outer + Math.sin(angle / 2 - (i / steps) * angle) * inner,
  }));
  return [...outerPts, ...innerPts];
};
const superellipsePoints = (width: number, depth: number, roundness: number, segments = 96) => {
  const exponent = 8 - (Math.min(100, Math.max(0, roundness)) / 100) * 6;
  return Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return {
      x: (width / 2) * Math.sign(cosine) * Math.pow(Math.abs(cosine), 2 / exponent),
      y: (depth / 2) * Math.sign(sine) * Math.pow(Math.abs(sine), 2 / exponent),
    };
  });
};
const polygonPerimeter = (points: { x: number; y: number }[]) =>
  points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0);
const polygonArea = (points: { x: number; y: number }[]) =>
  Math.abs(
    points.reduce((total, point, index) => {
      const next = points[(index + 1) % points.length];
      return total + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
const addPolygonCap = (mesh: MeshData, outline: { x: number; y: number }[], height: number) => {
  const start = mesh.vertices.length;
  mesh.vertices.push(...outline.map((point) => ({ x: point.x, y: height, z: point.y })));
  const center = mesh.vertices.length;
  mesh.vertices.push({ x: 0, y: height, z: 0 });
  for (let index = 0; index < outline.length; index++)
    mesh.indices.push(center, start + index, start + ((index + 1) % outline.length));
};
const addRectangularCap = (mesh: MeshData, width: number, depth: number, height: number) =>
  addPolygonCap(
    mesh,
    [
      { x: -width / 2, y: -depth / 2 },
      { x: width / 2, y: -depth / 2 },
      { x: width / 2, y: depth / 2 },
      { x: -width / 2, y: depth / 2 },
    ],
    height,
  );
const addRadialCap = (mesh: MeshData, radius: number, height: number, segments = 64) =>
  addPolygonCap(
    mesh,
    Array.from({ length: segments }, (_, index) => ({
      x: Math.cos((index / segments) * Math.PI * 2) * radius,
      y: Math.sin((index / segments) * Math.PI * 2) * radius,
    })),
    height,
  );
const radialMesh = (
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments = 48,
  includeBottom = true,
  includeTop = true,
): MeshData => {
  const vertices = [];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    vertices.push(
      { x: Math.cos(a) * bottomRadius, y: 0, z: Math.sin(a) * bottomRadius },
      { x: Math.cos(a) * topRadius, y: height, z: Math.sin(a) * topRadius },
    );
  }
  for (let i = 0; i < segments; i++) {
    const n = (i + 1) % segments,
      b = i * 2,
      t = b + 1,
      bn = n * 2,
      tn = bn + 1;
    indices.push(b, bn, t, bn, tn, t);
  }
  if (includeBottom) {
    const bottomCenter = vertices.length;
    vertices.push({ x: 0, y: 0, z: 0 });
    for (let i = 0; i < segments; i++) {
      const nextBottom = ((i + 1) % segments) * 2;
      indices.push(bottomCenter, nextBottom, i * 2);
    }
  }
  if (includeTop) {
    const topCenter = vertices.length;
    vertices.push({ x: 0, y: height, z: 0 });
    for (let i = 0; i < segments; i++) {
      const nextTop = ((i + 1) % segments) * 2 + 1;
      indices.push(topCenter, i * 2 + 1, nextTop);
    }
  }
  return { vertices, indices };
};

export const shapeDefaults: Record<string, Params> = {
  cylinder: { diameter: 120, height: 140, wallThickness: 6 },
  cube: { width: 120, depth: 120, height: 120, wallThickness: 6 },
  box: { width: 160, depth: 110, height: 90, wallThickness: 6, hasLid: 0, lidClearance: 1.5 },
  'truncated-cone': { topDiameter: 90, bottomDiameter: 150, height: 130, wallThickness: 6 },
  vase: { topDiameter: 80, bottomDiameter: 130, height: 200, wallThickness: 6, hasLid: 0, lidClearance: 1.5 },
  bowl: { topDiameter: 180, bottomDiameter: 80, height: 90, wallThickness: 6, hasLid: 0, lidClearance: 1.5 },
  'oval-box': {
    width: 170,
    depth: 110,
    height: 80,
    roundness: 80,
    wallThickness: 6,
    hasLid: 0,
    lidClearance: 1.5,
  },
};

export const frustumPresets: Record<'tapered' | 'frustum', Params> = {
  tapered: { topDiameter: 110, bottomDiameter: 140, height: 160, wallThickness: 6 },
  frustum: { topDiameter: 90, bottomDiameter: 150, height: 130, wallThickness: 6 },
};

export class ShapeFactory {
  create(kind: string, parameters: Params): Shape<Params> {
    if (kind === 'cylinder') return new CylinderShape(parameters);
    if (kind === 'truncated-cone') return new FrustumShape(parameters);
    if (kind === 'bowl') return new BowlShape(parameters);
    if (kind === 'vase') return new VaseShape(parameters);
    if (kind === 'oval-box') return new OvalBoxShape(parameters);
    if (kind === 'cube') return new CubeShape(parameters);
    return new BoxShape(parameters);
  }
}
