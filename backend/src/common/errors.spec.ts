import { toErrorMessage } from './errors';

describe('toErrorMessage', () => {
  it('extracts Error.message', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('stringifies plain objects', () => {
    expect(toErrorMessage({ error: 'x' })).toBe('{"error":"x"}');
  });

  it('handles primitives', () => {
    expect(toErrorMessage('plain')).toBe('plain');
    expect(toErrorMessage(42)).toBe('42');
  });
});
