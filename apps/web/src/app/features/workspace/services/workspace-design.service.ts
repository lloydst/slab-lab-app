import { computed, inject, Injectable } from '@angular/core';
import { downloadBlob, PdfExporter, PngExporter, SvgExporter } from '@slablab/exporters';
import { compensate, frustumPresets, ShapeFactory } from '@slablab/geometry-engine';
import { MeasurementUnit, ShapeKind } from '@slablab/shared';
import { ProjectStore } from '../../../data-access/projects/project.store';

export type ExportFormat = 'svg' | 'pdf' | 'png';

@Injectable()
export class WorkspaceDesignService {
  readonly store = inject(ProjectStore);
  private readonly factory = new ShapeFactory();

  readonly shapes: { kind: ShapeKind; label: string; glyph: string }[] = [
    { kind: 'cylinder', label: 'Cylinder', glyph: '◯' },
    { kind: 'cube', label: 'Cube', glyph: '□' },
    { kind: 'box', label: 'Box', glyph: '▭' },
    { kind: 'truncated-cone', label: 'Frustum', glyph: '▽' },
    { kind: 'vase', label: 'Vase', glyph: '♢' },
    { kind: 'bowl', label: 'Bowl', glyph: '⌣' },
    { kind: 'oval-box', label: 'Oval box', glyph: '⬭' },
    { kind: 'hexagonal-prism', label: 'Hexagonal prism', glyph: '⬡' },
    { kind: 'octagonal-prism', label: 'Octagonal prism', glyph: '⯃' },
    { kind: 'tapered-box', label: 'Tapered box', glyph: '▱' },
    { kind: 'truncated-square-pyramid', label: 'Square pyramid', glyph: '◫' },
    { kind: 'polygonal-vase', label: 'Polygonal vase', glyph: '⬢' },
    { kind: 'rounded-rectangle-box', label: 'Rounded box', glyph: '▢' },
    { kind: 'elliptical-vase', label: 'Elliptical vase', glyph: '⬭' },
    { kind: 'faceted-bowl', label: 'Faceted bowl', glyph: '◡' },
    { kind: 'gored-sphere', label: 'Gored sphere', glyph: '◉' },
    { kind: 'teardrop-vessel', label: 'Teardrop', glyph: '◒' },
    { kind: 'organic-lofted-vessel', label: 'Organic loft', glyph: '≈' },
  ];
  readonly shape = computed(() => {
    const project = this.store.active();
    if (!project) return null;
    const factor: Record<MeasurementUnit, number> = { mm: 1, cm: 10, in: 25.4 };
    const parameters = Object.fromEntries(
      Object.entries(project.parameters).map(([key, value]) => [
        key,
        key === 'hasLid' ||
        key === 'lidStyle' ||
        key === 'roundness' ||
        key === 'sides' ||
        key === 'points' ||
        key === 'facets' ||
        key === 'gores' ||
        key === 'includeBase' ||
        key === 'closedTop'
          ? value
          : key === 'lidLift'
            ? value * factor[project.unit]
            : compensate(value * factor[project.unit], project.shrinkage),
      ]),
    );
    return this.factory.create(project.shape, parameters);
  });
  readonly issues = computed(() => this.shape()?.validate() ?? []);
  readonly hasClosedTop = computed(() => {
    const kind = this.store.active()?.shape;
    return kind === 'cylinder' || kind === 'cube' || kind === 'truncated-cone';
  });
  readonly thicknessLabel = computed(() => {
    const project = this.store.active();
    return project ? `${project.parameters['wallThickness']} ${project.unit}` : '';
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

  label(field: string): string {
    if (field === 'truncated-cone') return 'Frustum';
    if (field === 'lidLift') return 'Lid Preview Gap';
    if (field === 'lidSkirtHeight') return 'Lid Skirt Height';
    return field
      .replace(/-/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  setParameter(field: string, value: number): void {
    const project = this.store.active();
    if (project) {
      this.store.update({ parameters: { ...project.parameters, [field]: Number(value) } });
    }
  }

  setFrustumPreset(preset: 'tapered' | 'frustum'): void {
    this.store.update({ parameters: { ...frustumPresets[preset] } });
  }

  lidMode(parameters: Record<string, number>): number {
    return parameters['hasLid'] < 0.5 ? 0 : Math.round(parameters['lidStyle']) + 1;
  }

  setLidMode(mode: number): void {
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

  error(field: string): string | undefined {
    return this.issues().find((issue) => issue.field === field)?.message;
  }

  async export(format: ExportFormat): Promise<void> {
    const shape = this.shape();
    const project = this.store.active();
    if (!shape || !project || this.issues().length) return;
    const exporter =
      format === 'svg' ? new SvgExporter() : format === 'pdf' ? new PdfExporter() : new PngExporter();
    downloadBlob(
      await exporter.export(shape.generateTemplate()),
      `${project.name.replace(/\s+/g, '-').toLowerCase()}.${format}`,
    );
  }
}
