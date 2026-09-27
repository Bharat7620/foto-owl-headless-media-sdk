import { useCallback, useState } from 'react';
import { MediaReelSwiper } from '@foto-owl/media-ui-react';
import { mediaSrc } from '../utils/media.js';

export default function ReelsView({ items, onClose, onView, onDownload }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const handleActive = useCallback((index, item) => { setActive(index); if (item) onView(item); }, [onView]);
  return <div className="reels-overlay"><header className="reels-header"><button className="icon-button" onClick={onClose} aria-label="Close reels">←</button><span>VIDEO REELS <b>{String(active + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</b></span><button className="icon-button" aria-label={playing ? 'Pause video' : 'Play video'} onClick={() => setPlaying((value) => !value)}>{playing ? 'Ⅱ' : '▶'}</button></header>
    <MediaReelSwiper items={items} activeIndex={active} onActiveChange={handleActive}>{(reel) => <div {...reel.getScrollerProps({ className: 'reel-scroller' })}>{reel.items.map((item, index) => <section key={item.id} {...reel.getSlideProps({ item, index, className: 'reel-slide' })}><video src={mediaSrc(item)} poster={item.image} controls={false} autoPlay={playing && index === active} muted loop playsInline aria-label={item.alt || item.title || `Video ${index + 1}`} onPlay={() => index === active && setPlaying(true)} /><div className="reel-gradient" /><div className="reel-caption"><span className="eyebrow">A MOMENT IN MOTION</span><h2>{item.alt || item.title || `Frame ${index + 1}`}</h2><p>By {item.photographer || 'Pexels creator'}</p><button className="download-button" onClick={() => { const src = mediaSrc(item); onDownload(item); window.open(src, '_blank', 'noopener,noreferrer'); }}>↓ Download video</button></div></section>)}</div>}</MediaReelSwiper>
  </div>;
}
