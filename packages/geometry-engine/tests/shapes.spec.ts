import { describe, expect, it } from 'vitest';
import {
  BoxShape,
  CubeShape,
  CylinderShape,
  FrustumShape,
  OvalBoxShape,
  ShapeFactory,
  VaseShape,
} from '../src/shapes';

describe('geometry engine', () => {
  it('generates an accurate cylinder wall', () => {
    const shape = new CylinderShape({ diameter: 100, height: 80, wallThickness: 5 });
    expect(shape.generateTemplate().paths[0].points[1].x).toBeCloseTo(Math.PI * 100);
    expect(shape.validate()).toEqual([]);
  });

  it('keeps the cylinder mesh and template consistent as a closed form', () => {
    const shape = new CylinderShape({ diameter: 100, height: 80, wallThickness: 5 });
    const mesh = shape.generateMesh();
    expect(shape.generateTemplate().paths.map((path) => path.label)).toEqual(['Wall', 'Bottom', 'Top']);
    expect(mesh.vertices).toHaveLength(98);
    expect(mesh.indices).toHaveLength(576);
    expect(mesh.vertices.filter((vertex) => vertex.y === 0)).toHaveLength(49);
    expect(mesh.vertices.filter((vertex) => vertex.y === 80)).toHaveLength(49);
    expect(shape.calculateSurfaceArea()).toBeCloseTo(40840.7);
  });

  it('keeps cube meshes closed with matching top and bottom panels', () => {
    const shape = new CubeShape({ width: 100, depth: 100, height: 100, wallThickness: 5 });
    expect(shape.generateTemplate().paths.map((path) => path.label)).toContain('Top');
    expect(shape.generateTemplate().paths).toHaveLength(6);
    expect(shape.generateMesh().indices).toHaveLength(36);
    expect(shape.calculateSurfaceArea()).toBe(60000);
  });

  it('keeps box meshes open where the template has no top panel', () => {
    const shape = new BoxShape({ width: 100, depth: 80, height: 60, wallThickness: 5 });
    expect(shape.generateTemplate().paths).toHaveLength(5);
    expect(shape.generateMesh().indices).toHaveLength(30);
    expect(shape.calculateSurfaceArea()).toBe(29600);
  });

  it('sizes inset lids from the opening, wall thickness, and clearance', () => {
    const box = new BoxShape({
      width: 100,
      depth: 80,
      height: 60,
      wallThickness: 5,
      hasLid: 1,
      lidClearance: 2,
      lidLift: 15,
    });
    const lid = box.generateTemplate().paths.find((path) => path.label === 'Inset lid');
    expect(lid).toBeDefined();
    expect(lid!.points[1].x - lid!.points[0].x).toBe(86);
    expect(lid!.points[2].y - lid!.points[1].y).toBe(66);
    const boxMesh = box.generateMesh();
    expect(boxMesh.indices).toHaveLength(78);
    expect(boxMesh.bodyVertexCount).toBe(8);
    const lidVertices = boxMesh.vertices.slice(boxMesh.bodyVertexCount);
    expect(Math.max(...lidVertices.map((vertex) => vertex.y))).toBeCloseTo(80);
    expect(Math.min(...lidVertices.map((vertex) => vertex.y))).toBeCloseTo(75);

    const vase = new VaseShape({
      topDiameter: 80,
      bottomDiameter: 120,
      height: 140,
      wallThickness: 5,
      hasLid: 1,
      lidClearance: 1,
    });
    const vaseLid = vase.generateTemplate().paths.find((path) => path.label === 'Inset lid');
    const lidWidth =
      Math.max(...vaseLid!.points.map((point) => point.x)) -
      Math.min(...vaseLid!.points.map((point) => point.x));
    // A vase's top diameter describes its opening, so wall thickness must not be removed twice.
    expect(lidWidth).toBeCloseTo(78);
  });

  it('offers overhanging cover lids for rectangular and round forms', () => {
    const box = new BoxShape({
      width: 100,
      depth: 80,
      height: 60,
      wallThickness: 5,
      hasLid: 1,
      lidStyle: 1,
      lidClearance: 2,
    });
    const boxLid = box.generateTemplate().paths.find((path) => path.label === 'Cover lid');
    expect(boxLid).toBeDefined();
    expect(boxLid!.points[1].x - boxLid!.points[0].x).toBe(104);
    expect(boxLid!.points[2].y - boxLid!.points[1].y).toBe(84);

    const vase = new VaseShape({
      topDiameter: 80,
      bottomDiameter: 120,
      height: 140,
      wallThickness: 5,
      hasLid: 1,
      lidStyle: 1,
      lidClearance: 1,
    });
    const vaseLid = vase.generateTemplate().paths.find((path) => path.label === 'Cover lid');
    const diameter =
      Math.max(...vaseLid!.points.map((point) => point.x)) -
      Math.min(...vaseLid!.points.map((point) => point.x));
    expect(diameter).toBeCloseTo(82);
  });

  it('builds a shallow box lid as one printable net with fold lines', () => {
    const box = new BoxShape({
      width: 100,
      depth: 80,
      height: 60,
      wallThickness: 5,
      hasLid: 1,
      lidStyle: 2,
      lidClearance: 2,
      lidLift: 24,
      lidSkirtHeight: 20,
    });
    const template = box.generateTemplate();
    const net = template.paths.find((path) => path.label === 'Box lid net');
    expect(net).toBeDefined();
    expect(net!.points).toHaveLength(12);
    expect(template.paths.filter((path) => path.kind === 'fold')).toHaveLength(4);
    expect(box.generateMesh().vertices).toHaveLength(50);
    expect(box.validate()).toEqual([]);
  });

  it('adds continuous box-lid skirts to vase and oval-box forms', () => {
    const vase = new VaseShape({
      topDiameter: 80,
      bottomDiameter: 120,
      height: 140,
      wallThickness: 5,
      hasLid: 1,
      lidStyle: 2,
      lidClearance: 1,
      lidLift: 24,
      lidSkirtHeight: 18,
    });
    const oval = new OvalBoxShape({
      width: 140,
      depth: 90,
      height: 70,
      roundness: 80,
      wallThickness: 5,
      hasLid: 1,
      lidStyle: 2,
      lidClearance: 1,
      lidLift: 24,
      lidSkirtHeight: 18,
    });
    for (const shape of [vase, oval]) {
      expect(shape.generateTemplate().paths.filter((path) => path.label === 'Lid skirt')).toHaveLength(1);
      expect(shape.validate()).toEqual([]);
      expect(shape.generateMesh().bodyVertexCount).toBeGreaterThan(0);
    }
  });
  it('combines an overhanging top with a separate inset stopper', () => {
    const box = new BoxShape({
      width: 100,
      depth: 80,
      height: 60,
      wallThickness: 5,
      hasLid: 1,
      lidStyle: 3,
      lidClearance: 2,
      lidLift: 12,
      lidSkirtHeight: 20,
    });
    const template = box.generateTemplate();
    const top = template.paths.find((path) => path.label === 'Flush lid top');
    const stopper = template.paths.find((path) => path.label === 'Inset stopper');
    expect(top!.points[1].x - top!.points[0].x).toBe(100);
    expect(stopper!.points[1].x - stopper!.points[0].x).toBe(86);
    expect(box.generateMesh().vertices).toHaveLength(28);
  });

  it('uses the same adjustable oval outline for the mesh and base template', () => {
    const oval = new OvalBoxShape({ width: 160, depth: 100, height: 70, roundness: 100, wallThickness: 5 });
    const roundedBox = new OvalBoxShape({
      width: 160,
      depth: 100,
      height: 70,
      roundness: 0,
      wallThickness: 5,
    });
    expect(oval.validate()).toEqual([]);
    expect(oval.generateTemplate().paths[1].points).toHaveLength(96);
    expect(oval.generateMesh().vertices).toHaveLength(193);
    const expectedEllipsePerimeter = Math.PI * (3 * 130 - Math.sqrt(290 * 230));
    expect(oval.generateTemplate().paths[0].points[1].x).toBeCloseTo(expectedEllipsePerimeter, 0);
    expect(roundedBox.generateTemplate().paths[0].points[1].x).toBeGreaterThan(
      oval.generateTemplate().paths[0].points[1].x,
    );
  });

  it('rejects impossible walls', () =>
    expect(new CylinderShape({ diameter: 10, height: 20, wallThickness: 6 }).validate()[0].field).toBe(
      'wallThickness',
    ));

  it('creates all supported shapes', () => {
    const factory = new ShapeFactory();
    for (const kind of ['cylinder', 'cube', 'box', 'truncated-cone', 'vase', 'bowl', 'oval-box'])
      expect(
        factory.create(
          kind,
          kind === 'cylinder'
            ? { diameter: 10, height: 10, wallThickness: 1 }
            : kind === 'truncated-cone' || kind === 'vase' || kind === 'bowl'
              ? { topDiameter: 8, bottomDiameter: 10, height: 10, wallThickness: 1 }
              : { width: 10, depth: 10, height: 10, wallThickness: 1 },
        ).kind,
      ).toBeTruthy();
  });

  it('calculates frustum volume', () =>
    expect(
      new FrustumShape({
        topDiameter: 10,
        bottomDiameter: 20,
        height: 30,
        wallThickness: 2,
      }).calculateVolume(),
    ).toBeCloseTo(5497.787));
});
