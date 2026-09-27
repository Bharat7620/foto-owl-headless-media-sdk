import { mediaKind, mediaSrc } from '../utils/media.js';

export default function MediaLightboxView({ api, item, onDownload }) {
  const src = mediaSrc(item);
  return <div className="lightbox-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) api.close(); }}><div {...api.getDialogProps({ className: 'lightbox-dialog' })}>
    <button {...api.getCloseButtonProps({ className: 'icon-button lightbox-close' })}>×</button>
    <div className="lightbox-media">{mediaKind(item) === 'video' ? <video {...api.getVideoProps({ src, className: 'lightbox-video', autoPlay: true })} /> : <img {...api.getImageProps({ src, className: 'lightbox-image' })} />}</div>
    <div className="lightbox-meta"><div><span className="eyebrow">{mediaKind(item) === 'video' ? 'MOTION' : 'PHOTOGRAPHY'}</span><h2>{item.alt || item.title || 'A moment worth keeping'}</h2><p>By {item.photographer || item.user?.name || 'Pexels creator'}</p></div><button className="download-button" onClick={() => { if (!src) return; onDownload(item); const link = document.createElement('a'); link.href = src; link.download = `fotoowl-${item.id || 'media'}`; link.target = '_blank'; link.rel = 'noreferrer'; document.body.appendChild(link); link.click(); link.remove(); }}>↓ <span>Download</span></button></div>
  </div></div>;
}
