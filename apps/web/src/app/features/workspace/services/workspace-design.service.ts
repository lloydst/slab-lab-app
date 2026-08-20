import { computed, inject, Injectable } from '@angular/core';
import { downloadBlob, PdfExporter, PngExporter, SvgExporter } from '@slablab/exporters';
import { compensate, millimetresToUnit, ShapeFactory } from '@slablab/geometry-engine';
import { MeasurementUnit, ShapeKind } from '@slablab/shared';
import {
  isDimensionalParameter,
  parameterFromMillimetres,
  parameterToMillimetres,
} from '../../../data-access/projects/project-units';
import { ProjectStore } from '../../../data-access/projects/project.store';
import { printableMeshToStl } from '../../preview/printable-mesh-export';

export type ExportFormat = 'svg' | 'pdf' | 'pdf-borderless' | 'png' | 'stl';
type ShapeOption = { kind: ShapeKind; label: string };

@Injectable()
export class WorkspaceDesignService {
  readonly store = inject(ProjectStore);
  private readonly factory = new ShapeFactory();
  readonly shapes: ShapeOption[] = [
    { kind: 'cup', label: 'Cup' },
    { kind: 'handled-jar', label: 'Handled jar' },
    { kind: 'cylinder', label: 'Cylinder' },
    { kind: 'cube', label: 'Cube' },
    { kind: 'box', label: 'Box' },
    { kind: 'truncated-cone', label: 'Frustum' },
    { kind: 'vase', label: 'Vase' },
    { kind: 'bowl', label: 'Bowl' },
    { kind: 'oval-box', label: 'Oval box' },
    { kind: 'hexagonal-prism', label: 'Hexagonal prism' },
    { kind: 'octagonal-prism', label: 'Octagonal prism' },
    { kind: 'tapered-box', label: 'Tapered box' },
    { kind: 'polygonal-vase', label: 'Polygonal vase' },
    { kind: 'elliptical-vase', label: 'Elliptical vase' },
    { kind: 'faceted-bowl', label: 'Faceted bowl' },
    { kind: 'gored-sphere', label: 'Gored sphere' },
    { kind: 'teardrop-vessel', label: 'Teardrop' },
    { kind: 'organic-lofted-vessel', label: 'Organic loft' },
  ];
  readonly shape = computed(() => {
    const project = this.store.active();
    if (!project) return null;
    const parameters = Object.fromEntries(
      Object.entries(project.parameters).map(([key, value]) => [
        key,
        !isDimensionalParameter(key)
          ? value
          : key === 'lidLift'
            ? value
            : compensate(value, project.shrinkage),
      ]),
    );
    return this.factory.create(project.shape, parameters);
  });
  readonly issues = computed(() => this.shape()?.validate() ?? []);
  readonly estimatedFiredSize = computed(() => {
    const project = this.store.active();
    if (!project) return null;
    const dimensions = this.factory.create(project.shape, project.parameters).calculateDimensions();
    const firingFactor = 1 - Math.min(100, Math.max(0, project.shrinkage)) / 100;
    return {
      width: millimetresToUnit(dimensions.width * firingFactor, project.unit),
      depth: millimetresToUnit(dimensions.depth * firingFactor, project.unit),
      height: millimetresToUnit(dimensions.height * firingFactor, project.unit),
      unit: project.unit,
    };
  });
  readonly hasClosedTop = computed(() => {
    const project = this.store.active();
    if (!project) return false;
    return (
      project.shape === 'cylinder' ||
      project.shape === 'cube' ||
      project.shape === 'truncated-cone' ||
      project.parameters['closedTop'] === 1
    );
  });
  readonly thicknessLabel = computed(() => {
    const project = this.store.active();
    return project ? `${this.displayParameter('wallThickness')} ${project.unit}` : '';
  });
  readonly fields = computed(() => {
    const project = this.store.active();
    const parameters = project?.parameters ?? {};
    const hiddenFields =
      project?.shape === 'cube'
        ? new Set(['depth', 'height'])
        : project?.shape === 'hexagonal-prism' || project?.shape === 'octagonal-prism'
          ? new Set(['topRadius'])
          : project?.shape === 'polygonal-vase'
            ? new Set(['bottomDepth', 'midDepth', 'topDepth'])
            : new Set<string>();
    return Object.keys(parameters).filter(
      (field) =>
        !hiddenFields.has(field) &&
        field !== 'hasLid' &&
        field !== 'lidStyle' &&
        ((field !== 'lidClearance' && field !== 'lidLift') || parameters['hasLid'] >= 0.5) &&
        (field !== 'lidSkirtHeight' || (parameters['hasLid'] >= 0.5 && parameters['lidStyle'] === 2)),
    );
  });

  label(field: string): string {
    const shape = this.store.active()?.shape;
    if (shape === 'cube' && field === 'width') return 'Side Length';
    if ((shape === 'hexagonal-prism' || shape === 'octagonal-prism') && field === 'bottomRadius')
      return 'Radius';
    if (shape === 'polygonal-vase' && field === 'bottomWidth') return 'Bottom Diameter';
    if (shape === 'polygonal-vase' && field === 'midWidth') return 'Body Diameter';
    if (shape === 'polygonal-vase' && field === 'topWidth') return 'Top Diameter';
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
      const millimetres = parameterToMillimetres(field, Number(value), project.unit);
      const coupledParameters: Record<string, number> =
        project.shape === 'cube' && field === 'width'
          ? { depth: millimetres, height: millimetres }
          : (project.shape === 'hexagonal-prism' || project.shape === 'octagonal-prism') &&
              field === 'bottomRadius'
            ? { topRadius: millimetres }
            : project.shape === 'polygonal-vase' && field === 'bottomWidth'
              ? { bottomDepth: millimetres }
              : project.shape === 'polygonal-vase' && field === 'midWidth'
                ? { midDepth: millimetres }
                : project.shape === 'polygonal-vase' && field === 'topWidth'
                  ? { topDepth: millimetres }
                  : {};
      this.store.update({
        parameters: {
          ...project.parameters,
          [field]: millimetres,
          ...coupledParameters,
        },
      });
    }
  }

  displayParameter(field: string): number {
    const project = this.store.active();
    if (!project) return 0;
    return parameterFromMillimetres(field, project.parameters[field], project.unit);
  }

  setUnit(unit: MeasurementUnit): void {
    this.store.update({ unit });
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
    const filename = project.name.replace(/\s+/g, '-').toLowerCase();
    if (format === 'stl') {
      const mesh = shape.generateMesh();
      downloadBlob(
        printableMeshToStl(mesh, shape.parameters['wallThickness'], this.hasClosedTop()),
        `${filename}.stl`,
      );
      return;
    }
    const exporter =
      format === 'svg'
        ? new SvgExporter()
        : format === 'pdf'
          ? new PdfExporter()
          : format === 'pdf-borderless'
            ? new PdfExporter({ borderless: true })
            : new PngExporter();
    const extension = format === 'pdf-borderless' ? 'pdf' : format;
    const suffix = format === 'pdf-borderless' ? '-borderless' : '';
    downloadBlob(await exporter.export(shape.generateTemplate()), `${filename}${suffix}.${extension}`);
  }
}
