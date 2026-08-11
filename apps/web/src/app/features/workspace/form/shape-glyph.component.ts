import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ShapeKind } from '@slablab/shared';

@Component({
  selector: 'slab-shape-glyph',
  standalone: true,
  template: `
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      @switch (kind()) {
        @case ('cup') {
          <path d="M6 9h16v10a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7V9Zm16 3h2a4 4 0 0 1 0 8h-2" />
        }
        @case ('handled-jar') {
          <path d="M10 5h12l-2 5c5 8 3 17-4 17S7 18 12 10l-2-5Zm12 7c7-1 7 10 1 10" />
        }
        @case ('cylinder') {
          <ellipse cx="16" cy="7" rx="9" ry="4" />
          <path d="M7 7v18c0 2 4 4 9 4s9-2 9-4V7" />
        }
        @case ('cube') {
          <path d="m16 3 11 6v14l-11 6-11-6V9l11-6Zm0 13 11-7M16 16 5 9m11 7v13" />
        }
        @case ('box') {
          <path d="M4 10h24v16H4zM4 10l6-5h18v21" />
        }
        @case ('truncated-cone') {
          <ellipse cx="16" cy="7" rx="6" ry="3" />
          <ellipse cx="16" cy="25" rx="11" ry="4" />
          <path d="m10 7-5 18M22 7l5 18" />
        }
        @case ('vase') {
          <path d="M11 4h10c-4 7 1 8 2 14 1 7-2 10-7 10S8 25 9 18c1-6 6-7 2-14Z" />
        }
        @case ('bowl') {
          <path d="M4 10h24c-1 11-5 17-12 17S5 21 4 10Zm2 0c4 3 16 3 20 0" />
        }
        @case ('oval-box') {
          <ellipse cx="16" cy="9" rx="12" ry="5" />
          <path d="M4 9v14c0 3 5 5 12 5s12-2 12-5V9" />
        }
        @case ('hexagonal-prism') {
          <path d="m16 3 10 6v14l-10 6-10-6V9l10-6Zm0 0v26M6 9l10 6 10-6" />
        }
        @case ('octagonal-prism') {
          <path d="M11 3h10l7 7v12l-7 7H11l-7-7V10l7-7Zm0 0v26M4 10l12 5 12-5" />
        }
        @case ('tapered-box') {
          <path d="M9 5h14l5 22H4L9 5Zm0 0 7 5 7-5m-7 5v17" />
        }
        @case ('polygonal-vase') {
          <path d="M11 4h10l-2 7 5 7-3 10H11L8 18l5-7-2-7Zm2 7h6M8 18h16" />
        }
        @case ('elliptical-vase') {
          <ellipse cx="16" cy="5" rx="5" ry="2" />
          <path d="M11 5c4 7-5 9-3 17 2 8 14 8 16 0 2-8-7-10-3-17" />
        }
        @case ('faceted-bowl') {
          <path d="M4 9h24l-4 13-8 6-8-6L4 9Zm4 13h16M16 9v19" />
        }
        @case ('gored-sphere') {
          <circle cx="16" cy="16" r="12" />
          <ellipse cx="16" cy="16" rx="5" ry="12" />
          <path d="M4 16h24" />
        }
        @case ('teardrop-vessel') {
          <path d="M16 3S6 14 6 21a10 10 0 0 0 20 0C26 14 16 3 16 3Z" />
        }
        @case ('organic-lofted-vessel') {
          <path d="M12 3c9 2 4 8 8 12 5 5 5 13-4 14-9-1-9-9-4-14 4-4-4-8 0-12Z" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 28px;
      height: 28px;
    }
    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShapeGlyphComponent {
  readonly kind = input.required<ShapeKind>();
}
