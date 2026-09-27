import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });

const { act, cleanup, fireEvent, render, screen } = await import('@testing-library/react');
const { MediaGrid, MediaLightbox, MediaReelSwiper } = await import('../src/index.js');
const { createElement } = await import('react');

afterEach(() => cleanup());
after(() => dom.window.close());

function gridContent(api) {
  return createElement('div', { ...api.getRootProps({ 'data-testid': 'grid' }) }, [
    createElement('div', { ...api.getRowProps(), key: 'row' }, api.items.map((item, index) => (
      createElement('div', {
        ...api.getItemProps({ item, index, 'data-testid': `grid-item-${index}` }),
        key: item.id,
      }, item.title ?? item.alt ?? `Item ${index + 1}`)
    ))),
    createElement('button', { ...api.getLoadMoreProps({ 'data-testid': 'load-more' }), key: 'more' }, api.loading ? 'Loading' : 'Load more'),
  ]);
}

test('MediaGrid renders supplied photo and video items through consumer markup', () => {
  render(createElement(MediaGrid, {
    items: [{ id: 1, kind: 'image', title: 'Still' }, { id: 2, kind: 'video', title: 'Clip' }],
    hasMore: true,
    children: gridContent,
  }));

  assert.equal(screen.getByText('Still').getAttribute('data-media-kind'), 'image');
  assert.equal(screen.getByText('Clip').getAttribute('data-media-kind'), 'video');
  assert.equal(screen.getByTestId('grid').getAttribute('role'), 'grid');
});

test('MediaGrid item getter calls onItemClick for click and keyboard activation', () => {
  const item = { id: 4, alt: 'Forest' };
  const onItemClick = (selected) => clicked.push(selected);
  const clicked = [];
  render(createElement(MediaGrid, { items: [item], onItemClick, children: gridContent }));
  const cell = screen.getByTestId('grid-item-0');

  fireEvent.click(cell);
  fireEvent.keyDown(cell, { key: 'Enter' });
  fireEvent.keyDown(cell, { key: ' ' });

  assert.deepEqual(clicked, [item, item, item]);
});

test('MediaGrid exposes loading and hasMore and guards load-more callbacks', () => {
  let calls = 0;
  const onLoadMore = () => { calls += 1; };
  const { rerender } = render(createElement(MediaGrid, { loading: true, hasMore: true, onLoadMore, children: gridContent }));
  const button = screen.getByTestId('load-more');
  assert.equal(screen.getByTestId('grid').getAttribute('aria-busy'), 'true');
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  fireEvent.click(button);
  assert.equal(calls, 0);

  rerender(createElement(MediaGrid, { loading: false, hasMore: true, onLoadMore, children: gridContent }));
  assert.equal(screen.getByTestId('load-more').getAttribute('aria-disabled'), 'false');
  fireEvent.click(screen.getByTestId('load-more'));
  assert.equal(calls, 1);

  rerender(createElement(MediaGrid, { loading: false, hasMore: false, onLoadMore, children: gridContent }));
  fireEvent.click(screen.getByTestId('load-more'));
  assert.equal(calls, 1);
});

function lightboxContent(api) {
  return createElement('section', api.getDialogProps({ 'data-testid': 'dialog' }), [
    createElement('button', { ...api.getCloseButtonProps(), key: 'close' }, 'Close'),
    api.isVideo
      ? createElement('video', { ...api.getVideoProps({ 'data-testid': 'video' }), key: 'media' })
      : createElement('img', { ...api.getImageProps({ 'data-testid': 'image' }), key: 'media' }),
    createElement('button', { type: 'button', key: 'last' }, 'Last action'),
  ]);
}

test('MediaLightbox supports controlled open and close', () => {
  const item = { id: 1, kind: 'image', src: '/photo.jpg', alt: 'Photo' };
  let closes = 0;
  const props = { item, open: true, onClose: () => { closes += 1; }, children: lightboxContent };
  const { rerender } = render(createElement(MediaLightbox, props));
  assert.ok(screen.getByRole('dialog', { name: 'Media viewer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close media viewer' }));
  assert.equal(closes, 1);

  rerender(createElement(MediaLightbox, { ...props, open: false }));
  assert.equal(screen.queryByRole('dialog'), null);
});

