# Foto Owl Headless Media SDK + Component Library

Foto Owl is an npm-workspace monorepo containing a Pexels media client, React and React Native-facing adapters, independent headless component packages, and a React web demonstration. The web app searches for photos and videos, displays them in a consumer-styled grid, opens selected media in a lightbox, and presents video results as vertical reels.

## 1. Project Overview

The project demonstrates a layered media architecture:

- A platform-neutral SDK handles Pexels requests, response normalization, caching, request deduplication, and local media events.
- Framework wrappers expose the SDK through React context and hooks.
- Headless UI packages provide interaction and accessibility behavior while the consuming app owns markup and styling.
- `apps/web` composes these packages into the working web experience.

## 2. Architecture

```text
apps/web ──▶ @foto-owl/media-react ──▶ @foto-owl/media-core
    └──────▶ @foto-owl/media-ui-react

Native application ──▶ @foto-owl/media-native ──▶ @foto-owl/media-core
              └──────▶ @foto-owl/media-ui-native
```

The app creates/configures a core client, uses a platform wrapper for data state where appropriate, and passes items and callbacks to its UI components. The core remains framework-agnostic. The repository currently has a web app and native-oriented packages, but no full React Native application.

## 3. Monorepo/package structure

```text
apps/
  web/                    Vite + React web application
packages/
  media-core/             Framework-agnostic Pexels SDK
  media-react/            React provider and data/event hooks
  media-native/           React Native-facing provider and hooks
  media-ui-react/         Headless React grid, lightbox, and reel behavior
  media-ui-native/        Headless React Native grid, lightbox, and reel behavior
skills/
  wiring-data/SKILL.md    AI assistant guide for SDK/app data integration
  using-components/SKILL.md
                          AI assistant guide for headless UI composition
```

All packages are JavaScript ES modules and are managed by the root npm workspaces (`apps/*` and `packages/*`). Each package exports its public API from its `src/index.js` entrypoint.

## 4. Dependency direction

- Web app: `app → media-react → media-core` and `app → media-ui-react`.
- Native consumers: `app → media-native → media-core` and `app → media-ui-native`.
- UI component packages must not import `media-core` or either framework wrapper. They receive data and callbacks from consumers.
- `media-react` and `media-native` wrap the core client and must not import UI components.
- `media-core` must not import React, React Native, DOM APIs, or UI packages.
- The app may import `media-core` directly to create/configure the client before passing it to a provider. The web entrypoint does this in `apps/web/src/main.jsx`.

## 5. `@foto-owl/media-core` responsibilities

`packages/media-core` provides `createMediaClient`, `MediaClient`, `MediaSdkError`, and the `MediaEventEmitter` APIs. It supports photo and video search, curated photos/popular videos, lookup by ID, pagination, response normalization, an in-memory GET cache, request deduplication, and local `view` / `download` events. Normalized records retain useful Pexels fields and add `kind` and `mediaType` markers. Event emission is local; the app decides when a view or download occurred.

The core package has no React, React Native, DOM, or UI dependency. Its test suite injects mocked fetch functions rather than calling Pexels.

## 6. `@foto-owl/media-react` responsibilities

`packages/media-react` exports `MediaProvider`, `useMediaClient`, `useMediaSearch`, `useMediaCurated`, `useMediaItem`, `useMediaEvent`, `useMediaViewEvent`, and `useMediaDownloadEvent`. It provides client context, hook loading/error/result state, and React subscription cleanup. The app supplies the configured client; requests and business behavior remain in core.

## 7. `@foto-owl/media-native` responsibilities

`packages/media-native` provides `MediaNativeProvider` and corresponding client, search, curated, item, and event hooks. It is a thin React Native-facing adapter over `media-core`, not a full native app or build setup. Native screens and application code own rendering, styling, configuration, and product behavior.

## 8. `@foto-owl/media-ui-react` responsibilities

`packages/media-ui-react` exports `MediaGrid`, `MediaLightbox`, `MediaReelSwiper`, `getMediaKind`, and `getMediaSource`. The components accept data and callbacks through props and render-prop functions, and expose prop-getters for interaction and accessibility behavior. The package does not fetch data or ship CSS; the consumer supplies markup, source adaptation, and styling.

## 9. `@foto-owl/media-ui-native` responsibilities

`packages/media-ui-native` exports `MediaGrid`, `MediaLightbox`, and `MediaReelSwiper` for native consumers. Its components expose render-prop state and native-oriented getters. Consumers render the native primitives and choose their styling and video player. The package does not depend on the SDK, wrappers, or `media-ui-react`, and does not include a full app or visual design system.

## 10. Web application flow: Search → Grid → Lightbox → Reels

1. **Search:** `apps/web/src/App.jsx` uses separate `useMediaSearch` instances for photos and videos. A submitted non-empty query requests both types; the app tracks each result set and page independently and combines their items.
2. **Grid:** The combined items go to `MediaGrid` and the app-owned `MediaGallery`. Items retain their photo/video kind. The app handles loading, partial/full errors, empty results, and load-more callbacks.
3. **Lightbox:** Selecting a grid item stores it as the selected item. `MediaLightbox` receives the selected item and controlled open/close state; `MediaLightboxView` renders image or video markup and app-owned metadata/download controls.
4. **Reels:** The app derives `videoItems` from combined results and supplies them to `MediaReelSwiper` through `ReelsView`. The app owns reel markup, playback controls, vertical scroll-snap styling, and event emission.

