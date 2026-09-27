# `@foto-owl/media-react`

React provider and hooks that adapt the framework-agnostic `@foto-owl/media-core` client for React applications. This package owns React context and request-state lifecycle only. It delegates fetching, normalization, caching, request deduplication, and event behavior to the supplied media-core client.

Dependency direction:

```text
app → media-react → media-core
```

The React package does not create a client, contain Pexels API logic, or depend on UI components.

## Provider setup

Create/configure the media-core client in the app, then provide it near the app root:

```jsx
import { createMediaClient } from '@foto-owl/media-core';
import { MediaProvider } from '@foto-owl/media-react';

const client = createMediaClient({ apiKey: appConfig.pexelsApiKey });

root.render(
  <MediaProvider client={client}>
    <App />
  </MediaProvider>,
);
```

Pass the key through runtime configuration; do not put a real key in source control. See the [media-core README](../media-core/README.md) for client configuration and key handling.

## `useMediaClient()`

Returns the client supplied by the nearest `MediaProvider`. It throws a clear error if rendered outside a provider.

```jsx
function ClientStatus() {
  const client = useMediaClient();
  return <span>{client ? 'Media client ready' : 'Unavailable'}</span>;
}
```

## `useMediaSearch()`

Accepts `query`, `page`, `perPage`, and any additional media-core search options such as `type: 'videos'` or `orientation`. It returns `results`, `pagination`, `loading`, `error`, `search`, and `refetch`. Empty queries do not issue requests. Older requests are ignored if the query or pagination changes before they finish.

```jsx
function SearchResults({ query }) {
  const { results, pagination, loading, error, refetch } = useMediaSearch({
    query,
    page: 1,
    perPage: 24,
  });

  if (loading) return <p>Loading…</p>;
  if (error) return <button onClick={() => refetch()}>Retry: {error.message}</button>;

  return (
    <>
      <p>{results.length} results</p>
      {pagination.hasNextPage && <button onClick={() => refetch(query, { page: pagination.page + 1 })}>Next page</button>}
    </>
  );
}
```

`search(queryOverride, optionsOverride)` and its `refetch` alias can request another query or page without changing the surrounding app state. Pagination includes `page`, `perPage`, `totalResults`, `hasNextPage`, `nextPageUrl`, and `previousPageUrl`.

## `useMediaCurated()`

Loads curated photos by default, or popular videos when passed `type: 'videos'`. It returns `results`, `pagination`, `loading`, `error`, and `refetch(optionsOverride)`.

```jsx
const { results, loading, error, refetch } = useMediaCurated({ page: 1, perPage: 12 });
```

## `useMediaItem()`

Loads a single photo or video by ID. It returns `data`, `loading`, `error`, and `refetch(idOverride, optionsOverride)`. A missing ID does not issue a request.

```jsx
const { data, loading, error, refetch } = useMediaItem(mediaId, { type: 'videos' });
```

## Event subscriptions

`useMediaEvent(event, listener)` subscribes to a media-core event and removes the subscription when the component unmounts or the event/listener changes. Convenience hooks `useMediaViewEvent(listener)` and `useMediaDownloadEvent(listener)` are also exported.

```jsx
function MediaAnalytics() {
  useMediaViewEvent((payload) => console.info('Viewed', payload.mediaId));
  useMediaDownloadEvent((payload) => console.info('Downloaded', payload.mediaId));
  return null;
}
```

The app decides when to emit these events through `client.events`; the hooks only subscribe.

## Error and loading states

Each data hook exposes `loading` and `error` separately. A failed request clears that hook's current result and stores the error so the app can show a message or offer a retry. These hooks do not implement retries, cancellation at the network layer, or business rules; stale responses are ignored at the React state layer.

## Public exports

Import from the package root, without deep paths:

```js
import {
  MediaProvider,
  useMediaClient,
  useMediaSearch,
  useMediaCurated,
  useMediaItem,
  useMediaEvent,
  useMediaViewEvent,
  useMediaDownloadEvent,
} from '@foto-owl/media-react';
```

## Development

```sh
npm run test --workspace @foto-owl/media-react
npm run build
```

Tests use an in-memory mock media-core client and never request the Pexels API.
