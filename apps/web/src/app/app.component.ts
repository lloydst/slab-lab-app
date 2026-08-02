import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ShapeFactory, compensate, frustumPresets } from '@slablab/geometry-engine';
import { downloadBlob, PdfExporter, PngExporter, SvgExporter } from '@slablab/exporters';
import { MeasurementUnit, ShapeKind } from '@slablab/shared';
import { PreviewComponent } from './preview.component';
import { TemplatePreviewComponent } from './template-preview.component';
import { ProjectStore } from './project.store';
@Component({
  selector: 'slab-root',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    MatTabsModule,
    MatTooltipModule,
    PreviewComponent,
    TemplatePreviewComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly store: ProjectStore;
  readonly factory = new ShapeFactory();
  readonly tab = signal<'form' | 'template'>('form');
  readonly panel = signal<'shape' | 'projects' | 'guide'>('shape');
  readonly mobilePanelOpen = signal(false);
  readonly shapes: { kind: ShapeKind; label: string; glyph: string }[] = [
    { kind: 'cylinder', label: 'Cylinder', glyph: '◯' },
    { kind: 'cube', label: 'Cube', glyph: '□' },
    { kind: 'box', label: 'Box', glyph: '▭' },
    { kind: 'truncated-cone', label: 'Frustum', glyph: '▽' },
    { kind: 'vase', label: 'Vase', glyph: '♢' },
    { kind: 'bowl', label: 'Bowl', glyph: '⌣' },
    { kind: 'oval-box', label: 'Oval box', glyph: '⬭' },
  ];
  readonly unitFactors: Record<MeasurementUnit, number> = { mm: 1, cm: 10, in: 25.4 };
  readonly shape = computed(() => {
    const p = this.store.active();
    if (!p) return null;
    const factor = this.unitFactors[p.unit];
    const adjusted = Object.fromEntries(
      Object.entries(p.parameters).map(([key, value]) => [
        key,
        key === 'hasLid' || key === 'lidStyle' || key === 'roundness'
          ? value
          : key === 'lidLift'
            ? value * factor
            : compensate(value * factor, p.shrinkage),
      ]),
    );
    return this.factory.create(p.shape, adjusted);
  });
  readonly issues = computed(() => this.shape()?.validate() ?? []);
  readonly hasClosedTop = computed(() => {
    const kind = this.store.active()?.shape;
    return kind === 'cylinder' || kind === 'cube' || kind === 'truncated-cone';
  });
  readonly thicknessLabel = computed(() => {
    const project = this.store.active();
    if (!project) return '';
    return `${project.parameters['wallThickness']} ${project.unit}`;
  });
  readonly fields = computed(() => {
    const parameters = this.store.active()?.parameters ?? {};
    return Object.keys(parameters).filter(
      (field) =>
        field !== 'hasLid' &&
        field !== 'lidStyle' &&
        ((field !== 'lidClearance' && field !== 'lidLift') || parameters['hasLid'] >= 0.5) &&
        (field !== 'lidSkirtHeight' || (parameters['hasLid'] >= 0.5 && parameters['lidStyle'] === 2)),
    );
  });
  constructor(store: ProjectStore) {
    this.store = store;
  }
  label(field: string) {
    if (field === 'truncated-cone') return 'Frustum';
    if (field === 'lidLift') return 'Lid Preview Gap';
    if (field === 'lidSkirtHeight') return 'Lid Skirt Height';
    return field
      .replace(/-/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }
  setParameter(field: string, value: number) {
    const p = this.store.active();
    if (p) this.store.update({ parameters: { ...p.parameters, [field]: Number(value) } });
  }
  setFrustumPreset(preset: 'tapered' | 'frustum') {
    this.store.update({ parameters: { ...frustumPresets[preset] } });
  }
  lidMode(parameters: Record<string, number>) {
    if (parameters['hasLid'] < 0.5) return 0;
    return Math.round(parameters['lidStyle']) + 1;
  }
  setLidMode(mode: number) {
    const project = this.store.active();
    if (!project) return;
    this.store.update({
      parameters: {
        ...project.parameters,
        hasLid: mode === 0 ? 0 : 1,
        lidStyle: Math.max(0, mode - 1),
      },
    });
  }
  openPanel(panel: 'shape' | 'projects' | 'guide') {
    this.panel.set(panel);
    this.mobilePanelOpen.set(true);
  }
  error(field: string) {
    return this.issues().find((issue) => issue.field === field)?.message;
  }
  async export(format: 'svg' | 'pdf' | 'png') {
    const shape = this.shape();
    const p = this.store.active();
    if (!shape || !p || this.issues().length) return;
    const exporter =
      format === 'svg' ? new SvgExporter() : format === 'pdf' ? new PdfExporter() : new PngExporter();
    downloadBlob(
      await exporter.export(shape.generateTemplate()),
      `${p.name.replace(/\s+/g, '-').toLowerCase()}.${format}`,
    );
  }
}