The app adapts Pexels media source fields in `apps/web/src/utils/media.js`. Photo image sources and video file links are resolved there, outside the generic component package.

## 11. Pexels API setup

The web app reads `import.meta.env.VITE_PEXELS_API_KEY` in `apps/web/src/main.jsx` and passes the value to `createMediaClient`. For local use, create `apps/web/.env` from `apps/web/.env.example` and set the key there. The actual `.env` file is ignored by Git; never place a real key in source, documentation, screenshots, or commits. The example file contains only a placeholder.

Vite exposes `VITE_` variables to browser-side code. Use an API key permitted for this use and follow Pexels' restrictions. The client sends the key through the Pexels `Authorization` header; it is not embedded in request URLs or SDK-generated error messages.

## 12. Local development/setup commands

Requirements: Node.js 18 or newer (the core package declares `node >=18`) and npm with workspace support.

From the repository root:

```sh
npm install
```

Create `apps/web/.env` from the example using your shell or editor, add `VITE_PEXELS_API_KEY`, and restart Vite after changing environment values. Start the web development server with the root script:

```sh
npm run dev
```

The root package defines `dev` (delegates to `@foto-owl/web`) and `build` (runs available workspace build scripts). The web package also defines `dev`, `build`, and `test`.

## 13. Testing

Each package has a `test` script. Run the full workspace test suite from the root:

```sh
npm run test --workspaces --if-present
```

Or run a package's tests individually:

```sh
npm run test --workspace @foto-owl/media-core
npm run test --workspace @foto-owl/media-react
npm run test --workspace @foto-owl/media-native
npm run test --workspace @foto-owl/media-ui-react
npm run test --workspace @foto-owl/media-ui-native
npm run test --workspace @foto-owl/web
```

Tests use Node's test runner and mocked clients/network calls; they are not intended to call the live Pexels API. There is no root lint script in the current root `package.json`.

## 14. Production build

Build the web app and all workspaces that define a build script:

```sh
npm run build
```

The root build invokes `npm run build --workspaces --if-present`. Package build scripts run JavaScript syntax checks; the web package runs `vite build`. This produces a local production bundle and does not deploy the app.

## 15. AI coding assistant skills

- [`skills/wiring-data/SKILL.md`](skills/wiring-data/SKILL.md) guides assistants through client setup, Pexels configuration, providers/hooks, photo/video streams, states, pagination, events, and responsibility/dependency boundaries. It was written after inspecting the core and React package READMEs/source and the web entrypoint/app. Its examples and API names were checked against those files; it is guidance, not executable code, and has no separate automated skill test.
- [`skills/using-components/SKILL.md`](skills/using-components/SKILL.md) guides assistants through the three headless React components, render props/getters, consumer-owned markup/CSS, accessibility, composition, and import restrictions. It was written after inspecting the UI package README/source and the web component views. Its documented props/getters were manually cross-checked against those sources; it has no separate automated skill test.

## 16. AI-assisted development disclosure

AI assistance was used to implement and document the SDK, wrappers, headless components, web application, tests, and the two coding-assistant skills. The architecture, functional requirements, scope boundaries, and review/verification direction were human-directed. Automated test/build commands are available above; this README does not claim a run result unless recorded separately for a specific change.

## 17. JavaScript + JSDoc implementation tradeoff

The assessment requested a pure TypeScript implementation for `media-core`. This repository's `media-core` is implemented in JavaScript with JSDoc instead. This is a known deviation, retained to match the JavaScript-focused implementation direction. The repository does not claim a TypeScript implementation or TypeScript type-checking.

## 18. Known limitations / tradeoffs

- There is no complete React Native application or native bundler/build configuration; the native packages demonstrate package boundaries and component/wrapper contracts.
- `media-ui-react` and `media-ui-native` are headless. Consumers provide visual markup/styling; the web app contains its own styles and reel snap behavior.
- The React grid exposes a load-more callback but does not implement a scroll observer; the app wires it to its own pagination handler.
- Core caching is in-memory and per client instance; event notifications are local and are not sent to Pexels or an analytics service.
- The web API key is supplied through Vite client configuration and therefore is available to browser code; it must not be treated as a server-only secret.
- `media-core` uses JavaScript + JSDoc rather than the assessment's requested pure TypeScript.
- No deployment target or hosted URL is configured in this repository.

## 19. Assessment checklist

- [x] npm workspaces contain the web app and five requested media packages.
- [x] `media-core` exposes the Pexels client, photo/video operations, normalized data, pagination, cache, request deduplication, errors, and event emitter.
- [x] React and native-facing wrappers delegate data operations to core and expose hooks/provider APIs.
- [x] React and native UI packages expose grid, lightbox, and reel behavior without depending on SDK/wrapper packages.
- [x] Web app composes search, combined photo/video results, grid, lightbox, and video reels.
- [x] Pexels key configuration uses a local environment variable and placeholder example; the actual key is not documented here.
- [x] JavaScript tests and workspace production build scripts are present.
- [x] AI coding assistant skills exist at `skills/wiring-data/SKILL.md` and `skills/using-components/SKILL.md`.
- [ ] Convert `media-core` to pure TypeScript if strict compliance with that assessment requirement is mandatory.
- [ ] Add a full native app/build setup if an executable React Native product is required.
