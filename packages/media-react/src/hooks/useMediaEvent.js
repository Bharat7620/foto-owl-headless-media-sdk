import { useEffect } from 'react';
import { useMediaClient } from './useMediaClient.js';

/** Subscribe to one media-core event and automatically unsubscribe on cleanup. */
export function useMediaEvent(event, listener) {
  const client = useMediaClient();

  useEffect(() => {
    if (typeof listener !== 'function') return undefined;
    const unsubscribe = client.events.on(event, listener);
    if (typeof unsubscribe === 'function') return unsubscribe;
    return () => client.events.off(event, listener);
  }, [client, event, listener]);
}

/** Subscribe to view events from the configured media-core client. */
export function useMediaViewEvent(listener) {
  useMediaEvent('view', listener);
}

/** Subscribe to download events from the configured media-core client. */
export function useMediaDownloadEvent(listener) {
  useMediaEvent('download', listener);
}
