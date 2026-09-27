# Skill: Wire application data to the media SDK

Use these instructions when an AI coding assistant connects an application to Foto Owl's media packages. First inspect the current implementation and package READMEs; preserve their public APIs and JavaScript conventions. Keep application choices in the app, data transport and normalization in `media-core`, and React lifecycle adaptation in `media-react`.

## Repository architecture and boundaries

```text
apps/web → media-react → media-core
apps/web → media-ui-react
```

- `@foto-owl/media-core` is framework-agnostic. It owns the Pexels HTTP client, response normalization, in-memory GET cache, in-flight request deduplication, and local event emitter. It must not import React, React Native, DOM, or UI packages.
- `@foto-owl/media-react` supplies React context and request-state hooks over a supplied core client. It delegates network and media behavior to core. It must not create/configure the client, reimplement Pexels logic, or depend on UI packages.
- The app owns configuration, query/search intent, combining independent result streams, presentation state, retry/empty-state decisions, and when user interactions emit events.
- UI packages receive items and callbacks as props. Do not put data fetching in UI components.

**Repository reality note:** `media-core` is implemented in JavaScript with JSDoc even though the assessment requested pure TypeScript. Follow the checked-in JavaScript + JSDoc implementation; do not introduce TypeScript.

## Configure the core client in the app

Create one client at the app boundary, then provide it to the React tree. The checked-in web entrypoint, `apps/web/src/main.jsx`, reads `import.meta.env.VITE_PEXELS_API_KEY`, calls `createMediaClient({ apiKey, logger: console })`, and renders the app under `<MediaProvider client={client}>`. Keep real credentials out of source files and version control; use `apps/web/.env` locally and the placeholder in `.env.example`. Never print, copy into examples, or commit a real key. Vite variables prefixed with `VITE_` are exposed to browser code, so treat this as a client-side API credential and follow the provider's key restrictions.

```jsx
// apps/web/src/main.jsx pattern
import { createMediaClient } from '@foto-owl/media-core';
import { MediaProvider } from '@foto-owl/media-react';

const apiKey = import.meta.env.VITE_PEXELS_API_KEY;
const client = apiKey ? createMediaClient({ apiKey, logger: console }) : null;

// Render the configuration message if client is absent; otherwise:
<MediaProvider client={client}><App /></MediaProvider>
```

The actual core entrypoint exports `createMediaClient`, `MediaClient`, `MediaSdkError`, `MediaEventEmitter`, and `createMediaEventEmitter`. Import public APIs from `@foto-owl/media-core`, not internal source paths. The client takes `{ apiKey, cacheTtlMs? }`; `fetchImpl` is also available for controlled tests/custom runtimes. Do not hardcode credentials or alter the public client interface to solve app-specific state problems.

## Use the React provider and hooks

Import `MediaProvider`, `useMediaClient`, `useMediaSearch`, `useMediaCurated`, `useMediaItem`, `useMediaEvent`, `useMediaViewEvent`, and `useMediaDownloadEvent` from `@foto-owl/media-react`. The provider receives an already-created core client. `useMediaClient()` throws a useful error outside the provider.

The search hook accepts an options object with `query`, `page`, `perPage`, and core filters such as `type`; it returns `results`, `pagination`, `loading`, `error`, `search`, and `refetch`. Empty query does not request data. Curated and item hooks return their documented result/loading/error/refetch values. Let core perform requests, cache, deduplicate, normalize, and report `MediaSdkError`; keep retries and the choice of what to display in the app.

```jsx
import { useMediaSearch } from '@foto-owl/media-react';

function PhotoResults({ query }) {
  const { results, pagination, loading, error, refetch } = useMediaSearch({
    query,
    page: 1,
    perPage: 24,
    type: 'photos',
  });

  if (!query) return <p>Search for something to begin.</p>;
  if (loading && results.length === 0) return <p role="status">Loading photos…</p>;
  if (error) return <button onClick={() => refetch()}>Retry: {error.message}</button>;
  if (results.length === 0) return <p>No photos found.</p>;

  return <button disabled={!pagination.hasNextPage} onClick={() =>
    refetch(query, { page: pagination.page + 1 })
  }>Load more</button>;
}
```

## Search photos and videos

Core `client.search(query, options)` defaults to photos. Pass `type: 'videos'` to use the Pexels video search endpoint. `media-react` forwards that option. The checked-in web app (`apps/web/src/App.jsx`) creates separate photo and video hook instances with `{ perPage: 24, type: 'photos' }` and `{ perPage: 24, type: 'videos' }`, then combines their app-owned arrays for the grid. This is the pattern when the product needs both kinds for one query; a single hook does not automatically issue both requests.

