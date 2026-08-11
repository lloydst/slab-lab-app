import { describe, expect, it } from 'vitest';
import type { SlabTemplate } from '@slablab/geometry-engine';
import { svgDocumentDimensions, templateToSvg } from './template-to-svg';

describe('templateToSvg', () => {
  it('escapes labels and warnings and renders open fold paths', () => {
    const template: SlabTemplate = {
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 10, y: 5 }],
        closed: false,
        kind: 'fold',
        label: `<A&B "test">'`,
      }],
      dimensions: { width: 10, height: 5 },
      unit: 'mm',
      notes: [],
      warnings: ['Use <care> & patience'],
    };

    const svg = templateToSvg(template);
    expect(svgDocumentDimensions(template)).toEqual({ width: 74, height: 99 });
    expect(svg).toContain('class="fold"');
    expect(svg).not.toContain(' L 22 17 Z');
    expect(svg).toContain('&lt;A&amp;B &quot;test&quot;&gt;&apos;');
    expect(svg).toContain('Use &lt;care&gt; &amp; patience');
  });
});
