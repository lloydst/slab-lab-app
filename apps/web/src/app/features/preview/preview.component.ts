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
import type { MeshData } from '@slablab/geometry-engine';
import { PreviewRenderer } from './preview-renderer';

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
  private preview?: PreviewRenderer;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const data = this.meshData();
      const thickness = this.wallThickness();
      const closedTop = this.closedTop();
      this.preview?.render(data, thickness, closedTop);
    });

    afterNextRender(() => {
      this.preview = new PreviewRenderer(this.canvas().nativeElement);
      this.preview.render(this.meshData(), this.wallThickness(), this.closedTop());
    });

    this.destroyRef.onDestroy(() => this.preview?.dispose());
  }
}
