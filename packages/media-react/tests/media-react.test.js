import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });

const { act, cleanup, renderHook, waitFor } = await import('@testing-library/react');
const {
  MediaProvider,
  useMediaClient,
  useMediaSearch,
  useMediaCurated,
  useMediaItem,
  useMediaViewEvent,
  useMediaDownloadEvent,
} = await import('../src/index.js');
const { createElement } = await import('react');

afterEach(() => cleanup());
after(() => dom.window.close());

function createEvents() {
  const listeners = new Map();
  return {
    listeners,
    on(event, listener) {
      const current = listeners.get(event) ?? new Set();
      current.add(listener);
      listeners.set(event, current);
      return () => {
        current.delete(listener);
        if (current.size === 0) listeners.delete(event);
      };
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    emit(event, payload) {
      for (const listener of [...(listeners.get(event) ?? [])]) listener(payload);
    },
  };
}

function createClient(overrides = {}) {
  return {
    search: async () => ({ items: [], page: 1, perPage: 15, totalResults: 0, hasNextPage: false }),
    getCurated: async () => ({ items: [], page: 1, perPage: 15, totalResults: 0, hasNextPage: false }),
    getById: async (id) => ({ id, kind: 'image', mediaType: 'photo' }),
    events: createEvents(),
    ...overrides,
  };
}

function createWrapper(client) {
  return function Wrapper({ children }) {
    return createElement(MediaProvider, { client }, children);
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('MediaProvider provides its client and useMediaClient reads it', () => {
  const client = createClient();
  const { result } = renderHook(() => useMediaClient(), { wrapper: createWrapper(client) });
  assert.strictEqual(result.current, client);
});

test('useMediaClient outside MediaProvider throws a useful error', () => {
  assert.throws(() => renderHook(() => useMediaClient()), /useMediaClient must be used inside a <MediaProvider/);
});

test('useMediaSearch reports loading then results and pagination', async () => {
  const pending = deferred();
  let received;
  const client = createClient({ search: (query, options) => {
    received = { query, options };
    return pending.promise;
  } });
  const { result } = renderHook(() => useMediaSearch({ query: 'shore', page: 2, perPage: 4, type: 'videos' }), {
    wrapper: createWrapper(client),
  });

  assert.equal(result.current.loading, true);
  assert.deepEqual(received, { query: 'shore', options: { type: 'videos', page: 2, perPage: 4 } });
  await act(async () => pending.resolve({
    items: [{ id: 8, kind: 'video' }], page: 2, perPage: 4, totalResults: 9,
    hasNextPage: true, nextPageUrl: '/next', previousPageUrl: '/previous',
  }));

  assert.equal(result.current.loading, false);
  assert.equal(result.current.error, null);
  assert.equal(result.current.results[0].id, 8);
  assert.equal(result.current.pagination.page, 2);
  assert.equal(result.current.pagination.hasNextPage, true);
  assert.equal(typeof result.current.refetch, 'function');
  assert.equal(typeof result.current.search, 'function');
});

test('useMediaSearch exposes request errors and does not fetch an empty query', async () => {
  let calls = 0;
  const client = createClient({ search: async () => {
    calls += 1;
    throw new Error('search failed');
  } });
  const { result, rerender } = renderHook(({ query }) => useMediaSearch({ query }), {
    initialProps: { query: '' },
    wrapper: createWrapper(client),
  });

  assert.equal(calls, 0);
  rerender({ query: 'forest' });
  await waitFor(() => assert.equal(result.current.error?.message, 'search failed'));
  assert.equal(result.current.loading, false);
  assert.deepEqual(result.current.results, []);
});

test('useMediaSearch ignores an older response after the query changes', async () => {
  const first = deferred();
  const second = deferred();
  const client = createClient({ search: (query) => query === 'first' ? first.promise : second.promise });
  const { result, rerender } = renderHook(({ query }) => useMediaSearch({ query }), {
    initialProps: { query: 'first' },
    wrapper: createWrapper(client),
  });

  rerender({ query: 'second' });
  await act(async () => second.resolve({ items: [{ id: 'new' }], page: 1, perPage: 15 }));
  await act(async () => first.resolve({ items: [{ id: 'stale' }], page: 1, perPage: 15 }));

  assert.equal(result.current.results[0].id, 'new');
});

test('useMediaCurated loads results and supports refetch', async () => {
  let calls = 0;
  const client = createClient({ getCurated: async (options) => {
    calls += 1;
    return { items: [{ id: options.page }], page: options.page, perPage: options.perPage, totalResults: 6, hasNextPage: true };
  } });
  const { result } = renderHook(() => useMediaCurated({ page: 2, perPage: 3, type: 'videos' }), {
    wrapper: createWrapper(client),
  });

  await waitFor(() => assert.equal(result.current.results[0]?.id, 2));
  assert.equal(result.current.pagination.hasNextPage, true);
  await act(async () => result.current.refetch({ page: 3 }));
  assert.equal(result.current.results[0].id, 3);
  assert.equal(calls, 2);
});

test('useMediaItem loads one item and provides refetch', async () => {
  const client = createClient({ getById: async (id, options) => ({ id, kind: options.type === 'videos' ? 'video' : 'image' }) });
  const { result } = renderHook(() => useMediaItem(22, { type: 'videos' }), { wrapper: createWrapper(client) });

  await waitFor(() => assert.equal(result.current.data?.id, 22));
  assert.equal(result.current.data.kind, 'video');
  assert.equal(result.current.error, null);
  await act(async () => result.current.refetch(23));
  assert.equal(result.current.data.id, 23);
});

test('view event hook subscribes, receives events, and unsubscribes on unmount', () => {
  const client = createClient();
  const received = [];
  const { unmount } = renderHook(() => useMediaViewEvent((payload) => received.push(payload)), {
    wrapper: createWrapper(client),
  });
  const payload = { mediaId: 42, mediaType: 'photo' };

  client.events.emit('view', payload);
  assert.deepEqual(received, [payload]);
  assert.equal(client.events.listeners.get('view').size, 1);
  unmount();
  assert.equal(client.events.listeners.has('view'), false);
  client.events.emit('view', payload);
  assert.equal(received.length, 1);
});

test('download event hook receives download events and cleans up', () => {
  const client = createClient();
  const received = [];
  const { unmount } = renderHook(() => useMediaDownloadEvent((payload) => received.push(payload)), {
    wrapper: createWrapper(client),
  });
  const payload = { mediaId: 9, mediaType: 'video', url: '/clip.mp4' };

  client.events.emit('download', payload);
  assert.deepEqual(received, [payload]);
  unmount();
  assert.equal(client.events.listeners.has('download'), false);
});
