# `@foto-owl/media-core`

Framework-agnostic JavaScript package for requesting and normalizing Pexels photos and videos. It owns the API client, response handling, a small in-memory GET cache, request deduplication, and media event subscriptions. It contains no React, React Native, DOM, or UI dependencies.

The app or a framework adapter supplies the API key and passes SDK data into presentation components. Search supports both photo and video endpoints; curated photos use Pexels' curated endpoint and curated videos use its popular videos endpoint.

## Installation and initialization

Inside this npm workspace, import the public APIs from the package root:

```js
import { createMediaClient, MediaSdkError } from '@foto-owl/media-core';

const client = createMediaClient({
  apiKey: appConfig.pexelsApiKey,
  cacheTtlMs: 30_000, // optional; defaults to 30 seconds
});
```

`apiKey` is required configuration. Load it from the environment or the host application's secret/configuration mechanism; do not commit a real key or place it in source code. The client sends it in the Pexels `Authorization` header and does not include it in request URLs, cache keys, or SDK-generated error messages.

For isolated tests or custom runtimes, pass a Fetch-compatible function with `fetchImpl`. The client defaults to `globalThis.fetch` (Node.js 18+ or a runtime that provides Fetch).

## Search

Search photos (the default):

```js
const results = await client.search('mountain lake');
console.log(results.items); // normalized photo records
```

Search videos by selecting the Pexels video endpoint:

```js
const videos = await client.search('mountain lake', { type: 'videos' });
console.log(videos.items[0].video_files);
```

Each item retains the useful fields returned by Pexels and adds `kind` (`image` or `video`) plus `mediaType` (`photo` or `video`). A page contains `items`, `page`, `perPage`, `totalResults`, `hasNextPage`, `nextPageUrl`, and `previousPageUrl`.

## Curated and popular media

```js
const photos = await client.getCurated({ perPage: 12 });
const popularVideos = await client.getCurated({ type: 'videos', perPage: 8 });
```

Pexels provides curated photos and a popular videos endpoint; `getCurated({ type: 'videos' })` uses the latter.

## Get one item

Photos are the default. Set `type: 'videos'` to retrieve a video:

```js
const photo = await client.getById(2014422);
const video = await client.getById(2499611, { type: 'videos' });
```

## Pagination

`page` is one-based, and `perPage` accepts integers from 1 to 80. The default values are page 1 and 15 items. Pass the next page number when the returned `hasNextPage` value is true:

```js
const firstPage = await client.search('wildlife', { page: 1, perPage: 20 });
if (firstPage.hasNextPage) {
  const nextPage = await client.search('wildlife', { page: firstPage.page + 1, perPage: firstPage.perPage });
}
```

Pexels pagination options and supported endpoint filters (for example `orientation`) are sent as query parameters. `perPage` is translated to Pexels' `per_page` parameter.

## Cache and request deduplication

Successful GET responses are cached in memory for 30 seconds by default. Configure `cacheTtlMs` when constructing the client, or use `0` to disable caching. `client.clearCache()` removes cached responses. Expired entries are fetched again; errors are not cached.

Concurrent calls with the same endpoint and query parameters reuse the same in-flight promise, so only one network request is made. Different parameters or endpoint paths produce separate requests. The cache is local to a `MediaClient` instance and is not persisted.

## Events

The client exposes a framework-agnostic emitter at `client.events`. It supports `view` and `download` events. A default console listener logs both event types; consumers can add and remove listeners independently.

```js
const onView = (payload) => console.log('Viewed media', payload.mediaId);
const unsubscribe = client.events.on('view', onView);

client.events.emit('view', { mediaId: 42, mediaType: 'photo', source: 'gallery' });
client.events.emit('download', {
  mediaId: 73,
  mediaType: 'video',
  url: 'https://videos.example/clip.mp4',
});

unsubscribe(); // or client.events.off('view', onView)
```

Payloads include `mediaId` and `mediaType`; optional `url`, `source`, and app-owned `metadata` can provide context. The SDK emits no view or download events automatically: the consuming app decides when those actions occur. These events are local notifications and do not send analytics to Pexels.

## Error handling

SDK failures use the exported `MediaSdkError`, with a stable `code` and optional HTTP `status`:

```js
try {
  const page = await client.search('forest');
  // consume page.items
} catch (error) {
  if (error instanceof MediaSdkError) {
    console.error(error.code, error.status, error.message);
  }
}
```

Common codes include `MISSING_API_KEY`, `INVALID_ARGUMENT`, `NETWORK_ERROR`, `HTTP_ERROR`, and `INVALID_RESPONSE`. Error messages avoid including the API key or raw server response body.

## Development

From the repository root:

```sh
npm run test --workspace @foto-owl/media-core
npm run build
```

The tests use Node's built-in test runner and injected mock request functions. They never call Pexels. Follow the [Pexels API documentation](https://www.pexels.com/api/documentation/) for current endpoint behavior and attribution requirements; applications using Pexels media should provide the required prominent Pexels link and credit photographers when possible.
