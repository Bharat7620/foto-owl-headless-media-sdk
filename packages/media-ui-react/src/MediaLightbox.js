import { useCallback, useEffect, useRef } from 'react';
import { getMediaKind, getMediaSource, mergeProps } from './utils/media.js';

function getFocusableElements(container) {
  return [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hasAttribute('hidden'));
}

/**
 * Controlled, headless lightbox behavior for one selected item.
 * Consumers render the dialog, image, or video markup themselves.
 * @param {{ item: object | null, open?: boolean, onClose?: () => void, label?: string, children: (api: object) => React.ReactNode }} props
 */
export function MediaLightbox({ item, open = Boolean(item), onClose = () => {}, label = 'Media viewer', children }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hasItem = Boolean(item);

  if (typeof children !== 'function') {
    throw new TypeError('MediaLightbox expects children to be a render function.');
  }

  const close = useCallback(() => onCloseRef.current(), []);
  const getDialogProps = useCallback((props = {}) => mergeProps({
    role: 'dialog',
    'aria-modal': true,
    'aria-label': label,
    tabIndex: -1,
    'data-media-lightbox': '',
    ref: dialogRef,
  }, props), [label]);
  const getCloseButtonProps = useCallback((props = {}) => mergeProps({
    type: 'button',
    'aria-label': 'Close media viewer',
    onClick: close,
  }, props), [close]);
  const getImageProps = useCallback((props = {}) => mergeProps({
    src: getMediaSource(item),
    alt: typeof item?.alt === 'string' ? item.alt : '',
    'data-media-image': '',
  }, props), [item]);
  const getVideoProps = useCallback((props = {}) => mergeProps({
    src: getMediaSource(item),
    controls: true,
    playsInline: true,
    'aria-label': item?.alt || item?.title || 'Media video',
    'data-media-video': '',
  }, props), [item]);

  useEffect(() => {
    if (!open || !hasItem) return undefined;
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (
        document.activeElement === first
        || document.activeElement === dialogRef.current
        || !dialogRef.current.contains(document.activeElement)
      )) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [open, hasItem, close]);

  if (!open || !item) return null;
  const mediaType = getMediaKind(item) === 'video' ? 'video' : 'image';
  return children({
    item,
    open,
    mediaType,
    isVideo: mediaType === 'video',
    close,
    getDialogProps,
    getCloseButtonProps,
    getImageProps,
    getVideoProps,
  });
}
