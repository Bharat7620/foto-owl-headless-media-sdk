import { createElement } from 'react';
import { MediaClientContext } from './media-context.js';

/**
 * Makes an already-configured media-core client available to descendant hooks.
 * The provider does not create or configure the client.
 * @param {{ client: import('@foto-owl/media-core').MediaClient, children?: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function MediaProvider({ client, children }) {
  if (!client) {
    throw new Error('MediaProvider requires a configured media-core client in its "client" prop.');
  }
  return createElement(MediaClientContext.Provider, { value: client }, children);
}
