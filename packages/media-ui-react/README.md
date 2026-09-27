# `@foto-owl/media-ui-react`

Headless React behavior primitives for media grids, lightboxes, and vertically paged reels. This package depends only on React. It does not import the SDK or data hooks, make API calls, include a visual theme, or ship CSS. The app supplies data and callbacks, then renders its own markup and styles.

```text
app → media-ui-react
```

Components use a render-prop API. Their child function receives the data, state, callbacks, and prop-getters needed to build accessible consumer-owned markup.

## MediaGrid

`MediaGrid` accepts `items`, `loading`, `hasMore`, `onLoadMore`, and `onItemClick`. It passes these values and `getRootProps`, `getRowProps`, `getItemProps`, and `getLoadMoreProps` to its render function. The item prop-getter adds keyboard activation for Enter and Space.

```jsx
import { MediaGrid } from '@foto-owl/media-ui-react';

function Results({ items, loading, hasMore, loadNext, selectItem }) {
  return (
    <MediaGrid
      items={items}
      loading={loading}
      hasMore={hasMore}
      onLoadMore={loadNext}
      onItemClick={selectItem}
    >
      {({ items, getRootProps, getRowProps, getItemProps, getLoadMoreProps, loading }) => (
        <section {...getRootProps({ className: 'results-grid' })}>
          <div {...getRowProps({ className: 'results-grid__row' })}>
            {items.map((item, index) => (
              <button
                key={item.id}
                {...getItemProps({ item, index, className: 'results-grid__item' })}
              >
                {item.title ?? item.alt ?? `Media ${index + 1}`}
              </button>
            ))}
          </div>
          <button {...getLoadMoreProps({ className: 'results-grid__more' })}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </section>
      )}
    </MediaGrid>
  );
}
```

Load-more activation is guarded while loading or when `hasMore` is false. The component does not observe scrolling or fetch another page by itself; wire `onLoadMore` to app-owned pagination or an observer.

## MediaLightbox

`MediaLightbox` accepts `item`, controlled `open`, and `onClose`. When open with an item, its render function receives `isVideo`, `mediaType`, `close`, and prop-getters for the dialog, close button, image, and video. The item is generic: the default media source is a string `item.src` or `item.url`. Override `src` through the getter when the app's data shape differs.

```jsx
import { MediaLightbox } from '@foto-owl/media-ui-react';

function Viewer({ item, open, closeViewer }) {
  return (
    <MediaLightbox item={item} open={open} onClose={closeViewer}>
      {({ isVideo, getDialogProps, getCloseButtonProps, getImageProps, getVideoProps }) => (
        <div {...getDialogProps({ className: 'viewer', 'aria-label': item.title ?? 'Media viewer' })}>
          <button {...getCloseButtonProps({ className: 'viewer__close' })}>Close</button>
          {isVideo
            ? <video {...getVideoProps({ src: item.videoUrl, className: 'viewer__media' })} />
            : <img {...getImageProps({ src: item.imageUrl, className: 'viewer__media' })} />}
        </div>
      )}
    </MediaLightbox>
  );
}
```

The dialog getter supplies dialog semantics and a focus target. While open, Escape calls `onClose`, Tab focus is kept within the dialog, and focus returns to the previously focused element during cleanup. The consumer is responsible for rendering the dialog getter on the dialog container and providing a visible close control.

## MediaReelSwiper

`MediaReelSwiper` accepts `items`, optional controlled `activeIndex`, and `onActiveChange(index, item)`. It supplies `activeIndex`, `activeItem`, `getScrollerProps`, and `getSlideProps` to the render function. Scrolling updates the nearest slide to the viewport center; in uncontrolled mode, the component updates its active index internally.

```jsx
import { MediaReelSwiper } from '@foto-owl/media-ui-react';

function Reel({ items, activeIndex, setActiveIndex }) {
  return (
    <MediaReelSwiper items={items} activeIndex={activeIndex} onActiveChange={setActiveIndex}>
      {({ items, activeIndex, getScrollerProps, getSlideProps }) => (
        <div {...getScrollerProps({ className: 'reel', 'aria-label': 'Featured media' })}>
          {items.map((item, index) => (
            <article key={item.id} {...getSlideProps({ item, index, className: 'reel__slide' })}>
              {item.title}
            </article>
          ))}
          <output aria-live="polite">{activeIndex + 1} / {items.length}</output>
        </div>
      )}
    </MediaReelSwiper>
  );
}
```

The package supplies no CSS. Apply vertical scrolling and snap paging in the app stylesheet, for example:

```css
.reel {
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  block-size: 100dvh;
}

.reel__slide {
  scroll-snap-align: start;
  min-block-size: 100%;
}
```

The scroller getter exposes a vertical region and scroll handler; slide getters expose slide semantics and active/media-kind data attributes. Consumers remain free to use any markup and styling.

## Prop-getter contract

Spread getter results onto the matching consumer element. Extra props are merged with behavior props; supplied event handlers run after the component behavior handler, and supplied refs are composed with internal refs. Do not drop returned ARIA attributes, refs, click/key handlers, or data attributes when customizing props.

## Accessibility and styling

The primitives provide baseline roles, labels, busy/disabled state, keyboard activation, dialog focus handling, and slide state attributes. Consumers control semantic structure, visible labels, focusable content, layout, focus entry points, and all CSS. No stylesheet or design-system dependency is included.

## Public exports

Import from the package root:

```js
import {
  MediaGrid,
  MediaLightbox,
  MediaReelSwiper,
  getMediaKind,
  getMediaSource,
} from '@foto-owl/media-ui-react';
```

`getMediaKind` and `getMediaSource` are small provider-agnostic helpers for conventional `kind`/`mediaType` and string `src`/`url` fields. They do not fetch or adapt provider-specific records.

## Development

```sh
npm run test --workspace @foto-owl/media-ui-react
npm run build
```

Tests use consumer render functions and synthetic media items; they do not depend on media-core or media-react.
