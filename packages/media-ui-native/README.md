# `@foto-owl/media-ui-native`

Headless React Native media UI behavior contracts. Components receive media, loading state, and callbacks through props, then provide native accessibility and interaction props through render functions. They do not fetch data, know a media provider, import other SDK/wrapper packages, include styles, or require a React Native build setup.

The consumer renders `View`, `Pressable`, `Modal`, `Image`, `ScrollView`, and any chosen video component. This keeps markup, visual design, image sizing, and video playback choices in the native app.

## MediaGrid

`MediaGrid` accepts `items`, `loading`, `hasMore`, `onLoadMore`, and `onItemClick`. Its render function receives those values and getters for the root, rows, items, and load-more control. Item props include an accessible button role and `onPress`; load-more props disable activation when loading or when no more items exist.

```jsx
import { Pressable, Text, View } from 'react-native';
import { MediaGrid } from '@foto-owl/media-ui-native';

<MediaGrid items={items} loading={loading} hasMore={hasMore} onLoadMore={loadMore} onItemClick={selectItem}>
  {({ items, getRootProps, getRowProps, getItemProps, getLoadMoreProps }) => (
    <View {...getRootProps()}>
      <View {...getRowProps()}>
        {items.map((item, index) => (
          <Pressable key={item.id} {...getItemProps({ item, index })}>
            <Text>{item.title ?? `Media ${index + 1}`}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable {...getLoadMoreProps()}><Text>Load more</Text></Pressable>
    </View>
  )}
</MediaGrid>
```

For infinite scrolling, connect `onLoadMore` to an app-owned list's end-reached callback. The package does not add a list implementation or observer.

## MediaLightbox

`MediaLightbox` is controlled by `item` and `open`; it calls `onClose` from the close-button getter and the modal's `onRequestClose` handler. Its render function receives `isVideo` plus `getModalProps`, `getCloseButtonProps`, `getImageProps`, and `getVideoProps`.

```jsx
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { MediaLightbox } from '@foto-owl/media-ui-native';

<MediaLightbox item={item} open={open} onClose={close}>
  {({ isVideo, getModalProps, getCloseButtonProps, getImageProps, getVideoProps }) => (
    <Modal {...getModalProps()}>
      <View>
        <Pressable {...getCloseButtonProps()}><Text>Close</Text></Pressable>
        {isVideo
          ? <VideoPlayer {...getVideoProps({ source: { uri: item.videoUri } })} />
          : <Image {...getImageProps({ source: { uri: item.imageUri } })} />}
      </View>
    </Modal>
  )}
</MediaLightbox>
```

There is no video dependency: choose a native video player in the app and pass its expected props. Modal visibility and Android back-button close behavior come from `getModalProps`.

## MediaReelSwiper

`MediaReelSwiper` accepts `items`, optional controlled `activeIndex`, and `onActiveChange(index, item)`. The scroller getter supplies `horizontal: false`, `pagingEnabled`, layout/scroll handlers, and accessibility labels. The slide getter supplies an accessible label and selected state. `scrollToIndex(index, animated)` is available when the consumer attaches the returned scroller ref.

```jsx
import { ScrollView, View, Text } from 'react-native';
import { MediaReelSwiper } from '@foto-owl/media-ui-native';

<MediaReelSwiper items={items} activeIndex={activeIndex} onActiveChange={setActiveIndex}>
  {({ items, getScrollerProps, getSlideProps }) => (
    <ScrollView {...getScrollerProps()}>
      {items.map((item, index) => (
        <View key={item.id} {...getSlideProps({ item, index })}>
          <Text>{item.title}</Text>
        </View>
      ))}
    </ScrollView>
  )}
</MediaReelSwiper>
```

React Native `pagingEnabled` provides page snapping; size the slides and scroll container in app-owned styles/layout so one item occupies each page.

## Styling and prop-getters

No style objects or design-system defaults are supplied. Spread getter results onto the corresponding native primitive. The getter's event handlers run before consumer handlers, and consumer handlers/props can be composed through the getter argument. Keep accessibility labels, roles, state, refs, and handlers intact when customizing props.

## Public exports

```js
import { MediaGrid, MediaLightbox, MediaReelSwiper } from '@foto-owl/media-ui-native';
```

## Development

```sh
npm run test --workspace @foto-owl/media-ui-native
npm run build
```

Tests use synthetic data and no native runtime or SDK packages.
