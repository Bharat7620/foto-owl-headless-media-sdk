# Skill: Compose the headless React media components

Use these instructions when an AI coding assistant builds or changes a React view using `@foto-owl/media-ui-react`. Inspect the checked-in package README, component source, and existing app views before changing behavior. The UI package provides behavior and accessibility helpers; the consuming app chooses the markup, styling, media source fields, and data callbacks.

## Architecture and dependency restrictions

```text
apps/web → media-ui-react
apps/web → media-react → media-core
```

- `media-ui-react` is independent presentation behavior. It may use React, but must not import `media-core`, `media-react`, `media-native`, or `media-ui-native`; it must not fetch, know Pexels, or contain application data logic.
- Pass `items`, selection state, and callbacks into UI components through props. Keep SDK hooks/client calls in the app or the data adapter.
- Import components and helpers from the public package root `@foto-owl/media-ui-react`; do not require consumers to import internal files.
- All markup and all CSS belong to the consuming application. The package ships no visual theme or stylesheet.

**Repository reality note:** `media-core` is implemented in JavaScript with JSDoc even though the assessment requested pure TypeScript. Follow the checked-in JavaScript + JSDoc implementation; do not introduce TypeScript while composing these components.

## Render-prop and prop-getter contract

The components take a function as `children`. That function receives component state/data and prop-getters. Spread the result of each getter onto the corresponding consumer-owned element. Getters supply behavior and semantic attributes; extra props can add classes and custom values. Preserve returned refs, event handlers, IDs, roles, keyboard behavior, and ARIA attributes. Existing app code follows this pattern in `apps/web/src/components/MediaGallery.jsx`, `MediaLightboxView.jsx`, and `ReelsView.jsx`.

```jsx
<MediaGrid items={items}>
  {(grid) => <div {...grid.getRootProps({ className: 'my-grid' })}>…</div>}
</MediaGrid>
```

Do not put fetch calls, Pexels-specific normalization, or business rules inside render callbacks. If the provider's record uses special source fields, adapt it in the application (as `apps/web/src/utils/media.js` does), then pass the correct string URL to the relevant getter.

## MediaGrid

`MediaGrid` accepts `items`, `loading`, `hasMore`, `onLoadMore`, and `onItemClick`. Its render function receives `items`, `loading`, `hasMore`, `onLoadMore`, `onItemClick`, `getRootProps`, `getRowProps`, `getItemProps`, and `getLoadMoreProps`. Items may be photos or videos; the grid does not filter or fetch them. Use `getItemProps({ item, index })` on a semantic, focusable control such as a button. The getter calls `onItemClick(item, index, event)` and supports keyboard activation. Load-more behavior is guarded while loading or when `hasMore` is false.

The checked-in `MediaGallery.jsx` uses the grid render API and renders each item as a button with a nested image/placeholder, a video badge based on the media kind, and a caption. A compact composition looks like this:

```jsx
import { MediaGrid } from '@foto-owl/media-ui-react';

function Gallery({ items, loading, hasMore, loadMore, selectItem }) {
  return (
    <MediaGrid
      items={items}
      loading={loading}
      hasMore={hasMore}
      onLoadMore={loadMore}
      onItemClick={(item) => selectItem(item)}
    >
      {(grid) => (
        <section {...grid.getRootProps({ className: 'media-grid' })}>
          {grid.items.map((item, index) => (
            <button key={`${item.id}-${index}`} {...grid.getItemProps({ item, index, className: 'media-card' })}>
              {item.kind === 'video' ? '▶ ' : ''}{item.alt || item.title || `Media ${index + 1}`}
            </button>
          ))}
          <button {...grid.getLoadMoreProps({ className: 'load-more' })}>
            {grid.loading ? 'Loading…' : 'Load more'}
          </button>
        </section>
      )}
    </MediaGrid>
  );
}
```

`onLoadMore` is a callback, not an infinite-scroll implementation. The app can connect it to its pagination handler or an app-owned intersection observer. The UI component itself does not call APIs.

## MediaLightbox

`MediaLightbox` is controlled with `item`, optional `open` (defaults from item presence), and `onClose`. When closed or without an item it renders nothing. Its child function receives `item`, `open`, `mediaType`, `isVideo`, `close`, and `getDialogProps`, `getCloseButtonProps`, `getImageProps`, `getVideoProps`.

```jsx
import { useState } from 'react';
import { MediaLightbox } from '@foto-owl/media-ui-react';
import { mediaSrc } from './utils/media.js'; // app-owned provider-to-URL adaptation

function Viewer() {
  const [selected, setSelected] = useState(null);
  return (
    <MediaLightbox item={selected} open={Boolean(selected)} onClose={() => setSelected(null)}>
      {(api) => (
        <div {...api.getDialogProps({ className: 'lightbox-dialog' })}>
          <button {...api.getCloseButtonProps({ className: 'lightbox-close' })}>Close</button>
          {api.isVideo
            ? <video {...api.getVideoProps({ src: mediaSrc(api.item), className: 'lightbox-video', controls: true })} />
            : <img {...api.getImageProps({ src: mediaSrc(api.item), className: 'lightbox-image' })} />}
        </div>
      )}
    </MediaLightbox>
  );
}
```

