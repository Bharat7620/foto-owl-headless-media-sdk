import { useCallback } from 'react';
import { getMediaKind, mergeProps } from './utils/media.js';

/**
 * Headless media grid state and accessible prop getters.
 * Render markup and styles in the `children` render function.
 * @param {{ items?: object[], loading?: boolean, hasMore?: boolean, onLoadMore?: () => void, onItemClick?: (item: object, index: number, event: React.SyntheticEvent) => void, label?: string, children: (api: object) => React.ReactNode }} props
 */
export function MediaGrid({
  items = [],
  loading = false,
  hasMore = false,
  onLoadMore = () => {},
  onItemClick = () => {},
  label = 'Media results',
  children,
}) {
  if (typeof children !== 'function') {
    throw new TypeError('MediaGrid expects children to be a render function.');
  }

  const getRootProps = useCallback((props = {}) => mergeProps({
    role: 'grid',
    'aria-label': label,
    'aria-busy': loading,
    'data-media-grid': '',
  }, props), [label, loading]);

  const getRowProps = useCallback((props = {}) => mergeProps({ role: 'row' }, props), []);

  const getItemProps = useCallback(({ item, index, ...props }) => {
    const kind = getMediaKind(item);
    const labelText = item?.alt || item?.title || `${kind === 'video' ? 'Video' : 'Image'} ${index + 1}`;
    const activate = (event) => onItemClick(item, index, event);
    const onKeyDown = (event) => {
      const tagName = event.currentTarget?.tagName?.toLowerCase();
      const nativeEnterActivation = event.key === 'Enter' && (tagName === 'button' || tagName === 'a');
      const nativeSpaceActivation = event.key === ' ' && tagName === 'button';
      if (nativeEnterActivation || nativeSpaceActivation) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate(event);
      }
    };
    return mergeProps({
      role: 'gridcell',
      tabIndex: 0,
      'aria-label': labelText,
      'aria-colindex': index + 1,
      'data-media-kind': kind,
      onClick: activate,
      onKeyDown,
    }, props);
  }, [onItemClick]);

  const getLoadMoreProps = useCallback((props = {}) => {
    const available = hasMore && !loading;
    const onClick = (event) => {
      if (available) onLoadMore(event);
    };
    return mergeProps({
      type: 'button',
      'aria-label': 'Load more media',
      'aria-disabled': !available,
      'data-load-more': '',
      onClick,
    }, props);
  }, [hasMore, loading, onLoadMore]);

  return children({
    items,
    loading,
    hasMore,
    onLoadMore,
    onItemClick,
    getRootProps,
    getRowProps,
    getItemProps,
    getLoadMoreProps,
  });
}
