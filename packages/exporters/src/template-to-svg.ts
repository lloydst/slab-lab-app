import type { SlabTemplate } from '@slablab/geometry-engine';

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!,
  );

export const templateToSvg = (template: SlabTemplate): string => {
  const margin = 12,
    width = template.dimensions.width + margin * 2,
    height = template.dimensions.height + margin * 2 + 20;
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" role="img" aria-label="Printable slab template"><style>.cut{fill:none;stroke:#111;stroke-width:.35}.fold{fill:none;stroke:#555;stroke-width:.25;stroke-dasharray:3 2}.label{font:4px sans-serif;text-anchor:middle;fill:#111}.dim{font:3.5px sans-serif;fill:#333}</style>${paths}<text x="${margin}" y="${height - 6}" class="dim">${template.dimensions.width.toFixed(1)} × ${template.dimensions.height.toFixed(1)} mm · Print at 100%</text></svg>`;
};
