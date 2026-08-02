import type { SlabTemplate, TemplatePath } from '@slablab/geometry-engine';
import type { TemplateExporter } from './template-exporter';

const POINTS_PER_MM = 72 / 25.4;
const PAGE_MARGIN_MM = 12;
const FOOTER_HEIGHT_MM = 70;

const formatNumber = (value: number) => Number(value.toFixed(3)).toString();
const toPoints = (millimetres: number) => formatNumber(millimetres * POINTS_PER_MM);

const winAnsiOverrides = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

const encodeWinAnsi = (value: string): number[] =>
  Array.from(value, (character) => {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x7f || (codePoint >= 0xa0 && codePoint <= 0xff)) return codePoint;
    return winAnsiOverrides.get(codePoint) ?? 0x3f;
  });

const pdfHexString = (value: string) =>
  `<${encodeWinAnsi(value)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}>`;

const estimateHelveticaWidth = (value: string, fontSizeMm: number) => {
  const units = Array.from(value).reduce((width, character) => {
    if (character === ' ') return width + 0.278;
    if (/[ilI.,'!:;|]/.test(character)) return width + 0.278;
    if (/[mwMW@%]/.test(character)) return width + 0.833;
    if (/[A-Z0-9]/.test(character)) return width + 0.62;
    return width + 0.5;
  }, 0);
  return units * fontSizeMm;
};

const pathCommands = (path: TemplatePath, pageHeightMm: number) => {
  if (!path.points.length) return '';

  const pointCommand = (index: number) => {
    const point = path.points[index]!;
    return `${toPoints(point.x + PAGE_MARGIN_MM)} ${toPoints(pageHeightMm - point.y - PAGE_MARGIN_MM)} ${index ? 'l' : 'm'}`;
  };

  const commands = path.points.map((_, index) => pointCommand(index));
  if (path.closed) commands.push('h');
  commands.push('S');
  return commands.join('\n');
};

const textCommands = (text: string, xMm: number, yMm: number, fontSizeMm: number) =>
  [
    'BT',
    `/F1 ${toPoints(fontSizeMm)} Tf`,
    `${toPoints(xMm)} ${toPoints(yMm)} Td`,
    `${pdfHexString(text)} Tj`,
    'ET',
  ].join('\n');

const templateContent = (template: SlabTemplate, pageHeightMm: number) => {
  const commands = ['q', '0 G', '0 g', '1 J', '1 j'];

  for (const path of template.paths) {
    commands.push(
      path.kind === 'fold'
        ? `${toPoints(0.25)} w\n[${toPoints(3)} ${toPoints(2)}] 0 d`
        : `${toPoints(0.35)} w\n[] 0 d`,
    );
    const drawing = pathCommands(path, pageHeightMm);
    if (drawing) commands.push(drawing);

    const label = `${path.assemblyNumber ?? ''} ${path.label ?? ''}`.trim();
    if (label && path.points.length) {
      const center = path.points.reduce(
        (current, point) => ({
          x: current.x + point.x / path.points.length,
          y: current.y + point.y / path.points.length,
        }),
        { x: 0, y: 0 },
      );
      const fontSizeMm = 4;
      const x = center.x + PAGE_MARGIN_MM - estimateHelveticaWidth(label, fontSizeMm) / 2;
      const y = pageHeightMm - center.y - PAGE_MARGIN_MM;
      commands.push(textCommands(label, x, y, fontSizeMm));
    }
  }

  const footer = `${template.dimensions.width.toFixed(1)} x ${template.dimensions.height.toFixed(1)} mm - Print at 100%`;
  commands.push(
    `${toPoints(0.35)} w\n[] 0 d`,
    `${toPoints(PAGE_MARGIN_MM)} ${toPoints(12)} ${toPoints(50)} ${toPoints(50)} re S`,
    textCommands('50 mm calibration', PAGE_MARGIN_MM + 8, 36, 4),
  );
  for (const [index, warning] of (template.warnings ?? []).entries())
    commands.push(textCommands(`WARNING: ${warning}`, PAGE_MARGIN_MM, 68 + index * 5, 3.2));
  commands.push(textCommands(footer, PAGE_MARGIN_MM, 6, 3.5), 'Q');
  return commands.join('\n');
};

const asciiBytes = (value: string) => Uint8Array.from(value, (character) => character.charCodeAt(0));

const buildPdf = (pageWidthMm: number, pageHeightMm: number, content: string) => {
  const contentBytes = asciiBytes(content);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${toPoints(pageWidthMm)} ${toPoints(pageHeightMm)}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];

  const chunks: Uint8Array[] = [asciiBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets = [0];
  let length = chunks[0]!.length;

  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = asciiBytes(`${index + 1} 0 obj\n${object}\nendobj\n`);
    chunks.push(chunk);
    length += chunk.length;
  });

  const xrefOffset = length;
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => `${offset.toString().padStart(10, '0')} 00000 n `),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref\n${xrefOffset}`,
    '%%EOF',
    '',
  ].join('\n');
  chunks.push(asciiBytes(xref));

  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }

  return new Blob([output.buffer], { type: 'application/pdf' });
};

export class PdfExporter implements TemplateExporter {
  readonly mimeType = 'application/pdf';

  async export(template: SlabTemplate) {
    const width = Math.max(template.dimensions.width, 50) + PAGE_MARGIN_MM * 2;
    const height = template.dimensions.height + PAGE_MARGIN_MM * 2 + FOOTER_HEIGHT_MM;
    return buildPdf(width, height, templateContent(template, height));
  }
}
