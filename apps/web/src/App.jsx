import { useCallback, useMemo, useRef, useState } from 'react';
import { useMediaClient, useMediaSearch, useMediaViewEvent, useMediaDownloadEvent } from '@foto-owl/media-react';
import { MediaGrid, MediaLightbox } from '@foto-owl/media-ui-react';
import SearchBar from './components/SearchBar.jsx';
import MediaGallery from './components/MediaGallery.jsx';
import MediaLightboxView from './components/MediaLightboxView.jsx';
import ReelsView from './components/ReelsView.jsx';
import ActivityIndicator from './components/ActivityIndicator.jsx';
import { mediaSrc, mediaKind } from './utils/media.js';

export default function App() {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [showReels, setShowReels] = useState(false);
  const [photoResults, setPhotoResults] = useState([]);
  const [videoResults, setVideoResults] = useState([]);
  const [photoPage, setPhotoPage] = useState(1);
  const [videoPage, setVideoPage] = useState(1);
  const [activity, setActivity] = useState([]);
  const photoSearch = useMediaSearch({ perPage: 24, type: 'photos' });
  const videoSearch = useMediaSearch({ perPage: 24, type: 'videos' });
  const client = useMediaClient();
  const items = useMemo(() => [...photoResults, ...videoResults], [photoResults, videoResults]);
  const videoItems = useMemo(() => items.filter((item) => mediaKind(item) === 'video'), [items]);
  const searchRun = useRef(0);
  const loading = photoSearch.loading || videoSearch.loading;
  const hasMore = photoSearch.pagination.hasNextPage || videoSearch.pagination.hasNextPage;
  const searchErrors = [photoSearch.error, videoSearch.error].filter(Boolean);

  const startSearch = useCallback((value) => {
    const nextQuery = value.trim();
    if (!nextQuery) return;
    const run = ++searchRun.current;
    setTerm(nextQuery);
    setQuery(nextQuery);
    setPhotoResults([]);
    setVideoResults([]);
    setPhotoPage(1);
    setVideoPage(1);
    void photoSearch.search(nextQuery, { page: 1 }).then((response) => {
      if (run === searchRun.current && response?.items) setPhotoResults(response.items);
    });
    void videoSearch.search(nextQuery, { page: 1 }).then((response) => {
      if (run === searchRun.current && response?.items) setVideoResults(response.items);
    });
  }, [photoSearch.search, videoSearch.search]);

  const addActivity = useCallback((type, payload) => {
    const label = payload?.media?.alt || payload?.media?.title || `Media ${payload?.media?.id ?? ''}`;
    setActivity((current) => [{ id: `${Date.now()}-${Math.random()}`, type, label }, ...current].slice(0, 4));
    console.info(`[media ${type}]`, payload);
  }, []);
  useMediaViewEvent(useCallback((payload) => addActivity('view', payload), [addActivity]));
  useMediaDownloadEvent(useCallback((payload) => addActivity('download', payload), [addActivity]));

  const submitSearch = (event) => {
    event?.preventDefault();
    startSearch(term);
  };
  const loadMore = async () => {
    if (!query || loading) return;
    const run = searchRun.current;
    const requests = [];
    if (photoSearch.pagination.hasNextPage) {
      const page = photoPage + 1;
      requests.push(photoSearch.search(query, { page }).then((response) => {
        if (run === searchRun.current && response?.items) {
          setPhotoResults((current) => appendUnique(current, response.items));
          setPhotoPage(page);
        }
      }));
    }
    if (videoSearch.pagination.hasNextPage) {
      const page = videoPage + 1;
      requests.push(videoSearch.search(query, { page }).then((response) => {
        if (run === searchRun.current && response?.items) {
          setVideoResults((current) => appendUnique(current, response.items));
          setVideoPage(page);
        }
      }));
    }
    await Promise.all(requests);
  };
  const eventPayload = (media, source) => ({ mediaId: media.id, mediaType: media.mediaType || (media.kind === 'video' ? 'video' : 'photo'), url: mediaSrc(media), source, metadata: { title: media.alt || media.title || '' } });
  const trackView = (media, source = 'grid') => client.events.emit('view', eventPayload(media, source));
  const trackDownload = (media) => client.events.emit('download', eventPayload(media, 'download'));

  return <main className="app-shell">
    <header className="topbar"><a className="wordmark" href="#top" aria-label="Foto Owl home"><span className="brand-mark">◉</span> foto<span>owl</span></a><div className="topbar-note">A little inspiration, in every frame</div><ActivityIndicator events={activity} /></header>
    <section className="hero" id="top">
      <div className="hero-copy"><span className="eyebrow">THE VISUAL LIBRARY</span><h1>Find a frame<br /><em>that moves you.</em></h1><p>Explore beautiful photography and video, curated for your next idea.</p></div>
      <SearchBar value={term} onChange={setTerm} onSubmit={submitSearch} />
      {!query && <div className="suggestions">Try <button onClick={() => startSearch('architecture')}>architecture</button><button onClick={() => startSearch('ocean')}>ocean</button><button onClick={() => startSearch('portrait')}>portrait</button></div>}
    </section>
    <section className="results-section" aria-live="polite">
      <div className="section-heading"><div><span className="eyebrow">{query ? 'SEARCH RESULTS' : 'DISCOVER'}</span><h2>{query ? <>Explore <span>“{query}”</span></> : 'A world of visual stories'}</h2></div>{videoItems.length > 0 && <button className="reels-launch" onClick={() => setShowReels(true)} aria-label={`Open ${videoItems.length} videos in reels`}>▶ <span>Watch reels</span><b>{videoItems.length}</b></button>}</div>
      {searchErrors.length > 0 && <div className="notice error-notice" role="alert"><strong>{searchErrors.length === 2 ? 'Search could not load all results.' : 'Some results could not be loaded.'}</strong><span>{searchErrors.map((error) => error.message || 'Please try again in a moment.').join(' ')}</span><button onClick={() => startSearch(query)}>Try again</button></div>}
      {!query && !loading && <div className="welcome-card"><div className="welcome-orbit">✳</div><div><h3>Your next idea starts here.</h3><p>Search millions of photos and videos to find just the right feeling.</p></div></div>}
      {query && !loading && searchErrors.length === 0 && items.length === 0 && <div className="empty-state"><span>⌕</span><h3>No frames found</h3><p>Try a different phrase or search for something broader.</p></div>}
      <MediaGrid items={items} loading={loading} hasMore={hasMore} onLoadMore={loadMore} onItemClick={(item) => { setSelected(item); trackView(item); }}>
        {(grid) => <MediaGallery grid={grid} />}
      </MediaGrid>
      {loading && items.length === 0 && <div className="loading-state" role="status"><span className="spinner" />Finding your frames…</div>}
      {query && items.length > 0 && <button className="load-more" disabled={!hasMore || loading} onClick={loadMore}>{loading ? 'Loading…' : hasMore ? 'Load more frames' : 'You’re all caught up'}</button>}
    </section>
    <footer><span>Made for curious eyes.</span><span>Images and videos provided by Pexels</span></footer>
    <MediaLightbox item={selected} open={Boolean(selected)} onClose={() => setSelected(null)}>
      {(api) => <MediaLightboxView api={api} item={selected} onDownload={trackDownload} />}
    </MediaLightbox>
    {showReels && <ReelsView items={videoItems} onClose={() => setShowReels(false)} onView={(item) => trackView(item, 'reels')} onDownload={trackDownload} />}
  </main>;
}

function appendUnique(existing, incoming) {
  const seen = new Set(existing.map((item) => `${item.mediaType || item.kind}:${item.id}`));
  return [...existing, ...incoming.filter((item) => {
    const key = `${item.mediaType || item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}
