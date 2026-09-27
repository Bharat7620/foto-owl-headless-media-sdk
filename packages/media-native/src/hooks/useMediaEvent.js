import { useEffect } from 'react';
import { useMediaClient } from './useMediaClient.js';

/** Subscribe to a media-core event and unsubscribe automatically on cleanup. */
export function useMediaEvent(event, listener) {
  const client = useMediaClient();
  useEffect(() => {
    if (typeof listener !== 'function') return undefined;
    const unsubscribe = client.events.on(event, listener);
    if (typeof unsubscribe === 'function') return unsubscribe;
    return () => client.events.off(event, listener);
  }, [client, event, listener]);
}

export function useMediaViewEvent(listener) {
  useMediaEvent('view', listener);
}

export function useMediaDownloadEvent(listener) {
  useMediaEvent('download', listener);
}
