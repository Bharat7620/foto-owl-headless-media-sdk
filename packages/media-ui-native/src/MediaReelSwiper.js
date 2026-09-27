import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mergeProps } from './utils/props.js';

const EMPTY_ITEMS = [];

/**
 * Headless vertical reel contract using React Native ScrollView paging props.
 * The consumer renders the scroller and slides using native primitives.
 */
export function MediaReelSwiper({ items = EMPTY_ITEMS, activeIndex: controlledIndex, onActiveChange = () => {}, accessibilityLabel = 'Media reel', children }) {
  const [localIndex, setLocalIndex] = useState(items.length > 0 ? 0 : -1);
  const scrollerRef = useRef(null);
  const pageHeight = useRef(0);
  const lastIndex = useRef(controlledIndex ?? localIndex);
  const isControlled = controlledIndex !== undefined;
  const activeIndex = items.length === 0 ? -1 : Math.max(0, Math.min(isControlled ? controlledIndex : localIndex, items.length - 1));

  if (typeof children !== 'function') throw new TypeError('MediaReelSwiper expects children to be a render function.');

  const updateActiveIndex = useCallback((index) => {
    if (index < 0 || index >= items.length || index === lastIndex.current) return;
    lastIndex.current = index;
    if (!isControlled) setLocalIndex(index);
    onActiveChange(index, items[index]);
  }, [items, isControlled, onActiveChange]);

  const onScrollEnd = useCallback((event) => {
    const nativeEvent = event?.nativeEvent;
    const height = nativeEvent?.layoutMeasurement?.height || pageHeight.current;
    const offset = nativeEvent?.contentOffset?.y;
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(offset)) return;
    pageHeight.current = height;
    updateActiveIndex(Math.round(offset / height));
  }, [updateActiveIndex]);

  const getScrollerProps = useCallback((props = {}) => mergeProps({
    ref: scrollerRef,
    horizontal: false,
    pagingEnabled: true,
    scrollEventThrottle: 16,
    accessibilityLabel,
    accessibilityHint: 'Scroll vertically to change the active media item.',
    onLayout: (event) => {
      const height = event?.nativeEvent?.layout?.height;
      if (Number.isFinite(height) && height > 0) pageHeight.current = height;
    },
    onMomentumScrollEnd: onScrollEnd,
    onScrollEndDrag: onScrollEnd,
  }, props), [accessibilityLabel, onScrollEnd]);

  const getSlideProps = useCallback(({ item, index, ...props }) => mergeProps({
    accessible: true,
    accessibilityLabel: item?.accessibilityLabel || item?.alt || item?.title || `Media item ${index + 1}`,
    accessibilityState: { selected: index === activeIndex },
  }, props), [activeIndex]);

  useEffect(() => {
    lastIndex.current = activeIndex;
  }, [activeIndex]);

  const scrollToIndex = useCallback((index, animated = true) => {
    if (!Number.isInteger(index) || index < 0 || index >= items.length) return;
    const height = pageHeight.current;
    if (height > 0) scrollerRef.current?.scrollTo?.({ y: index * height, animated });
  }, [items.length]);

  const api = useMemo(() => ({
    items,
    activeIndex,
    activeItem: activeIndex < 0 ? undefined : items[activeIndex],
    onActiveChange,
    scrollToIndex,
    getScrollerProps,
    getSlideProps,
  }), [items, activeIndex, onActiveChange, scrollToIndex, getScrollerProps, getSlideProps]);

  return children(api);
}
