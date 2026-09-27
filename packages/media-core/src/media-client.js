import { MediaEventEmitter } from './event-emitter.js';
import { MediaSdkError } from './sdk-error.js';

const DEFAULT_BASE_URL = 'https://api.pexels.com/v1';
const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 80;
const MEDIA_TYPES = new Set(['photos', 'videos']);

/**
 * @typedef {'photos' | 'videos'} MediaCollectionType
 * @typedef {'image' | 'video'} MediaKind
 * @typedef {Record<string, unknown> & { id: number | string, kind: MediaKind, mediaType: 'photo' | 'video' }} MediaItem
 * @typedef {{ page?: number, perPage?: number, type?: MediaCollectionType, [key: string]: unknown }} MediaRequestOptions
 * @typedef {{ items: MediaItem[], page: number, perPage: number, totalResults: number | null, hasNextPage: boolean, nextPageUrl: string | null, previousPageUrl: string | null }} MediaPage
 * @typedef {{ apiKey: string, fetchImpl?: typeof fetch, baseUrl?: string, cacheTtlMs?: number, logger?: Pick<Console, 'info'> | null }} MediaClientOptions
 */

/**
 * Pexels API client with normalized media records, a small GET cache,
 * in-flight request deduplication, and a framework-agnostic event emitter.
 */
export class MediaClient {
  #apiKey;
  #fetch;
  #baseUrl;
  #cacheTtlMs;
  #cache = new Map();
  #inFlight = new Map();
  #inFlightResults = new Map();

  /** @param {MediaClientOptions} options */
  constructor({ apiKey, fetchImpl = globalThis.fetch?.bind(globalThis), baseUrl = DEFAULT_BASE_URL, cacheTtlMs = DEFAULT_CACHE_TTL_MS, logger = console } = {}) {
    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new MediaSdkError('A Pexels API key is required to create a MediaClient.', { code: 'MISSING_API_KEY' });
    }
    if (typeof fetchImpl !== 'function') {
      throw new MediaSdkError('A Fetch-compatible request function is required.', { code: 'MISSING_FETCH' });
    }
    if (typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      throw new MediaSdkError('The API base URL must be a non-empty string.', { code: 'INVALID_CONFIGURATION' });
    }
    if (!Number.isFinite(cacheTtlMs) || cacheTtlMs < 0) {
      throw new MediaSdkError('cacheTtlMs must be a non-negative number.', { code: 'INVALID_CONFIGURATION' });
    }

