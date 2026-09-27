export function mergeProps(baseProps, userProps = {}) {
  const merged = { ...baseProps, ...userProps };
  if (baseProps.ref || userProps.ref) {
    merged.ref = (instance) => {
      for (const ref of [baseProps.ref, userProps.ref]) {
        if (typeof ref === 'function') ref(instance);
        else if (ref && typeof ref === 'object') ref.current = instance;
      }
    };
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
