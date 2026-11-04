import { describe, it, expect } from 'vitest';
import { exportErrorText } from '../../src/lib/export/errors';
import { VideoError } from '../../src/lib/video/demux';
import { errorText } from '../../src/lib/state/project.svelte';

describe('exportErrorText', () => {
  it('VideoError nutzt den Projekt-Fehlertext', () => {
    const e = new VideoError('decode-failed');
    expect(exportErrorText(e)).toBe(errorText(e));
  });
  it('NotAllowedError meldet nicht erlaubtes Teilen', () => {
    expect(exportErrorText(new DOMException('x', 'NotAllowedError'))).toBe('Teilen wurde nicht erlaubt. Bitte erneut versuchen.');
  });
  it('sonst allgemeiner Text', () => {
    expect(exportErrorText(new Error('x'))).toBe('Export fehlgeschlagen.');
  });
});