    this.#apiKey = apiKey.trim();
    this.#fetch = fetchImpl;
    this.#baseUrl = baseUrl.replace(/\/$/, '');
    this.#cacheTtlMs = cacheTtlMs;
    this.events = new MediaEventEmitter({ logger });
  }

  /** Search Pexels photos or videos; `options.type` defaults to `photos`. @param {string} query @param {MediaRequestOptions} [options] @returns {Promise<MediaPage>} */
  search(query, options = {}) {
    if (typeof query !== 'string' || query.trim() === '') {
      return Promise.reject(new MediaSdkError('Search query must be a non-empty string.', { code: 'INVALID_ARGUMENT' }));
    }
    const type = options.type ?? 'photos';
    this.#assertType(type);
    const { page, perPage } = this.#pagination(options);
    const params = this.#queryParams(options, page, perPage);
    params.set('query', query.trim());
    params.sort();
    const isVideo = type === 'videos';
    return this.#getPage(isVideo ? '/videos/search' : '/search', params, isVideo ? 'videos' : 'photos', type, page, perPage);
  }

  /** Get curated photos or popular videos. @param {MediaRequestOptions} [options] @returns {Promise<MediaPage>} */
  getCurated(options = {}) {
    const type = options.type ?? 'photos';
    this.#assertType(type);
    const { page, perPage } = this.#pagination(options);
    const params = this.#queryParams(options, page, perPage);
    const isVideo = type === 'videos';
    return this.#getPage(isVideo ? '/videos/popular' : '/curated', params, isVideo ? 'videos' : 'photos', type, page, perPage);
  }

  /** @param {string | number} id @param {{ type?: MediaCollectionType }} [options] @returns {Promise<MediaItem>} */
  getById(id, { type = 'photos' } = {}) {
    this.#assertType(type);
    if ((typeof id !== 'string' && typeof id !== 'number') || String(id).trim() === '') {
      return Promise.reject(new MediaSdkError('Media ID must be a non-empty string or number.', { code: 'INVALID_ARGUMENT' }));
    }
    const isVideo = type === 'videos';
    const path = isVideo ? `/videos/videos/${encodeURIComponent(String(id))}` : `/photos/${encodeURIComponent(String(id))}`;
    return this.#getResult(path, new URLSearchParams(), (data) => {
      if (!this.#isObject(data) || data.id === undefined || data.id === null) {
        throw new MediaSdkError('Pexels returned an invalid media item response.', { code: 'INVALID_RESPONSE' });
      }
      return this.#normalizeItem(data, type);
    });
  }

  /** Clear all successful GET responses held in this client's in-memory cache. */
  clearCache() {
    this.#cache.clear();
  }

  #getPage(path, params, resultKey, type, page, perPage) {
    return this.#getResult(path, params, (data) => {
      if (!this.#isObject(data) || !Array.isArray(data[resultKey])) {
        throw new MediaSdkError('Pexels returned an invalid paginated media response.', { code: 'INVALID_RESPONSE' });
      }
      const items = data[resultKey].map((item) => {
        if (!this.#isObject(item) || item.id === undefined || item.id === null) {
          throw new MediaSdkError('Pexels returned an invalid media item in the response.', { code: 'INVALID_RESPONSE' });
        }
        return this.#normalizeItem(item, type);
      });
      return {
        items,
        page: Number.isInteger(data.page) ? data.page : page,
        perPage: Number.isInteger(data.per_page) ? data.per_page : perPage,
        totalResults: Number.isFinite(data.total_results) ? data.total_results : null,
        hasNextPage: typeof data.next_page === 'string' && data.next_page.length > 0,
        nextPageUrl: typeof data.next_page === 'string' ? data.next_page : null,
        previousPageUrl: typeof data.prev_page === 'string' ? data.prev_page : null,
      };
    });
  }

  #getResult(path, params, normalize) {
    const key = `${path}?${params.toString()}`;
    const inFlight = this.#inFlightResults.get(key);
    if (inFlight) return inFlight;
    const request = this.#getJson(path, params).then(normalize).finally(() => this.#inFlightResults.delete(key));
    this.#inFlightResults.set(key, request);
    return request;
  }

  #normalizeItem(item, type) {
    return { ...item, kind: type === 'videos' ? 'video' : 'image', mediaType: type === 'videos' ? 'video' : 'photo' };
  }

  #getJson(path, params) {
    const query = params.toString();
    const requestKey = `${path}?${query}`;
    const cached = this.#cache.get(requestKey);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
    if (cached) this.#cache.delete(requestKey);
    const activeRequest = this.#inFlight.get(requestKey);
    if (activeRequest) return activeRequest;

    const url = `${this.#baseUrl}${path}${query ? `?${query}` : ''}`;
    const request = this.#performGet(url).then((value) => {
      if (this.#cacheTtlMs > 0) this.#cache.set(requestKey, { value, expiresAt: Date.now() + this.#cacheTtlMs });
      return value;
    }).finally(() => this.#inFlight.delete(requestKey));
    this.#inFlight.set(requestKey, request);
    return request;
  }

  async #performGet(url) {
    let response;
    try {
      response = await this.#fetch(url, { method: 'GET', headers: { Authorization: this.#apiKey, Accept: 'application/json' } });
    } catch {
      throw new MediaSdkError('Unable to reach the Pexels API. Check the network connection and try again.', { code: 'NETWORK_ERROR' });
    }
    if (!response || typeof response.ok !== 'boolean') {
      throw new MediaSdkError('The request returned an invalid HTTP response.', { code: 'INVALID_RESPONSE' });
    }
    if (!response.ok) {
      throw new MediaSdkError(`Pexels API request failed with HTTP ${response.status}.`, { code: 'HTTP_ERROR', status: response.status });
    }
    try {
      return await response.json();
    } catch {
      throw new MediaSdkError('Pexels returned a response that was not valid JSON.', { code: 'INVALID_RESPONSE' });
    }
  }

  #pagination(options) {
    const page = options.page ?? 1;
    const perPage = options.perPage ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(page) || page < 1) throw new MediaSdkError('page must be a positive integer.', { code: 'INVALID_ARGUMENT' });
    if (!Number.isInteger(perPage) || perPage < 1 || perPage > MAX_PAGE_SIZE) {
      throw new MediaSdkError(`perPage must be an integer from 1 to ${MAX_PAGE_SIZE}.`, { code: 'INVALID_ARGUMENT' });
    }
    return { page, perPage };
  }

  #queryParams(options, page, perPage) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) {
      if (key === 'page' || key === 'perPage' || key === 'type' || value === undefined || value === null) continue;
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new MediaSdkError(`Option "${key}" must be a string, number, or boolean.`, { code: 'INVALID_ARGUMENT' });
      }
      params.set(key, String(value));
    }
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    params.sort();
    return params;
  }

  #assertType(type) {
    if (!MEDIA_TYPES.has(type)) throw new MediaSdkError('type must be either "photos" or "videos".', { code: 'INVALID_ARGUMENT' });
  }

  #isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}

/** Create a configured Pexels media client. @param {MediaClientOptions} options */
export function createMediaClient(options) {
  return new MediaClient(options);
}
