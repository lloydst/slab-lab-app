import type { SlabTemplate } from '@slablab/geometry-engine';

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!,
  );

export const svgDocumentDimensions = (template: SlabTemplate) => ({
  width: Math.max(template.dimensions.width, 50) + 24,
  height: template.dimensions.height + 94,
});

export const templateToSvg = (template: SlabTemplate): string => {
  const margin = 12,
    { width, height } = svgDocumentDimensions(template);
  const paths = template.paths
    .map((path) => {
      const data =
        path.points
          .map((point, index) => `${index ? 'L' : 'M'} ${point.x + margin} ${point.y + margin}`)
          .join(' ') + (path.closed ? ' Z' : '');
      const center = path.points.reduce(
        (current, point) => ({
          x: current.x + point.x / path.points.length,
          y: current.y + point.y / path.points.length,
        }),
        { x: 0, y: 0 },
      );
      return `<path d="${data}" class="${path.kind}"/><text x="${center.x + margin}" y="${center.y + margin}" class="label">${path.assemblyNumber ?? ''} ${escapeXml(path.label ?? '')}</text>`;
    })
    .join('');
  const warning = (template.warnings ?? [])
    .map(
      (message, index) =>
        `<text x="${margin}" y="${template.dimensions.height + margin + 10 + index * 5}" class="warning">${escapeXml(message)}</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" role="img" aria-label="Printable slab template"><style>.cut{fill:none;stroke:#b64f2f;stroke-width:.42}.fold{fill:none;stroke:#246d8b;stroke-width:.35;stroke-dasharray:3 2}.label{font:4px sans-serif;text-anchor:middle;fill:#28633f}.dim,.warning{font:3.5px sans-serif;fill:#28633f}.warning{fill:#a13f78}</style>${paths}${warning}<rect x="${margin}" y="${height - 62}" width="50" height="50" class="cut"/><text x="${margin + 25}" y="${height - 36}" class="label">50 mm calibration</text><text x="${margin}" y="${height - 6}" class="dim">${template.dimensions.width.toFixed(1)} × ${template.dimensions.height.toFixed(1)} mm · Print at 100% · Color-safe lines</text></svg>`;
};
