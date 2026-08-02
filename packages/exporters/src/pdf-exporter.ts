import type { SlabTemplate } from '@slablab/geometry-engine';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import type { TemplateExporter } from './template-exporter';
import { templateToSvg } from './template-to-svg';

export class PdfExporter implements TemplateExporter {
  readonly mimeType = 'application/pdf';

  async export(template: SlabTemplate) {
    const svg = new DOMParser().parseFromString(templateToSvg(template), 'image/svg+xml').documentElement;
    const width = template.dimensions.width + 24,
      height = template.dimensions.height + 44;
    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [width, height],
    });
    await pdf.svg(svg, { x: 0, y: 0, width, height });
    return pdf.output('blob');
  }
}
