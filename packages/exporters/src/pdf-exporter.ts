import type { SlabTemplate, TemplatePath } from '@slablab/geometry-engine';
import type { TemplateExporter } from './template-exporter';

const POINTS_PER_MM = 72 / 25.4;
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 12;
const FOOTER_TOP_MM = 82;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PAGE_MARGIN_MM - FOOTER_TOP_MM;
const CUT_COLOR = '0.714 0.31 0.184 RG';
const FOLD_COLOR = '0.141 0.427 0.545 RG';
const TEXT_COLOR = '0.157 0.388 0.247 rg';
const WARNING_COLOR = '0.631 0.247 0.471 rg';

const formatNumber = (value: number) => Number(value.toFixed(3)).toString();
const toPoints = (millimetres: number) => formatNumber(millimetres * POINTS_PER_MM);
const asciiBytes = (value: string) => Uint8Array.from(value, (character) => character.charCodeAt(0));
const pdfString = (value: string) =>
  `<${Array.from(value, (character) => (character.charCodeAt(0) <= 255 ? character.charCodeAt(0) : 63))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}>`;

const textCommands = (text: string, xMm: number, yMm: number, fontSizeMm: number) =>
  [
    'BT',
    `/F1 ${toPoints(fontSizeMm)} Tf`,
    `${toPoints(xMm)} ${toPoints(yMm)} Td`,
    `${pdfString(text)} Tj`,
    'ET',
  ].join('\n');

const pathCommands = (path: TemplatePath, offsetX: number, offsetY: number) => {
  if (!path.points.length) return '';
  const commands = path.points.map((point, index) => {
    const x = point.x - offsetX + PAGE_MARGIN_MM;
    const y = PAGE_HEIGHT_MM - (point.y - offsetY) - PAGE_MARGIN_MM;
    return `${toPoints(x)} ${toPoints(y)} ${index ? 'l' : 'm'}`;
  });
  if (path.closed) commands.push('h');
  commands.push('S');
  return commands.join('\n');
};

const pathCenter = (path: TemplatePath) =>
  path.points.reduce(
    (center, point) => ({
      x: center.x + point.x / path.points.length,
      y: center.y + point.y / path.points.length,
    }),
    { x: 0, y: 0 },
  );

const pageContent = (
  template: SlabTemplate,
  offsetX: number,
  offsetY: number,
  pageNumber: number,
  pageCount: number,
) => {
  const commands = [
    'q',
    CUT_COLOR,
    TEXT_COLOR,
    '1 J',
    '1 j',
    `${toPoints(PAGE_MARGIN_MM)} ${toPoints(FOOTER_TOP_MM)} ${toPoints(CONTENT_WIDTH_MM)} ${toPoints(CONTENT_HEIGHT_MM)} re W n`,
  ];
  for (const path of template.paths) {
    commands.push(
      path.kind === 'fold'
        ? `${FOLD_COLOR}\n${toPoints(0.35)} w\n[${toPoints(3)} ${toPoints(2)}] 0 d`
        : `${CUT_COLOR}\n${toPoints(0.42)} w\n[] 0 d`,
    );
    commands.push(pathCommands(path, offsetX, offsetY));
    const center = pathCenter(path);
    const label = `${path.assemblyNumber ?? ''} ${path.label ?? ''}`.trim();
    if (
      label &&
      center.x >= offsetX &&
      center.x < offsetX + CONTENT_WIDTH_MM &&
      center.y >= offsetY &&
      center.y < offsetY + CONTENT_HEIGHT_MM
    )
      commands.push(
        TEXT_COLOR,
        textCommands(
          label,
          center.x - offsetX + PAGE_MARGIN_MM,
          PAGE_HEIGHT_MM - (center.y - offsetY) - PAGE_MARGIN_MM,
          4,
        ),
      );
  }
  commands.push(
    'Q',
    CUT_COLOR,
    `${toPoints(0.42)} w\n[] 0 d`,
    `${toPoints(PAGE_MARGIN_MM)} ${toPoints(12)} ${toPoints(50)} ${toPoints(50)} re S`,
  );
  commands.push(TEXT_COLOR, textCommands('50 mm calibration', PAGE_MARGIN_MM + 8, 36, 4));
  commands.push(
    textCommands(`Page ${pageNumber} of ${pageCount} - A4 - Print at 100% / Actual size`, 72, 50, 3.5),
  );
  commands.push(
    textCommands(
      `${template.dimensions.width.toFixed(1)} x ${template.dimensions.height.toFixed(1)} mm template`,
      72,
      42,
      3.5,
    ),
  );
  for (const [index, warning] of (template.warnings ?? []).slice(0, 3).entries())
    commands.push(WARNING_COLOR, textCommands(`WARNING: ${warning}`, 72, 34 - index * 5, 3));
  return commands.join('\n');
};

const buildPdf = (contents: string[]) => {
  const pageCount = contents.length;
  const firstPageObject = 3;
  const firstContentObject = firstPageObject + pageCount;
  const fontObject = firstContentObject + pageCount;
  const kids = Array.from({ length: pageCount }, (_, index) => `${firstPageObject + index} 0 R`).join(' ');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
    ...contents.map(
      (_, index) =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${toPoints(PAGE_WIDTH_MM)} ${toPoints(PAGE_HEIGHT_MM)}] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${firstContentObject + index} 0 R >>`,
    ),
    ...contents.map(
      (content) => `<< /Length ${asciiBytes(content).length} >>\nstream\n${content}\nendstream`,
    ),
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
  chunks.push(
    asciiBytes(
      [
        'xref',
        `0 ${objects.length + 1}`,
        '0000000000 65535 f ',
        ...offsets.slice(1).map((offset) => `${offset.toString().padStart(10, '0')} 00000 n `),
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
        `startxref\n${xrefOffset}`,
        '%%EOF',
        '',
      ].join('\n'),
    ),
  );
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
    const columns = Math.max(1, Math.ceil(template.dimensions.width / CONTENT_WIDTH_MM));
    const rows = Math.max(1, Math.ceil(template.dimensions.height / CONTENT_HEIGHT_MM));
    const pageCount = columns * rows;
    const contents = Array.from({ length: pageCount }, (_, index) => {
      const column = index % columns,
        row = Math.floor(index / columns);
      return pageContent(template, column * CONTENT_WIDTH_MM, row * CONTENT_HEIGHT_MM, index + 1, pageCount);
    });
    return buildPdf(contents);
  }
}
