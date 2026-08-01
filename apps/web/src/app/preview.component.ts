import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MeshData } from '@slablab/geometry-engine';

@Component({
  selector: 'slab-preview',
  standalone: true,
  templateUrl: './preview.component.html',
  styleUrl: './preview.component.scss',
})
export class PreviewComponent {
  readonly meshData = input.required<MeshData>();
  readonly wallThickness = input(0);
  readonly thicknessLabel = input('');
  readonly closedTop = input(false);
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private mesh?: THREE.Mesh;
  private edges?: THREE.LineSegments;
  private innerSurface?: THREE.Mesh;
  private innerEdges?: THREE.LineSegments;
  private innerBottomEdge?: THREE.LineLoop;
  private rim?: THREE.Mesh;
  private controls?: OrbitControls;
  private frame = 0;
  private observer?: ResizeObserver;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const data = this.meshData();
      const thickness = this.wallThickness();
      const closedTop = this.closedTop();
      if (this.scene) this.renderMesh(data, thickness, closedTop);
    });

    afterNextRender(() => this.initializePreview());
    this.destroyRef.onDestroy(() => this.disposePreview());
  }

  private initializePreview() {
    const canvas = this.canvas().nativeElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#eef0e9');
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
    this.camera.position.set(270, 220, 300);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 70, 0);
    this.scene.add(new THREE.HemisphereLight(0xfff7e5, 0x425246, 2.8));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(200, 300, 180);
    this.scene.add(key);
    const grid = new THREE.GridHelper(500, 20, 0xa3aa9f, 0xd5d8d1);
    this.scene.add(grid);
    this.renderMesh(this.meshData(), this.wallThickness(), this.closedTop());
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    const animate = () => {
      this.controls?.update();
      this.renderer?.render(this.scene!, this.camera!);
      this.frame = requestAnimationFrame(animate);
    };
    animate();
  }
  private renderMesh(data: MeshData, thickness: number, closedTop: boolean) {
    if (!this.scene) return;
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (this.mesh.material instanceof THREE.Material) this.mesh.material.dispose();
    }
    if (this.edges) {
      this.scene.remove(this.edges);
      this.edges.geometry.dispose();
      if (this.edges.material instanceof THREE.Material) this.edges.material.dispose();
    }
    if (this.innerSurface) {
      this.scene.remove(this.innerSurface);
      this.innerSurface.geometry.dispose();
      if (this.innerSurface.material instanceof THREE.Material) this.innerSurface.material.dispose();
    }
    if (this.innerEdges) {
      this.scene.remove(this.innerEdges);
      this.innerEdges.geometry.dispose();
      if (this.innerEdges.material instanceof THREE.Material) this.innerEdges.material.dispose();
    }
    if (this.innerBottomEdge) {
      this.scene.remove(this.innerBottomEdge);
      this.innerBottomEdge.geometry.dispose();
      if (this.innerBottomEdge.material instanceof THREE.Material) this.innerBottomEdge.material.dispose();
    }
    if (this.rim) {
      this.scene.remove(this.rim);
      this.rim.geometry.dispose();
      if (this.rim.material instanceof THREE.Material) this.rim.material.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        data.vertices.flatMap((v) => [v.x, v.y, v.z]),
        3,
      ),
    );
    geometry.setIndex(data.indices);
    geometry.computeVertexNormals();
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0xb96843,
        roughness: 0.78,
        metalness: 0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    this.scene.add(this.mesh);
    this.edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.72 }),
    );
    this.edges.renderOrder = 1;
    this.scene.add(this.edges);

    this.innerSurface = closedTop ? undefined : this.createInnerSurface(geometry, thickness);
    if (this.innerSurface) this.scene.add(this.innerSurface);
    this.innerEdges = this.innerSurface ? this.createEdgeLines(this.innerSurface.geometry) : undefined;
    if (this.innerEdges) this.scene.add(this.innerEdges);
    this.innerBottomEdge = this.innerSurface ? this.createBottomEdge(this.innerSurface.geometry) : undefined;
    if (this.innerBottomEdge) this.scene.add(this.innerBottomEdge);
    this.rim = closedTop ? undefined : this.createRim(geometry, thickness);
    if (this.rim) this.scene.add(this.rim);
  }

  private createInnerSurface(outerGeometry: THREE.BufferGeometry, thickness: number): THREE.Mesh | undefined {
    if (!Number.isFinite(thickness) || thickness <= 0) return undefined;
    outerGeometry.computeBoundingBox();
    const bounds = outerGeometry.boundingBox;
    if (!bounds) return undefined;
    const width = bounds.max.x - bounds.min.x;
    const depth = bounds.max.z - bounds.min.z;
    const height = bounds.max.y - bounds.min.y;
    if (thickness * 2 >= Math.min(width, depth) || thickness >= height) return undefined;

    const innerGeometry = outerGeometry.clone();
    const positions = innerGeometry.getAttribute('position');
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    const scaleX = (width - thickness * 2) / width;
    const scaleZ = (depth - thickness * 2) / depth;
    const innerBottom = bounds.min.y + thickness;
    const innerTop = bounds.max.y;

    for (let index = 0; index < positions.count; index += 1) {
      const normalizedHeight = (positions.getY(index) - bounds.min.y) / height;
      positions.setXYZ(
        index,
        centerX + (positions.getX(index) - centerX) * scaleX,
        innerBottom + normalizedHeight * (innerTop - innerBottom),
        centerZ + (positions.getZ(index) - centerZ) * scaleZ,
      );
    }
    positions.needsUpdate = true;
    innerGeometry.computeVertexNormals();

    const innerSurface = new THREE.Mesh(
      innerGeometry,
      new THREE.MeshStandardMaterial({
        color: '#e3a06f',
        roughness: 0.86,
        metalness: 0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    innerSurface.renderOrder = 1;
    return innerSurface;
  }

  private createEdgeLines(geometry: THREE.BufferGeometry): THREE.LineSegments {
    const edgeLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.92 }),
    );
    edgeLines.renderOrder = 2;
    return edgeLines;
  }

  private createBottomEdge(geometry: THREE.BufferGeometry): THREE.LineLoop | undefined {
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (!bounds) return undefined;
    const positions = geometry.getAttribute('position');
    const points = new Map<string, THREE.Vector2>();
    for (let index = 0; index < positions.count; index += 1) {
      if (Math.abs(positions.getY(index) - bounds.min.y) > 0.001) continue;
      const point = new THREE.Vector2(positions.getX(index), positions.getZ(index));
      points.set(`${point.x.toFixed(5)}:${point.y.toFixed(5)}`, point);
    }
    const outline = this.convexHull([...points.values()]);
    if (outline.length < 3) return undefined;
    const edgeGeometry = new THREE.BufferGeometry().setFromPoints(
      outline.map((point) => new THREE.Vector3(point.x, bounds.min.y + 0.08, point.y)),
    );
    const edge = new THREE.LineLoop(edgeGeometry, new THREE.LineBasicMaterial({ color: '#000000' }));
    edge.renderOrder = 3;
    return edge;
  }

  private createRim(outerGeometry: THREE.BufferGeometry, thickness: number): THREE.Mesh | undefined {
    const bounds = outerGeometry.boundingBox;
    if (!bounds || !Number.isFinite(thickness) || thickness <= 0) return undefined;
    const width = bounds.max.x - bounds.min.x;
    const depth = bounds.max.z - bounds.min.z;
    if (thickness * 2 >= Math.min(width, depth)) return undefined;

    const positions = outerGeometry.getAttribute('position');
    const topPoints = new Map<string, THREE.Vector2>();
    for (let index = 0; index < positions.count; index += 1) {
      if (Math.abs(positions.getY(index) - bounds.max.y) > 0.001) continue;
      const point = new THREE.Vector2(positions.getX(index), positions.getZ(index));
      topPoints.set(`${point.x.toFixed(5)}:${point.y.toFixed(5)}`, point);
    }
    const outline = this.convexHull([...topPoints.values()]);
    if (outline.length < 3) return undefined;

    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    const scaleX = (width - thickness * 2) / width;
    const scaleZ = (depth - thickness * 2) / depth;
    const rimPositions = outline.flatMap((point) => [
      point.x,
      bounds.max.y,
      point.y,
      centerX + (point.x - centerX) * scaleX,
      bounds.max.y,
      centerZ + (point.y - centerZ) * scaleZ,
    ]);
    const indices: number[] = [];
    for (let index = 0; index < outline.length; index += 1) {
      const next = (index + 1) % outline.length;
      indices.push(index * 2, next * 2, index * 2 + 1, next * 2, next * 2 + 1, index * 2 + 1);
    }
    const rimGeometry = new THREE.BufferGeometry();
    rimGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rimPositions, 3));
    rimGeometry.setIndex(indices);
    rimGeometry.computeVertexNormals();
    return new THREE.Mesh(
      rimGeometry,
      new THREE.MeshStandardMaterial({
        color: '#d98c5a',
        roughness: 0.84,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
  }

  private convexHull(points: THREE.Vector2[]): THREE.Vector2[] {
    if (points.length <= 3) return points;
    const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (origin: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2) =>
      (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
    const half: THREE.Vector2[] = [];
    const append = (point: THREE.Vector2) => {
      while (half.length >= 2 && cross(half.at(-2)!, half.at(-1)!, point) <= 0) half.pop();
      half.push(point);
    };
    sorted.forEach(append);
    half.pop();
    const lower = [...half];
    half.length = 0;
    sorted.reverse().forEach(append);
    half.pop();
    return lower.concat(half);
  }
  private resize() {
    if (!this.renderer || !this.camera) return;
    const { clientWidth: w, clientHeight: h } = this.canvas().nativeElement;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private disposePreview() {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.controls?.dispose();
    this.mesh?.geometry.dispose();
    if (this.mesh?.material instanceof THREE.Material) this.mesh.material.dispose();
    this.edges?.geometry.dispose();
    if (this.edges?.material instanceof THREE.Material) this.edges.material.dispose();
    this.innerSurface?.geometry.dispose();
    if (this.innerSurface?.material instanceof THREE.Material) this.innerSurface.material.dispose();
    this.innerEdges?.geometry.dispose();
    if (this.innerEdges?.material instanceof THREE.Material) this.innerEdges.material.dispose();
    this.innerBottomEdge?.geometry.dispose();
    if (this.innerBottomEdge?.material instanceof THREE.Material) this.innerBottomEdge.material.dispose();
    this.rim?.geometry.dispose();
    if (this.rim?.material instanceof THREE.Material) this.rim.material.dispose();
    this.renderer?.dispose();
  }
}
