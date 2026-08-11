import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { SlabTemplate } from '@slablab/geometry-engine';
import { templateToSvg } from '@slablab/exporters';

interface PinchStart {
  distance: number;
  zoom: number;
}

@Component({
  selector: 'slab-template-preview',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './template-preview.component.html',
  styleUrl: './template-preview.component.scss',
})
export class TemplatePreviewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('paper', { static: true }) private paper!: ElementRef<HTMLElement>;
  readonly template = input.required<SlabTemplate>();
  readonly zoom = signal(100);
  readonly isPanning = signal(false);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchStart: PinchStart | null = null;
  private readonly pointerMoveListener = (event: PointerEvent): void => this.onPointerMove(event);
  readonly svg = computed(() => this.sanitizer.bypassSecurityTrustHtml(templateToSvg(this.template())));

  ngAfterViewInit(): void {
    const paper = this.paper.nativeElement;
    this.ngZone.runOutsideAngular(() => paper.addEventListener('pointermove', this.pointerMoveListener));
    this.destroyRef.onDestroy(() => paper.removeEventListener('pointermove', this.pointerMoveListener));
  }

  ngOnDestroy(): void {
    this.pointers.clear();
  }

  zoomBy(amount: number): void {
    this.zoom.update((zoom) => Math.min(300, Math.max(50, zoom + amount)));
  }

  resetZoom(): void {
    this.zoom.set(100);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? 10 : -10);
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.isPanning.set(true);
    if (this.pointers.size === 2) this.startPinch();
  }

  onPointerMove(event: PointerEvent): void {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
      this.onPointerEnd(event);
      return;
    }

    event.preventDefault();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 1) {
      const paper = event.currentTarget as HTMLElement;
      paper.scrollLeft -= event.clientX - previous.x;
      paper.scrollTop -= event.clientY - previous.y;
      return;
    }

    if (this.pointers.size === 2) {
      const distance = this.pinchDistance();
      const start = this.pinchStart;
      if (!start || !distance) return;

      const nextZoom = Math.round(Math.min(300, Math.max(50, start.zoom * distance / start.distance)));
      this.zoom.set(nextZoom);
    }
  }

  onPointerEnd(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    this.isPanning.set(this.pointers.size > 0);
    this.pinchStart = null;
  }

  private pinchDistance(): number | null {
    const [first, second] = [...this.pointers.values()];
    return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : null;
  }

  private startPinch(): void {
    const distance = this.pinchDistance();
    if (!distance) return;

    this.pinchStart = {
      distance,
      zoom: this.zoom(),
    };
  }
}
