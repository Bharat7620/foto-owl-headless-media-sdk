# `@foto-owl/media-native`

React Native-facing provider and hooks for the platform-neutral `@foto-owl/media-core` client. This package is a thin adapter: it provides the configured client through React context and delegates search, curated results, item lookup, and events to that client.

```text
native app → media-native → media-core
```

It does not duplicate API, caching, normalization, or business logic. It is a JavaScript package with a React peer dependency; it does not add a React Native app, native build tooling, or UI components.

## Usage

Create the client in the app/configuration layer, then provide it to native screens:

```js
import { createMediaClient } from '@foto-owl/media-core';
import {
  MediaNativeProvider,
  useMediaSearch,
  useMediaViewEvent,
} from '@foto-owl/media-native';

const client = createMediaClient({ apiKey: appConfig.pexelsApiKey });

function SearchScreen() {
  const { results, loading, error, pagination, refetch } = useMediaSearch({
    query: 'waterfall',
    page: 1,
    perPage: 20,
  });
  useMediaViewEvent((event) => console.info('Viewed item', event.mediaId));

  // Render these values with app-owned React Native primitives.
  return null;
}

function NativeApp() {
  return (
    <MediaNativeProvider client={client}>
      <SearchScreen />
    </MediaNativeProvider>
  );
}
```

## Provider and hooks

- `MediaNativeProvider` supplies an existing media-core client to its descendants.
- `useMediaClient()` returns that client and throws a helpful error outside the provider.
- `useMediaSearch({ query, page, perPage, ...filters })` returns `results`, `pagination`, `loading`, `error`, `search`, and `refetch`. Empty queries do not call the client; stale responses are ignored.
- `useMediaCurated({ page, perPage, ...options })` returns the same paginated state plus `refetch`.
- `useMediaItem(id, options)` returns `data`, `loading`, `error`, and `refetch`.
- `useMediaEvent(event, listener)`, `useMediaViewEvent(listener)`, and `useMediaDownloadEvent(listener)` subscribe to the core emitter and clean up automatically.

These hooks only coordinate React state and lifecycle. The app owns rendering, styling, API-key configuration, and any application-specific data rules. No Pexels API calls are implemented in this package.

## Public exports

All APIs are exported from the package root:

```js
import {
  MediaNativeProvider,
  useMediaClient,
  useMediaSearch,
  useMediaCurated,
  useMediaItem,
  useMediaEvent,
  useMediaViewEvent,
  useMediaDownloadEvent,
} from '@foto-owl/media-native';
```

## Development

```sh
npm run test --workspace @foto-owl/media-native
npm run build
```

Tests inject a mock client and do not call Pexels.
