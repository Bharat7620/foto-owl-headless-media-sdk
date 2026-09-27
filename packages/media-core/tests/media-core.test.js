import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaClient, MediaEventEmitter, MediaSdkError } from '@foto-owl/media-core';

const PHOTO = {
  id: 42,
  width: 1200,
  height: 800,
  photographer: 'Example Photographer',
  src: { medium: 'https://images.example/photo.jpg' },
};

function jsonResponse(body, { status = 200, ok = true } = {}) {
  return { ok, status, json: async () => body };
}

function makeClient(fetchImpl, options = {}) {
  return createMediaClient({ apiKey: 'test-secret', fetchImpl, logger: null, ...options });
}

test('client configuration accepts a key and sends it in the authorization header', async () => {
  let request;
  const client = makeClient(async (url, init) => {
    request = { url, init };
    return jsonResponse({ photos: [PHOTO], page: 1, per_page: 15, total_results: 1 });
  });

  const page = await client.search('  forest  ');

  assert.equal(request.init.headers.Authorization, 'test-secret');
  assert.equal(new URL(request.url).searchParams.get('query'), 'forest');
  assert.equal(page.items[0].kind, 'image');
});

test('missing API key raises a safe SDK error', () => {
  assert.throws(() => createMediaClient({ apiKey: '  ', fetchImpl: async () => {} }), (error) => {
    assert.ok(error instanceof MediaSdkError);
    assert.equal(error.code, 'MISSING_API_KEY');
    return true;
  });
});

test('search preserves Pexels photo fields and adds normalized media fields', async () => {
  const client = makeClient(async () => jsonResponse({
    photos: [PHOTO], page: 2, per_page: 1, total_results: 3,
    next_page: 'https://api.pexels.com/v1/search?page=3', prev_page: 'https://api.pexels.com/v1/search?page=1',
  }));

  const result = await client.search('forest', { page: 2, perPage: 1 });

  assert.deepEqual(result.items[0], { ...PHOTO, kind: 'image', mediaType: 'photo' });
  assert.equal(result.page, 2);
  assert.equal(result.perPage, 1);
  assert.equal(result.totalResults, 3);
  assert.equal(result.hasNextPage, true);
  assert.ok(result.previousPageUrl);
});

test('search supports video results and curated videos use the popular endpoint', async () => {
  const video = { id: 73, duration: 12, video_files: [{ link: 'https://videos.example/clip.mp4' }] };
  const requests = [];
  const client = makeClient(async (url) => {
    requests.push(url);
    return jsonResponse({ videos: [video], page: 1, per_page: 15 });
  });

  const search = await client.search('ocean', { type: 'videos' });
  const curated = await client.getCurated({ type: 'videos' });

  assert.equal(search.items[0].kind, 'video');
  assert.equal(search.items[0].mediaType, 'video');
  assert.deepEqual(search.items[0].video_files, video.video_files);
  assert.match(requests[0], /\/videos\/search\?/);
  assert.match(requests[1], /\/videos\/popular\?/);
});

test('getCurated and getById normalize photos and videos', async () => {
  const client = makeClient(async (url) => {
    if (url.endsWith('/photos/42')) return jsonResponse(PHOTO);
    if (url.endsWith('/videos/videos/73')) return jsonResponse({ id: 73, video_files: [] });
    return jsonResponse({ photos: [PHOTO], page: 1, per_page: 15 });
  });

  const curated = await client.getCurated({ page: 3, perPage: 7 });
  const photo = await client.getById(42);
  const video = await client.getById(73, { type: 'videos' });

  assert.equal(curated.items[0].mediaType, 'photo');
  assert.equal(photo.id, 42);
  assert.equal(photo.kind, 'image');
  assert.equal(video.mediaType, 'video');
});

