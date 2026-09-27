export default function SearchBar({ value, onChange, onSubmit }) {
  return <form className="search-form" role="search" onSubmit={onSubmit}><label className="sr-only" htmlFor="media-search">Search photos and videos</label><span className="search-icon" aria-hidden="true">⌕</span><input id="media-search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search photos, videos, moments…" /><button type="submit">Search <span aria-hidden="true">↗</span></button></form>;
}
