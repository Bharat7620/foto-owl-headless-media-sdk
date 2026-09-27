import { thumbnailSrc, mediaKind } from '../utils/media.js';

export default function MediaGallery({ grid }) {
  return <div {...grid.getRootProps({ className: 'media-grid' })}>{grid.items.map((item, index) => <button key={`${item.id}-${index}`} {...grid.getItemProps({ item, index, className: 'media-card' })}>
    <span className="media-image-wrap">{thumbnailSrc(item) ? <img src={thumbnailSrc(item)} alt={item.alt || item.title || 'Pexels media'} loading="lazy" /> : <span className="media-placeholder">{mediaKind(item) === 'video' ? '▶' : '✳'}</span>}{mediaKind(item) === 'video' && <span className="video-badge">▶ VIDEO</span>}<span className="card-open" aria-hidden="true">↗</span></span>
    <span className="media-caption"><span>{item.photographer || item.user?.name || item.alt || item.title || 'Untitled frame'}</span><span>{mediaKind(item) === 'video' ? 'VIDEO' : 'PHOTO'}</span></span>
  </button>)}</div>;
}
