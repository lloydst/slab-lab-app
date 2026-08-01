import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { SlabTemplate } from '@slablab/geometry-engine';
import { templateToSvg } from '@slablab/exporters';

@Component({
  selector: 'slab-template-preview',
  standalone: true,
  templateUrl: './template-preview.component.html',
  styleUrl: './template-preview.component.scss',
})
export class TemplatePreviewComponent {
  readonly template = input.required<SlabTemplate>();
  private readonly sanitizer = inject(DomSanitizer);
  readonly svg = computed(() => this.sanitizer.bypassSecurityTrustHtml(templateToSvg(this.template())));
}
