import { useState, useEffect, useCallback, useRef } from 'react';

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useApiQuery<T>(
  fetcher: () => Promise<{ data: T }>,
  deps: unknown[] = []
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (mountedRef.current) {
        setData(res.data);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'An error occurred');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}

export function useApiMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<{ data: TOutput; message?: string }>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (input: TInput) => {
      setLoading(true);
      setError(null);
      try {
        const result = await mutationFn(input);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'An error occurred';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn]
  );

  return { mutate, loading, error };
}
