import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Manage request state and ignore completions from stale requests.
 * Request behavior itself remains in media-core.
 * @template TArgs
 * @template TResult
 * @param {(args: TArgs) => Promise<TResult>} request
 * @param {boolean} enabled
 * @param {TArgs} args
 * @returns {{ data: TResult | null, error: unknown, loading: boolean, execute: (requestArgs: TArgs) => Promise<TResult | undefined>, reset: () => void }}
 */
export function useAsyncRequest(request, enabled, args) {
  const [state, setState] = useState({ data: null, error: null, loading: false });
  const requestId = useRef(0);

  const execute = useCallback(async (requestArgs) => {
    const currentRequestId = ++requestId.current;
    setState((current) => ({ ...current, loading: true, error: null, data: null }));
    try {
      const data = await request(requestArgs);
      if (requestId.current === currentRequestId) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (requestId.current === currentRequestId) setState({ data: null, error, loading: false });
      return undefined;
    }
  }, [request]);

  const cancel = useCallback(() => {
    requestId.current += 1;
  }, []);

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
