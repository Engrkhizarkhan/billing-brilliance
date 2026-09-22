import { act, renderHook, waitFor } from '@testing-library/react';
import { useApiQuery } from './useApiQuery';
import { describe, expect, it } from 'vitest';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
describe('useApiQuery', () => {
  it('keeps the newest search result when earlier requests finish later', async () => {
    const old = deferred<{ data: string }>(), current = deferred<{ data: string }>();
    const { result, rerender } = renderHook(({ query }) => useApiQuery(() => query === 'old' ? old.promise : current.promise, [query]), { initialProps: { query: 'old' } });
    rerender({ query: 'current' });
    await act(async () => current.resolve({ data: 'current result' }));
    await act(async () => old.resolve({ data: 'stale result' }));
    expect(result.current.data).toBe('current result');
    expect(result.current.loading).toBe(false);
  });
  it('ignores stale failures and exposes current failures for the error view', async () => {
    const old = deferred<{ data: string }>(), current = deferred<{ data: string }>();
    const { result, rerender } = renderHook(({ query }) => useApiQuery(() => query === 'old' ? old.promise : current.promise, [query]), { initialProps: { query: 'old' } });
    rerender({ query: 'current' });
    await act(async () => old.reject(new Error('Stale error')));
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(true);
    await act(async () => current.reject(new Error('Network unavailable')));
    await waitFor(() => expect(result.current.error).toBe('Network unavailable'));
  });
});
