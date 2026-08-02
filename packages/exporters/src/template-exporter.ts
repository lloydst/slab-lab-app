import type { SlabTemplate } from '@slablab/geometry-engine';

export interface TemplateExporter {
  readonly mimeType: string;
  export(template: SlabTemplate, name?: string): Promise<Blob>;
}
