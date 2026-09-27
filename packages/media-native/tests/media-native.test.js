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
  MediaNativeProvider,
  useMediaClient,
  useMediaSearch,
  useMediaCurated,
  useMediaItem,
  useMediaViewEvent,
} = await import('../src/index.js');
const { createElement } = await import('react');

afterEach(() => cleanup());
after(() => dom.window.close());

function createEvents() {
  const listeners = new Map();
  return {
    listeners,
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(event);
      };
    },
    off(event, listener) { listeners.get(event)?.delete(listener); },
    emit(event, payload) { for (const listener of [...(listeners.get(event) ?? [])]) listener(payload); },
  };
}

function createClient(overrides = {}) {
  return {
    search: async () => ({ items: [], page: 1, perPage: 15, totalResults: 0, hasNextPage: false }),
    getCurated: async () => ({ items: [], page: 1, perPage: 15, totalResults: 0, hasNextPage: false }),
    getById: async (id) => ({ id }),
    events: createEvents(),
    ...overrides,
  };
}

function createWrapper(client) {
  return function Wrapper({ children }) {
    return createElement(MediaNativeProvider, { client }, children);
  };
}

test('MediaNativeProvider supplies the configured core client', () => {
  const client = createClient();
  const { result } = renderHook(() => useMediaClient(), { wrapper: createWrapper(client) });
  assert.strictEqual(result.current, client);
});

test('useMediaClient gives a useful error outside the provider', () => {
  assert.throws(() => renderHook(() => useMediaClient()), /useMediaClient must be used inside a <MediaNativeProvider/);
});

test('native search hook delegates parameters and exposes results and pagination', async () => {
  const received = [];
  const client = createClient({ search: async (...args) => {
    received.push(args);
    return { items: [{ id: 9 }], page: 2, perPage: 5, totalResults: 12, hasNextPage: true };
  } });
  const { result } = renderHook(() => useMediaSearch({ query: 'hills', page: 2, perPage: 5, type: 'videos' }), {
    wrapper: createWrapper(client),
  });

  await waitFor(() => assert.equal(result.current.results[0]?.id, 9));
  assert.deepEqual(received, [['hills', { type: 'videos', page: 2, perPage: 5 }]]);
  assert.equal(result.current.pagination.hasNextPage, true);
  assert.equal(result.current.loading, false);
});

test('curated and item hooks delegate directly to media-core', async () => {
  const calls = [];
  const client = createClient({
    getCurated: async (options) => {
      calls.push(['curated', options]);
      return { items: [{ id: 3 }], page: options.page, perPage: options.perPage, hasNextPage: false };
    },
    getById: async (id, options) => {
      calls.push(['item', id, options]);
      return { id, kind: 'video' };
    },
  });
  const wrapper = createWrapper(client);
  const curated = renderHook(() => useMediaCurated({ page: 3, perPage: 6 }), { wrapper });
  const item = renderHook(() => useMediaItem(44, { type: 'videos' }), { wrapper });

  await waitFor(() => assert.equal(curated.result.current.results[0]?.id, 3));
  await waitFor(() => assert.equal(item.result.current.data?.id, 44));
  assert.deepEqual(calls, [
    ['curated', { page: 3, perPage: 6 }],
    ['item', 44, { type: 'videos' }],
  ]);
  curated.unmount();
  item.unmount();
});

test('event hook subscribes to the core emitter and unsubscribes on unmount', () => {
  const client = createClient();
  const received = [];
  const { unmount } = renderHook(() => useMediaViewEvent((payload) => received.push(payload)), {
    wrapper: createWrapper(client),
  });
  const payload = { mediaId: 55, mediaType: 'photo' };
  client.events.emit('view', payload);
  assert.deepEqual(received, [payload]);
  assert.equal(client.events.listeners.get('view').size, 1);
  unmount();
  assert.equal(client.events.listeners.has('view'), false);
});
