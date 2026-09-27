import { useContext } from 'react';
import { MediaSdkError } from '@foto-owl/media-core';
import { MediaClientContext } from '../media-context.js';

/** Return the media-core client supplied by the nearest MediaNativeProvider. */
export function useMediaClient() {
  const client = useContext(MediaClientContext);
  if (!client) {
    throw new MediaSdkError('useMediaClient must be used inside a <MediaNativeProvider client={client}>.', {
      code: 'MISSING_MEDIA_PROVIDER',
    });
  }
  return client;
}
