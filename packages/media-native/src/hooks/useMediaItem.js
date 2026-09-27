import { useCallback, useMemo } from 'react';
import { useMediaClient } from './useMediaClient.js';
import { useAsyncRequest } from './useAsyncRequest.js';

/** Fetch one item by ID through media-core. */
export function useMediaItem(id, options = {}) {
  const client = useMediaClient();
  const optionsKey = JSON.stringify(options);
  const stableOptions = useMemo(() => JSON.parse(optionsKey), [optionsKey]);
  const args = useMemo(() => ({ id, options: stableOptions }), [id, stableOptions]);
  const request = useCallback(({ id: itemId, options: itemOptions }) => client.getById(itemId, itemOptions), [client]);
  const enabled = id !== undefined && id !== null && id !== '';
  const state = useAsyncRequest(request, enabled, args);
  const refetch = useCallback((nextId = id, nextOptions = stableOptions) => {
    if (nextId === undefined || nextId === null || nextId === '') {
      state.reset();
      return Promise.resolve(undefined);
    }
    return state.execute({ id: nextId, options: nextOptions });
  }, [id, stableOptions, state.execute, state.reset]);
  return { loading: state.loading, error: state.error, data: state.data, refetch };
}
