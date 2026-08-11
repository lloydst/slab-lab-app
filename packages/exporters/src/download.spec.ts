// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './download';

describe('downloadBlob', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clicks a temporary hidden link and revokes the URL after consumers have started', () => {
    vi.useFakeTimers();
    const blob = new Blob(['template']);
    const createUrl = vi.fn(() => 'blob:template');
    const revokeUrl = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadBlob(blob, 'vase.svg');

    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
    expect(revokeUrl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(revokeUrl).toHaveBeenCalledWith('blob:template');
  });
});
