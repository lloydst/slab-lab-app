import type { SlabTemplate } from '@slablab/geometry-engine';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';

export interface TemplateExporter {
  readonly mimeType: string;
  export(template: SlabTemplate, name: string): Promise<Blob>;
}
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );

export const templateToSvg = (template: SlabTemplate): string => {
  const margin = 12,
    width = template.dimensions.width + margin * 2,
    height = template.dimensions.height + margin * 2 + 20;
  const paths = template.paths
    .map((path) => {
      const d =
        path.points
          .map((point, index) => `${index ? 'L' : 'M'} ${point.x + margin} ${point.y + margin}`)
          .join(' ') + (path.closed ? ' Z' : '');
      const center = path.points.reduce(
        (a, p) => ({ x: a.x + p.x / path.points.length, y: a.y + p.y / path.points.length }),
        { x: 0, y: 0 },
      );
      return `<path d="${d}" class="${path.kind}"/><text x="${center.x + margin}" y="${center.y + margin}" class="label">${path.assemblyNumber ?? ''} ${esc(path.label ?? '')}</text>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" role="img" aria-label="Printable slab template"><style>.cut{fill:none;stroke:#111;stroke-width:.35}.fold{fill:none;stroke:#555;stroke-width:.25;stroke-dasharray:3 2}.label{font:4px sans-serif;text-anchor:middle;fill:#111}.dim{font:3.5px sans-serif;fill:#333}</style>${paths}<text x="${margin}" y="${height - 6}" class="dim">${template.dimensions.width.toFixed(1)} × ${template.dimensions.height.toFixed(1)} mm · Print at 100%</text></svg>`;
};

export class SvgExporter implements TemplateExporter {
  readonly mimeType = 'image/svg+xml';
  async export(template: SlabTemplate) {
    return new Blob([templateToSvg(template)], { type: this.mimeType });
  }
}
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
export class PngExporter implements TemplateExporter {
  readonly mimeType = 'image/png';
  async export(template: SlabTemplate) {
    const svg = templateToSvg(template),
      url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const image = await loadImage(url);
      const canvas = document.createElement('canvas');
      const scale = 300 / 25.4;
      canvas.width = Math.ceil((template.dimensions.width + 24) * scale);
      canvas.height = Math.ceil((template.dimensions.height + 44) * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png'),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not render SVG'));
    image.src = url;
  });
export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
