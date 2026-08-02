import type { MeshData } from '@slablab/geometry-engine';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createBodyGeometry,
  createBottomEdge,
  createEdgeLines,
  createInnerSurface,
  createRim,
} from './preview-geometry';

type PreviewObject = THREE.Mesh | THREE.LineSegments | THREE.LineLoop;
type PreviewObjectKey =
  | 'mesh'
  | 'edges'
  | 'innerSurface'
  | 'innerEdges'
  | 'innerBottomEdge'
  | 'rim';

export class PreviewRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
  private readonly controls: OrbitControls;
  private readonly observer: ResizeObserver;
  private readonly objects: Record<PreviewObjectKey, PreviewObject | undefined> = {
    mesh: undefined,
    edges: undefined,
    innerSurface: undefined,
    innerEdges: undefined,
    innerBottomEdge: undefined,
    rim: undefined,
  };
  private frame = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    this.scene.background = new THREE.Color('#eef0e9');
    this.camera.position.set(270, 220, 300);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 70, 0);

    this.addSceneHelpers();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.startAnimation();
  }

  render(data: MeshData, thickness: number, closedTop: boolean): void {
    this.disposeObjects();
    const geometry = this.createGeometry(data);
    this.addOuterSurface(geometry);
    this.addInnerSurface(geometry, data.bodyVertexCount, thickness, closedTop);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.disposeObjects();
    this.renderer.dispose();
  }

  private addSceneHelpers(): void {
    this.scene.add(new THREE.HemisphereLight(0xfff7e5, 0x425246, 2.8));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(200, 300, 180);
    this.scene.add(key);
    this.scene.add(new THREE.GridHelper(500, 20, 0xa3aa9f, 0xd5d8d1));
  }

  private startAnimation(): void {
    const animate = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.frame = requestAnimationFrame(animate);
    };
    animate();
  }

  private disposeObjects(): void {
    for (const key of Object.keys(this.objects) as PreviewObjectKey[]) {
      const object = this.objects[key];
      if (!object) continue;
      this.scene.remove(object);
      object.geometry.dispose();
      if (object.material instanceof THREE.Material) object.material.dispose();
      this.objects[key] = undefined;
    }
  }

  private createGeometry(data: MeshData): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        data.vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]),
        3,
      ),
    );
    geometry.setIndex(data.indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  private addOuterSurface(geometry: THREE.BufferGeometry): void {
    this.objects.mesh = new THREE.Mesh(
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
    this.objects.edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.72 }),
    );
    this.objects.edges.renderOrder = 1;
    this.scene.add(this.objects.mesh, this.objects.edges);
  }

  private addInnerSurface(
    geometry: THREE.BufferGeometry,
    bodyVertexCount: number | undefined,
    thickness: number,
    closedTop: boolean,
  ): void {
    if (closedTop) return;
    const bodyGeometry = createBodyGeometry(geometry, bodyVertexCount);
    const innerSurface = createInnerSurface(bodyGeometry, thickness);
    const surfaces = {
      innerSurface,
      innerEdges: innerSurface && createEdgeLines(innerSurface.geometry),
      innerBottomEdge: innerSurface && createBottomEdge(innerSurface.geometry),
      rim: createRim(bodyGeometry, thickness),
    };
    Object.assign(this.objects, surfaces);
    this.scene.add(...Object.values(surfaces).filter((surface) => surface !== undefined));
    if (bodyGeometry !== geometry) bodyGeometry.dispose();
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
