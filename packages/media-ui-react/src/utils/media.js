/** Return the generic media kind represented by an item, if it is known. */
export function getMediaKind(item) {
  if (item?.mediaType === 'video' || item?.kind === 'video' || item?.type === 'video') return 'video';
  if (item?.mediaType === 'photo' || item?.kind === 'image' || item?.type === 'photo') return 'image';
  return undefined;
}

/** Read a conventional direct media URL without depending on a data provider. */
export function getMediaSource(item) {
  if (typeof item?.src === 'string') return item.src;
  if (typeof item?.url === 'string') return item.url;
  return undefined;
}

export function mergeProps(baseProps, userProps = {}) {
  const merged = { ...baseProps, ...userProps };
  if (baseProps.ref || userProps.ref) {
    merged.ref = mergeRefs(baseProps.ref, userProps.ref);
  }
  for (const key of Object.keys(baseProps)) {
    if (key.startsWith('on') && typeof baseProps[key] === 'function' && typeof userProps[key] === 'function') {
      merged[key] = (...args) => {
        baseProps[key](...args);
        userProps[key](...args);
      };
    }
  }
  return merged;
}

export function mergeRefs(...refs) {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref && typeof ref === 'object') ref.current = node;
    }
  };
}
