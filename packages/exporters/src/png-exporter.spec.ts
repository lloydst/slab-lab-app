// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SlabTemplate } from '@slablab/geometry-engine';
import { PngExporter } from './png-exporter';

const template: SlabTemplate = {
  paths: [],
  dimensions: { width: 50, height: 25 },
  unit: 'mm',
  notes: [],
};

class LoadingImage {
  static shouldFail = false;
  onload?: () => void;
  onerror?: () => void;
  set src(_value: string) {
    queueMicrotask(() => LoadingImage.shouldFail ? this.onerror?.() : this.onload?.());
  }
}

describe('PNG exporter', () => {
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    LoadingImage.shouldFail = false;
    vi.stubGlobal('Image', LoadingImage);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:svg'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rasterizes the true-size SVG at 300 DPI', async () => {
    const png = new Blob(['png'], { type: 'image/png' });
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback) => callback(png)),
    };
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? canvas : originalCreateElement(tag)) as typeof document.createElement);

    await expect(new PngExporter().export(template)).resolves.toBe(png);
    expect(canvas.width).toBe(Math.ceil(74 * (300 / 25.4)));
    expect(canvas.height).toBe(Math.ceil(119 * (300 / 25.4)));
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
    expect(context.drawImage).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:svg');
  });

  it('reports unavailable canvas rendering and still releases the SVG URL', async () => {
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => null) };
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? canvas : originalCreateElement(tag)) as typeof document.createElement);

    await expect(new PngExporter().export(template)).rejects.toThrow('Canvas unavailable');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:svg');
  });

  it('rejects failed canvas encoding', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() })),
      toBlob: vi.fn((callback: BlobCallback) => callback(null)),
    };
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? canvas : originalCreateElement(tag)) as typeof document.createElement);

    await expect(new PngExporter().export(template)).rejects.toThrow('PNG export failed');
  });

  it('rejects SVG image load failures', async () => {
    LoadingImage.shouldFail = true;
    await expect(new PngExporter().export(template)).rejects.toThrow('Could not render SVG');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:svg');
  });
});
