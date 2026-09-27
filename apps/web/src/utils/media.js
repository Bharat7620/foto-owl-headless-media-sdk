export function mediaKind(item) { return item?.kind === 'video' || item?.mediaType === 'video' ? 'video' : 'photo'; }
export function mediaSrc(item) {
  if (typeof item?.src === 'string') return item.src;
  if (mediaKind(item) === 'video') {
    const videoSources = [item?.video_files?.find((file) => file.quality === 'hd')?.link, item?.video_files?.[0]?.link];
    return videoSources.find((source) => typeof source === 'string' && source.length > 0) ?? null;
  }
  const photoSources = [item?.src?.large2x, item?.src?.large, item?.src?.medium, item?.src?.original];
  return photoSources.find((source) => typeof source === 'string' && source.length > 0) ?? null;
}
export function thumbnailSrc(item) {
  if (typeof item?.src === 'string') return item.src;
  if (mediaKind(item) === 'video') return item?.image || item?.video_pictures?.[0]?.picture || '';
  return item?.src?.medium || item?.src?.large || '';
}
