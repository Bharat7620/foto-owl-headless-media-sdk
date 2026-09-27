import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Manage hook request state and ignore outdated completions.
 * @template TArgs
 * @template TResult
 * @param {(args: TArgs) => Promise<TResult>} request
 * @param {boolean} enabled
 * @param {TArgs} args
 * @returns {{ data: TResult | null, error: unknown, loading: boolean, execute: (args: TArgs) => Promise<TResult | undefined>, reset: () => void }}
 */
export function useAsyncRequest(request, enabled, args) {
  const [state, setState] = useState({ data: null, error: null, loading: false });
  const requestId = useRef(0);
  const execute = useCallback(async (requestArgs) => {
    const currentId = ++requestId.current;
    setState({ data: null, error: null, loading: true });
    try {
      const data = await request(requestArgs);
      if (currentId === requestId.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (currentId === requestId.current) setState({ data: null, error, loading: false });
      return undefined;
    }
  }, [request]);
  const cancel = useCallback(() => { requestId.current += 1; }, []);
  const reset = useCallback(() => {
    requestId.current += 1;
    setState({ data: null, error: null, loading: false });
  }, []);

  useEffect(() => {
    if (!enabled) {
      reset();
      return undefined;
    }
    void execute(args);
    return cancel;
  }, [enabled, args, execute, cancel, reset]);

  return { ...state, execute, reset };
}