test('HTTP errors expose status without exposing the API key', async () => {
  const client = makeClient(async () => jsonResponse({}, { ok: false, status: 401 }));

  await assert.rejects(client.search('forest'), (error) => {
    assert.equal(error.code, 'HTTP_ERROR');
    assert.equal(error.status, 401);
    assert.doesNotMatch(error.message, /test-secret/);
    return true;
  });
});

test('network failures become safe SDK errors', async () => {
  const client = makeClient(async () => { throw new Error('request failed with test-secret'); });

  await assert.rejects(client.search('forest'), (error) => {
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.doesNotMatch(error.message, /test-secret/);
    return true;
  });
});

test('invalid API response shape is rejected', async () => {
  const client = makeClient(async () => jsonResponse({ unexpected: [] }));
  await assert.rejects(client.search('forest'), { name: 'MediaSdkError', code: 'INVALID_RESPONSE' });
});

test('successful GET responses are cached until cache is cleared', async () => {
  let calls = 0;
  const client = makeClient(async () => {
    calls += 1;
    return jsonResponse({ photos: [PHOTO], page: 1, per_page: 15 });
  });

  await client.search('forest');
  await client.search('forest');
  assert.equal(calls, 1);
  client.clearCache();
  await client.search('forest');
  assert.equal(calls, 2);
});

test('expired cache entries are fetched again', async () => {
  let calls = 0;
  const client = makeClient(async () => {
    calls += 1;
    return jsonResponse({ photos: [PHOTO], page: 1, per_page: 15 });
  }, { cacheTtlMs: 1 });

  await client.search('forest');
  await new Promise((resolve) => setTimeout(resolve, 5));
  await client.search('forest');
  assert.equal(calls, 2);
});

test('identical concurrent requests share the same promise and network request', async () => {
  let calls = 0;
  let resolveResponse;
  const responsePromise = new Promise((resolve) => { resolveResponse = resolve; });
  const client = makeClient(async () => {
    calls += 1;
    return responsePromise;
  });

  const first = client.search('forest', { page: 1, perPage: 4 });
  const second = client.search('forest', { perPage: 4, page: 1 });
  assert.strictEqual(first, second);
  assert.equal(calls, 1);
  resolveResponse(jsonResponse({ photos: [PHOTO], page: 1, per_page: 4 }));
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test('event subscribers receive view and download payloads', () => {
  const emitter = new MediaEventEmitter({ logger: null });
  const received = [];
  emitter.on('view', (payload) => received.push(['view', payload]));
  emitter.on('download', (payload) => received.push(['download', payload]));
  const viewPayload = { mediaId: 42, mediaType: 'photo' };
  const downloadPayload = { mediaId: 73, mediaType: 'video', url: 'https://example.test/video.mp4' };

  emitter.emit('view', viewPayload);
  emitter.emit('download', downloadPayload);

  assert.deepEqual(received, [['view', viewPayload], ['download', downloadPayload]]);
});

test('event unsubscribe and off stop future notifications', () => {
  const emitter = new MediaEventEmitter({ logger: null });
  let calls = 0;
  const listener = () => { calls += 1; };
  const unsubscribe = emitter.on('view', listener);
  emitter.emit('view', { mediaId: 42, mediaType: 'photo' });
  unsubscribe();
  emitter.emit('view', { mediaId: 42, mediaType: 'photo' });
  emitter.on('view', listener);
  emitter.off('view', listener);
  emitter.emit('view', { mediaId: 42, mediaType: 'photo' });
  assert.equal(calls, 1);
});

test('event emitter installs default console listeners', () => {
  const logged = [];
  const emitter = new MediaEventEmitter({ logger: { info: (...args) => logged.push(args) } });
  emitter.emit('view', { mediaId: 42, mediaType: 'photo' });
  emitter.emit('download', { mediaId: 73, mediaType: 'video' });
  assert.equal(logged.length, 2);
  assert.equal(logged[0][0], '[media-core] view');
  assert.equal(logged[1][0], '[media-core] download');
});
