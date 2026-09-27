# Foto Owl Web

Foto Owl is a responsive React web application for searching Pexels photos and videos, viewing selected media, browsing video reels, and demonstrating view/download event tracking.

## Setup

From the repository root, install workspace dependencies:

```sh
npm install
```

Create `apps/web/.env` from the example and add your Pexels API key:

```sh
cp apps/web/.env.example apps/web/.env
```

Set `VITE_PEXELS_API_KEY` to the key from your [Pexels API page](https://www.pexels.com/api/). Vite exposes this value to the web client, so use a key intended for browser-side development and follow Pexels' usage and domain restrictions. Never commit `.env`.

Start the development server:

```sh
npm run dev
```

Create the production bundle:

```sh
npm run build
```

Run app tests:

```sh
npm run test --workspace @foto-owl/web
```

## Architecture

`apps/web` is the integration layer. It constructs `MediaClient` from the Vite environment and passes it to `MediaProvider` from `@foto-owl/media-react`. The provider hooks delegate search operations to `@foto-owl/media-core`. The app separately renders headless components from `@foto-owl/media-ui-react` and supplies all markup and CSS.

```text
apps/web ──> media-react ──> media-core
    └──────> media-ui-react
```

The headless UI package has no dependency on the SDK or data wrapper. The app emits view and download events through the configured client's event emitter and consumes them with the wrapper's event hooks.

## User flow

Search using the input or suggestions, select a result to open its accessible lightbox, or open the video reels view when video results are available. Search pagination is exposed through a load-more control. The app includes loading, empty, error, and recent activity states.

The app owns responsive styling. Reels use vertical scroll snapping, and selected media can be downloaded or opened through the source URL when one is available.
