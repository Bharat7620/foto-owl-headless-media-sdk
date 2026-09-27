import { useCallback, useMemo } from 'react';
import { useMediaClient } from './useMediaClient.js';
import { useAsyncRequest } from './useAsyncRequest.js';

/** Search through media-core and expose React Native-friendly request state. */
export function useMediaSearch({ query = '', page = 1, perPage = 15, ...filters } = {}) {
  const client = useMediaClient();
  const filtersKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => JSON.parse(filtersKey), [filtersKey]);
  const args = useMemo(() => ({ query, page, perPage, filters: stableFilters }), [query, page, perPage, stableFilters]);
  const request = useCallback(({ query: nextQuery, page: nextPage, perPage: nextPerPage, filters: nextFilters }) => (
    client.search(nextQuery, { ...nextFilters, page: nextPage, perPage: nextPerPage })
  ), [client]);
  const enabled = typeof query === 'string' && query.trim().length > 0;
  const state = useAsyncRequest(request, enabled, args);
  const search = useCallback((nextQuery = query, overrides = {}) => {
    if (typeof nextQuery !== 'string' || nextQuery.trim().length === 0) {
      state.reset();
      return Promise.resolve(undefined);
    }
    const { page: nextPage = args.page, perPage: nextPerPage = args.perPage, ...nextFilters } = overrides;
    return state.execute({ query: nextQuery, page: nextPage, perPage: nextPerPage, filters: { ...args.filters, ...nextFilters } });
  }, [args, query, state.execute, state.reset]);
  const pagination = state.data ? {
    page: state.data.page,
    perPage: state.data.perPage,
    totalResults: state.data.totalResults,
    hasNextPage: state.data.hasNextPage,
    nextPageUrl: state.data.nextPageUrl,
    previousPageUrl: state.data.previousPageUrl,
  } : { page, perPage, totalResults: null, hasNextPage: false, nextPageUrl: null, previousPageUrl: null };

  return { query, loading: state.loading, error: state.error, results: state.data?.items ?? [], pagination, search, refetch: search };
}
