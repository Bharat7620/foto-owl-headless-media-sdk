import { useCallback } from 'react';
import { mergeProps } from './utils/props.js';

function getSource(item, override) {
  if (override !== undefined) return override;
  if (item?.source !== undefined) return item.source;
  if (typeof item?.uri === 'string') return { uri: item.uri };
  if (typeof item?.src === 'string') return { uri: item.src };
  if (typeof item?.url === 'string') return { uri: item.url };
  return undefined;
}

function isVideo(item) {
  return item?.mediaType === 'video' || item?.kind === 'video' || item?.type === 'video';
}

/**
 * Controlled, headless lightbox contract for a React Native Modal/Image/video renderer.
 * The video view is consumer-supplied because React Native has no built-in video primitive.
 */
export function MediaLightbox({ item, open = Boolean(item), onClose = () => {}, accessibilityLabel = 'Media viewer', children }) {
  if (typeof children !== 'function') throw new TypeError('MediaLightbox expects children to be a render function.');
  const close = useCallback(() => onClose(), [onClose]);
  const getModalProps = (props = {}) => mergeProps({
    visible: Boolean(open && item),
    onRequestClose: close,
    accessibilityViewIsModal: true,
    accessibilityLabel,
  }, props);
  const getCloseButtonProps = (props = {}) => mergeProps({
    accessibilityRole: 'button',
    accessibilityLabel: 'Close media viewer',
    onPress: close,
  }, props);
  const getImageProps = (props = {}) => mergeProps({
    source: getSource(item, props.source),
    accessible: true,
    accessibilityLabel: typeof item?.alt === 'string' ? item.alt : accessibilityLabel,
  }, props);
  const getVideoProps = (props = {}) => mergeProps({
    source: getSource(item, props.source),
    accessible: true,
    accessibilityLabel: item?.accessibilityLabel || item?.title || accessibilityLabel,
  }, props);

  if (!open || !item) return null;
  const video = isVideo(item);
  return children({
    item,
    open,
    isVideo: video,
    mediaType: video ? 'video' : 'image',
    close,
    getModalProps,
    getCloseButtonProps,
    getImageProps,
    getVideoProps,
  });
}