test('MediaLightbox handles Escape and restores focus when it closes', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  let closes = 0;
  const { unmount } = render(createElement(MediaLightbox, {
    item: { kind: 'image', src: '/photo.jpg' },
    open: true,
    onClose: () => { closes += 1; },
    children: lightboxContent,
  }));

  assert.equal(document.activeElement, screen.getByTestId('dialog'));
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal(closes, 1);
  unmount();
  assert.equal(document.activeElement, trigger);
  trigger.remove();
});

test('MediaLightbox provides accessible image and video props', () => {
  const photo = { kind: 'image', src: '/photo.jpg', alt: 'Sunset' };
  const { rerender } = render(createElement(MediaLightbox, { item: photo, children: lightboxContent }));
  const dialog = screen.getByRole('dialog', { name: 'Media viewer' });
  const image = screen.getByRole('img', { name: 'Sunset' });
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.equal(dialog.getAttribute('tabindex'), '-1');
  assert.equal(image.getAttribute('src'), '/photo.jpg');

  rerender(createElement(MediaLightbox, {
    item: { kind: 'video', src: '/clip.mp4', title: 'A clip' },
    children: lightboxContent,
  }));
  assert.equal(screen.getByTestId('video').getAttribute('src'), '/clip.mp4');
  assert.equal(screen.getByTestId('video').hasAttribute('controls'), true);
});

test('MediaLightbox keeps keyboard focus within the dialog', () => {
  render(createElement(MediaLightbox, {
    item: { kind: 'image', src: '/photo.jpg' },
    children: lightboxContent,
  }));
  const dialog = screen.getByTestId('dialog');
  const first = screen.getByRole('button', { name: 'Close media viewer' });
  const last = screen.getByRole('button', { name: 'Last action' });
  last.focus();
  fireEvent.keyDown(last, { key: 'Tab' });
  assert.equal(document.activeElement, first);
  first.focus();
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  assert.equal(document.activeElement, last);
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
});

function reelContent(api) {
  return createElement('div', {
    ...api.getScrollerProps({ 'data-testid': 'reel', 'data-active-index': api.activeIndex }),
  }, api.items.map((item, index) => createElement('article', {
    ...api.getSlideProps({ item, index, 'data-testid': `slide-${index}` }),
    key: item.id,
  }, item.label)));
}

test('MediaReelSwiper renders consumer slides and exposes initial active index', () => {
  render(createElement(MediaReelSwiper, {
    items: [{ id: 1, kind: 'image', label: 'Photo' }, { id: 2, kind: 'video', label: 'Video' }],
    children: reelContent,
  }));

  const reel = screen.getByTestId('reel');
  assert.equal(reel.getAttribute('role'), 'region');
  assert.equal(reel.getAttribute('aria-orientation'), 'vertical');
  assert.equal(reel.getAttribute('data-active-index'), '0');
  assert.ok(screen.getByText('Photo'));
  assert.ok(screen.getByText('Video'));
  assert.equal(screen.getByTestId('slide-0').getAttribute('data-active'), 'true');
  assert.equal(screen.getByTestId('slide-1').getAttribute('aria-roledescription'), 'slide');
});

test('MediaReelSwiper detects the centered active slide and calls onActiveChange', async () => {
  const onActiveChange = (index, item) => changes.push({ index, item });
  const changes = [];
  render(createElement(MediaReelSwiper, {
    items: [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }],
    onActiveChange,
    children: reelContent,
  }));
  const reel = screen.getByTestId('reel');
  const first = screen.getByTestId('slide-0');
  const second = screen.getByTestId('slide-1');
  reel.getBoundingClientRect = () => ({ top: 0, height: 300 });
  first.getBoundingClientRect = () => ({ top: -300, height: 300 });
  second.getBoundingClientRect = () => ({ top: 0, height: 300 });

  await act(async () => fireEvent.scroll(reel));

  assert.equal(reel.getAttribute('data-active-index'), '1');
  assert.deepEqual(changes, [{ index: 1, item: { id: 'two', label: 'Two' } }]);
});

test('MediaReelSwiper exposes paging hooks without supplying styles', () => {
  render(createElement(MediaReelSwiper, {
    items: [{ id: 1 }],
    children: (api) => createElement('div', api.getScrollerProps({ 'data-testid': 'reel' }),
      createElement('div', api.getSlideProps({ item: api.items[0], index: 0, 'data-testid': 'slide' })),
    ),
  }));
  assert.equal(screen.getByTestId('reel').getAttribute('data-media-reel-scroller'), '');
  assert.equal(screen.getByTestId('slide').getAttribute('data-media-reel-slide'), '');
  assert.equal(screen.getByTestId('reel').hasAttribute('style'), false);
});
