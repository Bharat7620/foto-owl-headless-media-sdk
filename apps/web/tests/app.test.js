import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { render, fireEvent, screen, waitFor, cleanup, within } = await import('@testing-library/react');
const { MediaProvider } = await import('@foto-owl/media-react');
const { createMediaEventEmitter } = await import('@foto-owl/media-core');
const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../node_modules/.cache/media-web-tests');
await mkdir(testDir, { recursive: true });
const appBundle = path.join(testDir, 'App.mjs');
await build({ entryPoints: [path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/App.jsx')], outfile: appBundle, bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic', external: ['react', 'react-dom', 'react-dom/client', '@foto-owl/media-react', '@foto-owl/media-ui-react', '@foto-owl/media-core'] });
const { default: App } = await import(pathToFileURL(appBundle).href);

const photo = { id: 101, kind: 'image', mediaType: 'photo', alt: 'Misty forest', src: 'https://images.example/forest.jpg', photographer: 'A. Woods' };
const video = { id: 202, kind: 'video', mediaType: 'video', image: 'https://images.example/coast.jpg', video_files: [{ quality: 'hd', link: 'https://video.example/coast.mp4' }], title: 'Coastline' };
function setup(searchImpl = async (_query, options = {}) => ({
  items: options.type === 'videos' ? [video] : [photo],
  page: options.page ?? 1,
  perPage: options.perPage ?? 24,
  totalResults: 1,
  hasNextPage: true,
})) {
  const client = { events: createMediaEventEmitter({ logger: null }), search: searchImpl, getCurated: async () => ({ items: [] }), getById: async () => photo };
  const view = render(React.createElement(MediaProvider, { client }, React.createElement(App)));
  return { ...view, client };
}
function searchFor(value = 'forest') {
  fireEvent.change(screen.getByLabelText('Search photos and videos'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: /search/i }));
}
test.afterEach(() => cleanup());

test('renders the application shell and discovery state', () => {
  setup();
  assert.ok(screen.getByText('A world of visual stories'));
  assert.ok(screen.getByRole('search'));
});

test('search interaction renders media and opens/closes the lightbox', async () => {
  const { client } = setup();
  searchFor();
  await screen.findByRole('grid');
  const forest = await screen.findByRole('gridcell', { name: 'Misty forest' });
  const gridImage = within(forest).getByRole('img', { name: 'Misty forest' });
  fireEvent.click(gridImage);
  const dialog = await screen.findByRole('dialog', { name: 'Media viewer' });
  assert.ok(dialog);
  const lightbox = within(dialog);
  assert.equal(lightbox.getByRole('img', { name: 'Misty forest' }).getAttribute('src'), photo.src);
  assert.ok(lightbox.getByRole('heading', { name: 'Misty forest' }));
  assert.equal(screen.getByLabelText('Recent media activity').querySelector('b').textContent, '1');
  fireEvent.click(screen.getByRole('button', { name: 'Close media viewer' }));
  await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
  assert.ok(client.events);
});

test('normal search combines photo and video results for the grid and reels', async () => {
  const requestedTypes = [];
  setup(async (_query, options) => {
    requestedTypes.push(options.type);
    return { items: options.type === 'videos' ? [video] : [photo], page: 1, perPage: 24, hasNextPage: false };
  });
  searchFor('car');

  assert.ok(await screen.findByRole('gridcell', { name: 'Misty forest' }));
  assert.ok(await screen.findByRole('gridcell', { name: 'Coastline' }));
  assert.deepEqual(requestedTypes.sort(), ['photos', 'videos']);
  assert.ok(screen.getByRole('button', { name: /open 1 videos in reels/i }));
});

test('video grid result opens the existing video lightbox flow', async () => {
  setup();
  searchFor('car');
  const videoCard = await screen.findByRole('gridcell', { name: 'Coastline' });
  fireEvent.click(videoCard);

  const dialog = await screen.findByRole('dialog', { name: 'Media viewer' });
  assert.equal(within(dialog).getByLabelText('Coastline').tagName, 'VIDEO');
  assert.equal(within(dialog).getByLabelText('Coastline').getAttribute('src'), video.video_files[0].link);
});

test('shows loading while the search request is pending', async () => {
  const pending = [];
  setup((_query, options) => new Promise((resolve) => pending.push({ type: options.type, resolve })));
  searchFor();
  assert.ok(screen.getByRole('status').textContent.includes('Finding your frames'));
  await waitFor(() => assert.equal(pending.length, 2));
  pending.forEach(({ resolve }) => resolve({ items: [], page: 1, perPage: 24, hasNextPage: false }));
  await screen.findByText('No frames found');
});

test('shows an empty state when search has no results', async () => {
  setup(async () => ({ items: [], page: 1, perPage: 24, hasNextPage: false }));
  searchFor('nothing here');
  assert.ok(await screen.findByText('No frames found'));
});

test('shows a useful error state when search fails', async () => {
  setup(async () => { throw new Error('Pexels is unavailable'); });
  searchFor();
  assert.match((await screen.findByRole('alert')).textContent, /Pexels is unavailable/);
});

test('keeps successful video results visible when photo search fails', async () => {
  setup(async (_query, options) => {
    if (options.type === 'photos') throw new Error('Photo search failed');
    return { items: [video], page: 1, perPage: 24, hasNextPage: false };
  });
  searchFor('car');

  assert.ok(await screen.findByRole('gridcell', { name: 'Coastline' }));
  assert.ok(await screen.findByRole('alert'));
  assert.ok(screen.getByText('Photo search failed'));
});

test('load more advances only result streams that still have another page', async () => {
  const requests = [];
  setup(async (_query, options) => {
    requests.push({ type: options.type, page: options.page });
    return {
      items: options.type === 'videos' ? [video] : [photo],
      page: options.page,
      perPage: 24,
      hasNextPage: options.type === 'photos' && options.page === 1,
    };
  });
  searchFor('car');
  await screen.findByRole('gridcell', { name: 'Misty forest' });
  await screen.findByRole('gridcell', { name: 'Coastline' });
  fireEvent.click(screen.getByRole('button', { name: 'Load more frames' }));

  await waitFor(() => assert.deepEqual(requests, [
    { type: 'photos', page: 1 },
    { type: 'videos', page: 1 },
    { type: 'photos', page: 2 },
  ]));
});

test('opens video reels when video results are available', async () => {
  setup();
  searchFor();
  await screen.findByRole('grid');
  fireEvent.click(await screen.findByRole('button', { name: /open 1 videos in reels/i }));
  assert.ok(await screen.findByText('A MOMENT IN MOTION'));
  assert.ok(screen.getByLabelText('Close reels'));
});
