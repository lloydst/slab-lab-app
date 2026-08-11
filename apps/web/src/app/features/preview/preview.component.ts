import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
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
  readonly interacting = signal(false);
  private preview?: PreviewRenderer;
  private interactionTimer?: ReturnType<typeof setTimeout>;
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

    this.destroyRef.onDestroy(() => {
      if (this.interactionTimer) clearTimeout(this.interactionTimer);
      this.preview?.dispose();
    });
  }

  interactionStarted(): void {
    if (this.interactionTimer) clearTimeout(this.interactionTimer);
    this.interacting.set(true);
  }

  interactionEnded(): void {
    if (this.interactionTimer) clearTimeout(this.interactionTimer);
    this.interactionTimer = setTimeout(() => this.interacting.set(false), 900);
  }

  wheelInteraction(): void {
    this.interactionStarted();
    this.interactionEnded();
  }
}