The dialog prop-getter provides dialog semantics, modal accessibility, and a focus target. Escape calls `onClose`; Tab is kept within the open dialog; focus is restored on cleanup. Render a visible close control with `getCloseButtonProps`. The consumer must render the correct media element and supply a URL string for the source shape it uses. Core-normalized Pexels photos may have an object at `item.src`; the checked-in web app adapts this through its app-owned `mediaSrc` utility. Do not pass a source object to an HTML media `src` prop.

## MediaReelSwiper

`MediaReelSwiper` accepts `items`, optional controlled `activeIndex`, `onActiveChange(index, item)`, and an optional accessible `label`. Its render function receives `items`, `activeIndex`, `activeItem`, `onActiveChange`, `getScrollerProps`, and `getSlideProps`. If `activeIndex` is controlled, update it in the app's callback. The scroller is vertical and detects the slide nearest its center; the component reports active changes but does not provide snap CSS.

The actual `apps/web/src/components/ReelsView.jsx` composes it with app-owned video markup, controls, caption, and `.reel-scroller` / `.reel-slide` styles:

```jsx
import { MediaReelSwiper } from '@foto-owl/media-ui-react';

function Reels({ items, activeIndex, setActiveIndex }) {
  return (
    <MediaReelSwiper items={items} activeIndex={activeIndex} onActiveChange={setActiveIndex}>
      {(reel) => (
        <div {...reel.getScrollerProps({ className: 'reel-scroller' })}>
          {reel.items.map((item, index) => (
            <section key={item.id} {...reel.getSlideProps({ item, index, className: 'reel-slide' })}>
              <video src={item.videoUrl} controls aria-label={item.title || `Video ${index + 1}`} />
            </section>
          ))}
        </div>
      )}
    </MediaReelSwiper>
  );
}
```

Consumer CSS can establish vertical scrolling and snap paging, for example `overflow-y: auto; scroll-snap-type: y mandatory` on the scroller and `scroll-snap-align: start` on each slide. The component exposes vertical region and slide semantics/state attributes; keep the accessible label and any getter-provided attributes.

## Compose the components

Keep selected media and the video reel collection in application state. Pass the same selected item from the grid to the controlled lightbox. For example, the checked-in `apps/web/src/App.jsx` supplies `items`, `loading`, `hasMore`, and callbacks to `MediaGrid`, stores the clicked item in `selected`, and passes that value and `onClose` to `MediaLightbox`. It separately derives `videoItems` and passes them to the reels view. The app is responsible for converting a grid click into selection, emitting a view event if desired, and clearing selection on close.

For a combined photo/video grid, leave all media items in `items` and distinguish them using existing `mediaType` / `kind` fields. Render an image or video badge/source based on that field. Do not add Pexels-specific checks to `media-ui-react`; if an item needs URL adaptation, do it in app code.

## Markup, CSS, and accessibility

- Use semantic consumer elements: buttons for clickable grid items and close actions, a dialog container for the lightbox, and labelled sections/slides for reels.
- Spread prop-getter results directly on the relevant element. When adding an event handler, preserve and compose the getter behavior rather than replacing it.
- Render loading and empty messages in the app; use `loading` and `hasMore` inputs to communicate grid state.
- Give media elements meaningful `alt` text or accessible labels, and provide visible keyboard-operable controls.
- Define every class, layout rule, animation, overlay, and snap style in app-owned CSS. No built-in component appearance should be assumed.

## Verification Checklist

- [ ] Public imports come from `@foto-owl/media-ui-react` and match `src/index.js`: `MediaGrid`, `MediaLightbox`, `MediaReelSwiper`, `getMediaKind`, `getMediaSource`.
- [ ] Data and callbacks flow through props/render-prop values; components do not fetch or contain Pexels logic.
- [ ] Grid item/load-more behavior uses the corresponding prop-getters and preserves supplied behavior/ARIA props.
- [ ] Lightbox receives the selected item, controlled open state, and close callback; Escape and focus behavior remain intact.
- [ ] Photo/video source adaptation returns a URL string and stays in app code when provider records require it.
- [ ] Reel active index is controlled or intentionally uncontrolled; consumer CSS provides vertical snap paging.
- [ ] Markup and CSS remain consumer-owned; no design system or stylesheet is added to the UI package.
- [ ] `media-ui-react` imports neither SDK nor React data wrapper; core stays framework-agnostic.
- [ ] `media-core` remains JavaScript + JSDoc despite the assessment's pure-TypeScript wording; no TypeScript is introduced.
