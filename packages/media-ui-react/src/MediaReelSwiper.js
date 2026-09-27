import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMediaKind, mergeProps } from './utils/media.js';

const EMPTY_ITEMS = [];

/**
 * Headless active-item tracking for vertically scrolling, snap-paged media.
 * The consumer supplies the scrolling/snap CSS and all item markup.
 * @param {{ items?: object[], activeIndex?: number, onActiveChange?: (index: number, item: object | undefined) => void, label?: string, children: (api: object) => React.ReactNode }} props
 */
export function MediaReelSwiper({ items = EMPTY_ITEMS, activeIndex: controlledIndex, onActiveChange = () => {}, label = 'Media reel', children }) {
  const [uncontrolledIndex, setUncontrolledIndex] = useState(items.length > 0 ? 0 : -1);
  const scrollerRef = useRef(null);
  const itemNodes = useRef(new Map());
  const lastDetectedIndex = useRef(controlledIndex ?? uncontrolledIndex);
  const isControlled = controlledIndex !== undefined;
  const requestedIndex = isControlled ? controlledIndex : uncontrolledIndex;
  const normalizedIndex = items.length === 0 ? -1 : Math.max(0, Math.min(requestedIndex, items.length - 1));

  if (typeof children !== 'function') {
    throw new TypeError('MediaReelSwiper expects children to be a render function.');
  }

  const updateActiveIndex = useCallback((nextIndex) => {
    if (nextIndex < 0 || nextIndex >= items.length || nextIndex === lastDetectedIndex.current) return;
    lastDetectedIndex.current = nextIndex;
    if (!isControlled) setUncontrolledIndex(nextIndex);
    onActiveChange(nextIndex, items[nextIndex]);
  }, [items, isControlled, onActiveChange]);

  const getScrollerProps = useCallback((props = {}) => mergeProps({
    role: 'region',
    'aria-label': label,
    'aria-orientation': 'vertical',
    tabIndex: 0,
    'data-media-reel-scroller': '',
    ref: (node) => { scrollerRef.current = node; },
    onScroll: () => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const centerY = scrollerRect.top + scrollerRect.height / 2;
      let nearestIndex = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const [index, node] of itemNodes.current) {
        const rect = node.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - centerY);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }
      updateActiveIndex(nearestIndex);
    },
  }, props), [label, updateActiveIndex]);

  const getSlideProps = useCallback(({ item, index, ...props }) => {
    const kind = getMediaKind(item);
    const isActive = index === normalizedIndex;
    const ref = (node) => {
      if (node) itemNodes.current.set(index, node);
      else itemNodes.current.delete(index);
    };
    return mergeProps({
      role: 'group',
      'aria-roledescription': 'slide',
      'aria-label': `${index + 1} of ${items.length}`,
      'aria-current': isActive ? 'true' : undefined,
      'data-media-reel-slide': '',
      'data-active': isActive ? 'true' : 'false',
      'data-media-kind': kind,
      ref,
    }, props);
  }, [items.length, normalizedIndex]);

  useEffect(() => {
    lastDetectedIndex.current = normalizedIndex;
  }, [normalizedIndex]);

  const api = useMemo(() => ({
    items,
    activeIndex: normalizedIndex,
    activeItem: normalizedIndex < 0 ? undefined : items[normalizedIndex],
    onActiveChange,
    getScrollerProps,
    getSlideProps,
  }), [items, normalizedIndex, onActiveChange, getScrollerProps, getSlideProps]);

  return children(api);
}
