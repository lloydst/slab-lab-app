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
import {
  createBodyGeometry,
  createBottomEdge,
  createEdgeLines,
  createInnerSurface,
  createRim,
} from './preview-geometry';

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
    this.initializeRenderer(canvas);
    this.initializeScene();
    this.initializeCameraAndControls(canvas);
    this.addSceneHelpers();
    this.renderMesh(this.meshData(), this.wallThickness(), this.closedTop());
    this.observeCanvas(canvas);
    this.startAnimation();
  }

  private initializeRenderer(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  }

  private initializeScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#eef0e9');
  }

  private initializeCameraAndControls(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
    this.camera.position.set(270, 220, 300);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 70, 0);
  }

  private addSceneHelpers() {
    if (!this.scene) return;
    this.scene.add(new THREE.HemisphereLight(0xfff7e5, 0x425246, 2.8));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(200, 300, 180);
    this.scene.add(key);
    const grid = new THREE.GridHelper(500, 20, 0xa3aa9f, 0xd5d8d1);
    this.scene.add(grid);
  }

  private observeCanvas(canvas: HTMLCanvasElement) {
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
  }

  private startAnimation() {
    const animate = () => {
      this.controls?.update();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
      this.frame = requestAnimationFrame(animate);
    };
    animate();
  }

  private renderMesh(data: MeshData, thickness: number, closedTop: boolean) {
    if (!this.scene) return;
    this.disposeRenderedObjects();

    const geometry = this.createGeometry(data);
    this.addOuterSurface(geometry);
    this.addInnerSurface(geometry, data.bodyVertexCount, thickness, closedTop);
  }

  private disposeRenderedObjects() {
    const objects = [
      this.mesh,
      this.edges,
      this.innerSurface,
      this.innerEdges,
      this.innerBottomEdge,
      this.rim,
    ];
    for (const object of objects) {
      if (!object) continue;
      this.scene?.remove(object);
      object.geometry.dispose();
      if (object.material instanceof THREE.Material) object.material.dispose();
    }
  }

  private createGeometry(data: MeshData) {
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
    return geometry;
  }

  private addOuterSurface(geometry: THREE.BufferGeometry) {
    if (!this.scene) return;
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
  }

  private addInnerSurface(
    geometry: THREE.BufferGeometry,
    bodyVertexCount: number | undefined,
    thickness: number,
    closedTop: boolean,
  ) {
    if (!this.scene) return;
    const bodyGeometry = createBodyGeometry(geometry, bodyVertexCount);
    const geometryFactories = {
      open: () => {
        const innerSurface = createInnerSurface(bodyGeometry, thickness);
        return {
          innerSurface,
          innerEdges: innerSurface && createEdgeLines(innerSurface.geometry),
          innerBottomEdge: innerSurface && createBottomEdge(innerSurface.geometry),
          rim: createRim(bodyGeometry, thickness),
        };
      },
      closed: () => ({
        innerSurface: undefined,
        innerEdges: undefined,
        innerBottomEdge: undefined,
        rim: undefined,
      }),
    };
    const surfaces = geometryFactories[closedTop ? 'closed' : 'open']();
    this.innerSurface = surfaces.innerSurface;
    this.innerEdges = surfaces.innerEdges;
    this.innerBottomEdge = surfaces.innerBottomEdge;
    this.rim = surfaces.rim;
    this.scene.add(
      ...Object.values(surfaces).filter((surface) => surface !== undefined),
    );
    if (bodyGeometry !== geometry) bodyGeometry.dispose();
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
    const previewObjects = {
      mesh: this.mesh,
      edges: this.edges,
      innerSurface: this.innerSurface,
      innerEdges: this.innerEdges,
      innerBottomEdge: this.innerBottomEdge,
      rim: this.rim,
    };
    Object.values(previewObjects).forEach((object) => {
      object?.geometry.dispose();
      if (object?.material instanceof THREE.Material) object.material.dispose();
    });
    this.renderer?.dispose();
  }
}
