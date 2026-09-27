import { useCallback, useMemo } from 'react';
import { useMediaClient } from './useMediaClient.js';
import { useAsyncRequest } from './useAsyncRequest.js';

/** Load curated media using the provided media-core client. */
export function useMediaCurated({ page = 1, perPage = 15, ...filters } = {}) {
  const client = useMediaClient();
  const filtersKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => JSON.parse(filtersKey), [filtersKey]);
  const args = useMemo(() => ({ page, perPage, filters: stableFilters }), [page, perPage, stableFilters]);
  const request = useCallback(({ page: nextPage, perPage: nextPerPage, filters: nextFilters }) => (
    client.getCurated({ ...nextFilters, page: nextPage, perPage: nextPerPage })
  ), [client]);
  const state = useAsyncRequest(request, true, args);
  const refetch = useCallback((overrides = {}) => {
    const { page: nextPage = args.page, perPage: nextPerPage = args.perPage, ...nextFilters } = overrides;
    return state.execute({ page: nextPage, perPage: nextPerPage, filters: { ...args.filters, ...nextFilters } });
  }, [args, state.execute]);
  const pagination = state.data ? {
    page: state.data.page,
    perPage: state.data.perPage,
    totalResults: state.data.totalResults,
    hasNextPage: state.data.hasNextPage,
    nextPageUrl: state.data.nextPageUrl,
    previousPageUrl: state.data.previousPageUrl,
  } : { page, perPage, totalResults: null, hasNextPage: false, nextPageUrl: null, previousPageUrl: null };

  return { loading: state.loading, error: state.error, results: state.data?.items ?? [], pagination, refetch };
}
