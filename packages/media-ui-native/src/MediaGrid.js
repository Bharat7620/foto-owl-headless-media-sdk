import { mergeProps } from './utils/props.js';

function getItemLabel(item, index) {
  if (typeof item?.accessibilityLabel === 'string') return item.accessibilityLabel;
  if (typeof item?.alt === 'string') return item.alt;
  if (typeof item?.title === 'string') return item.title;
  return `Media item ${index + 1}`;
}

/**
 * Headless media grid contract for React Native renderers.
 * Render native Views/Pressables in the `children` render function.
 * @param {{ items?: object[], loading?: boolean, hasMore?: boolean, onLoadMore?: () => void, onItemClick?: (item: object, index: number, event: object) => void, accessibilityLabel?: string, children: (api: object) => import('react').ReactNode }} props
 */
export function MediaGrid({
  items = [],
  loading = false,
  hasMore = false,
  onLoadMore = () => {},
  onItemClick = () => {},
  accessibilityLabel = 'Media results',
  children,
}) {
  if (typeof children !== 'function') throw new TypeError('MediaGrid expects children to be a render function.');

  const getRootProps = (props = {}) => mergeProps({
    accessibilityRole: 'grid',
    accessibilityLabel,
    accessibilityState: { busy: loading },
  }, props);
  const getRowProps = (props = {}) => mergeProps({ accessibilityRole: 'group' }, props);
  const getItemProps = ({ item, index, ...props }) => mergeProps({
    accessible: true,
    accessibilityRole: 'button',
    accessibilityLabel: getItemLabel(item, index),
    onPress: (event) => onItemClick(item, index, event),
  }, props);
  const getLoadMoreProps = (props = {}) => {
    const available = hasMore && !loading;
    return mergeProps({
      disabled: !available,
      accessibilityRole: 'button',
      accessibilityLabel: 'Load more media',
      accessibilityState: { disabled: !available, busy: loading },
      onPress: (event) => { if (available) onLoadMore(event); },
    }, props);
  };

  return children({ items, loading, hasMore, onLoadMore, onItemClick, getRootProps, getRowProps, getItemProps, getLoadMoreProps });
}
