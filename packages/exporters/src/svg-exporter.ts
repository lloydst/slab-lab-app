import type { SlabTemplate } from '@slablab/geometry-engine';
import type { TemplateExporter } from './template-exporter';
import { templateToSvg } from './template-to-svg';

export class SvgExporter implements TemplateExporter {
  readonly mimeType = 'image/svg+xml';

  async export(template: SlabTemplate) {
    return new Blob([templateToSvg(template)], { type: `${this.mimeType};charset=utf-8` });
  }
}
