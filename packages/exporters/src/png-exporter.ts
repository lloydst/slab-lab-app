import type { SlabTemplate } from '@slablab/geometry-engine';
import type { TemplateExporter } from './template-exporter';
import { templateToSvg } from './template-to-svg';

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not render SVG'));
    image.src = url;
  });

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
