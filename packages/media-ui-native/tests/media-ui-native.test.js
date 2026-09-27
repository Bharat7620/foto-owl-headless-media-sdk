import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });

const { act, cleanup, render } = await import('@testing-library/react');
const { MediaGrid, MediaLightbox, MediaReelSwiper } = await import('../src/index.js');
const { createElement } = await import('react');

afterEach(() => cleanup());
after(() => dom.window.close());

test('MediaGrid provides items and accessible React Native prop getters', () => {
  let api;
  const items = [{ id: 1, kind: 'image', alt: 'Sunset' }, { id: 2, kind: 'video' }];
  render(createElement(MediaGrid, {
    items,
    loading: true,
    hasMore: true,
    onLoadMore: () => {},
    onItemClick: () => {},
    children: (value) => { api = value; return null; },
  }));

  assert.strictEqual(api.items, items);
  assert.equal(api.loading, true);
  assert.equal(api.hasMore, true);
  assert.deepEqual(api.getRootProps(), {
    accessibilityRole: 'grid', accessibilityLabel: 'Media results', accessibilityState: { busy: true },
  });
  assert.equal(api.getItemProps({ item: items[0], index: 0 }).accessibilityLabel, 'Sunset');
});

test('MediaGrid prop getters delegate item press and guard load-more callback', () => {
  const calls = [];
  let api;
  const onItemClick = (item, index) => calls.push(['item', item.id, index]);
  const onLoadMore = () => calls.push(['more']);
  render(createElement(MediaGrid, {
    items: [{ id: 7 }], hasMore: false, onItemClick, onLoadMore,
    children: (value) => { api = value; return null; },
  }));

  api.getItemProps({ item: api.items[0], index: 0 }).onPress({ nativeEvent: {} });
  const blockedMore = api.getLoadMoreProps();
  assert.equal(blockedMore.disabled, true);
  blockedMore.onPress();
  assert.deepEqual(calls, [['item', 7, 0]]);
});

test('MediaGrid enables load more when more items are available and not loading', () => {
  let api;
  let calls = 0;
  render(createElement(MediaGrid, {
    hasMore: true,
    onLoadMore: () => { calls += 1; },
    children: (value) => { api = value; return null; },
  }));
  const props = api.getLoadMoreProps();
  assert.equal(props.disabled, false);
  props.onPress();
  assert.equal(calls, 1);
});

test('MediaLightbox exposes modal, close, image, and video props', () => {
  let api;
  let closeCalls = 0;
  const item = { id: 4, kind: 'image', uri: 'file:///photo.jpg', alt: 'A photo' };
  render(createElement(MediaLightbox, {
    item,
    open: true,
    onClose: () => { closeCalls += 1; },
    children: (value) => { api = value; return null; },
  }));

  assert.equal(api.isVideo, false);
  assert.equal(api.getModalProps().visible, true);
  assert.equal(api.getModalProps().accessibilityViewIsModal, true);
  assert.deepEqual(api.getImageProps().source, { uri: 'file:///photo.jpg' });
  api.getCloseButtonProps().onPress();
  api.getModalProps().onRequestClose();
  assert.equal(closeCalls, 2);

  const video = { id: 5, mediaType: 'video', source: { uri: 'file:///clip.mp4' } };
  render(createElement(MediaLightbox, {
    item: video,
    children: (value) => { api = value; return null; },
  }));
  assert.equal(api.isVideo, true);
  assert.deepEqual(api.getVideoProps().source, video.source);
});

test('MediaLightbox is controlled and renders no content while closed', () => {
  let renders = 0;
  render(createElement(MediaLightbox, {
    item: { id: 1 },
    open: false,
    children: () => { renders += 1; return null; },
  }));
  assert.equal(renders, 0);
});

test('MediaReelSwiper exposes vertical paging props and detects the active page', async () => {
  const changes = [];
  let api;
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  render(createElement(MediaReelSwiper, {
    items,
    onActiveChange: (index, item) => changes.push([index, item.id]),
    children: (value) => { api = value; return null; },
  }));

  const scrollerProps = api.getScrollerProps();
  assert.equal(scrollerProps.horizontal, false);
  assert.equal(scrollerProps.pagingEnabled, true);
  assert.equal(api.activeIndex, 0);
  await act(async () => scrollerProps.onLayout({ nativeEvent: { layout: { height: 400 } } }));
  await act(async () => scrollerProps.onMomentumScrollEnd({
    nativeEvent: { layoutMeasurement: { height: 400 }, contentOffset: { y: 800 } },
  }));

  assert.equal(api.activeIndex, 2);
  assert.strictEqual(api.activeItem, items[2]);
  assert.deepEqual(changes, [[2, 'c']]);
});

test('MediaReelSwiper slide props expose accessibility and scrollToIndex uses the native ref', async () => {
  let api;
  render(createElement(MediaReelSwiper, {
    items: [{ id: 1 }, { id: 2 }],
    children: (value) => { api = value; return null; },
  }));
  const scrollerProps = api.getScrollerProps();
  const scrollCalls = [];
  scrollerProps.ref({ scrollTo: (options) => scrollCalls.push(options) });
  await act(async () => scrollerProps.onLayout({ nativeEvent: { layout: { height: 250 } } }));
  const slideProps = api.getSlideProps({ item: api.items[1], index: 1 });

  assert.equal(slideProps.accessibilityLabel, 'Media item 2');
  api.scrollToIndex(1, false);
  assert.deepEqual(scrollCalls, [{ y: 250, animated: false }]);
});