```jsx
const photoSearch = useMediaSearch({ perPage: 24, type: 'photos' });
const videoSearch = useMediaSearch({ perPage: 24, type: 'videos' });
// On a non-empty submitted query, call each hook's search(query, { page: 1 }).
// Keep separate result arrays/pages, then combine for presentation:
const items = [...photoResults, ...videoResults];
const videoItems = items.filter((item) => item.mediaType === 'video' || item.kind === 'video');
```

Core preserves useful Pexels fields and adds `kind: 'image' | 'video'` and `mediaType: 'photo' | 'video'`. Keep these fields intact so components and application logic can distinguish items. For combined searches, handle each request independently: retain successful results if the other request fails, show a partial-results error, and allow retry. Avoid issuing either request for an empty query.

## Loading, error, empty, and success states

Keep these states distinct in the app:

- Do not show results or errors as though an empty initial query were a completed search.
- Show a status while either required request is pending; retain already loaded items during load-more.
- Render an error from each failed stream without discarding the stream that succeeded.
- Show the empty state only after requests settle successfully and the combined result list is empty.
- Offer retry through the hook's `refetch`/`search` methods. Do not parse or reproduce Pexels requests in UI components.

`MediaSdkError` exposes a stable `code`, optional HTTP `status`, and a useful safe message. Common codes include `MISSING_API_KEY`, `INVALID_ARGUMENT`, `NETWORK_ERROR`, `HTTP_ERROR`, and `INVALID_RESPONSE`. Keep error reporting useful without logging credentials or raw response bodies.

## Pagination

Core pagination is one-based, defaults to page 1 and `perPage: 15`, and supports `perPage` up to 80. Each response includes `page`, `perPage`, `totalResults`, `hasNextPage`, `nextPageUrl`, and `previousPageUrl`. Use `hasNextPage` as the continuation signal.

For two independent photo/video searches, track page and accumulated items per type. On load more, request the next page only for streams whose pagination says `hasNextPage`; append successful pages and de-duplicate by both media kind/type and item ID. Guard duplicate load-more activation while requests are pending. This keeps one exhausted stream from preventing the other stream from continuing.

Core caches successful GETs in memory (30 seconds by default; set `cacheTtlMs: 0` to disable) and coalesces identical simultaneous requests. Do not add a second SDK-level cache in the app. App-level result arrays are for UI accumulation, not a replacement for core request behavior.

## View and download events

The core client exposes `client.events`. Its framework-neutral emitter supports `on(event, listener)`, `off(event, listener)`, and `emit(event, payload)` for `view` and `download`. `on` returns an unsubscribe function. `useMediaEvent`, `useMediaViewEvent`, and `useMediaDownloadEvent` subscribe in React and clean up when the listener changes or component unmounts. These hooks subscribe; they do not emit automatically.

```jsx
const client = useMediaClient();
useMediaViewEvent((payload) => console.info('Viewed', payload.mediaId));

function trackView(item, source) {
  client.events.emit('view', {
    mediaId: item.id,
    mediaType: item.mediaType, // 'photo' or 'video'
    url: item.url,
    source,
    metadata: { title: item.alt || item.title || '' },
  });
}
```

Use the same required `mediaId` and `mediaType` fields for `download`; optional `url`, `source`, and app-owned `metadata` add context. Emission is a local notification, not an analytics request to Pexels. Emit at the app interaction boundary (for example, selection or download), not from rendering code where rerenders could duplicate events.

## What belongs where

- **App:** Vite configuration, query intent, the decision to search both types, merged result lists, independent pagination, retries/partial errors/empty states, selected item, and user-triggered event emission.
- **media-react:** provider, context, React request/loading/error lifecycle, stale response handling, and event subscription cleanup.
- **media-core:** Pexels endpoints and Authorization configuration, fetch, response validation/normalization, pagination request parameters, cache/deduplication, SDK errors, and generic event emitter.
- **media-ui-react:** headless interaction/accessibility behavior only; it receives data and callbacks and never fetches.

## Verification Checklist

- [ ] Read the current core and React package READMEs/source before using or changing an API.
- [ ] The app creates the client from `VITE_PEXELS_API_KEY` and supplies it to `MediaProvider`; no key is hardcoded, printed, or committed.
- [ ] Imports use public package roots; no deep internal imports were added.
- [ ] The app calls `useMediaSearch` with `type: 'photos'` and `type: 'videos'` separately when both collections are required.
- [ ] Empty query, loading, partial/full error, empty success, and populated states are handled distinctly.
- [ ] Photo and video pages advance independently; duplicate items are not appended.
- [ ] Event listeners are cleaned up; view/download emission includes `mediaId` and `mediaType` and occurs in response to a user action.
- [ ] `media-core` remains JavaScript + JSDoc and framework-agnostic; dependency direction remains `app → media-react → media-core` and `app → media-ui-react`.
