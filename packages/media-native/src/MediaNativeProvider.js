import { createElement } from 'react';
import { MediaClientContext } from './media-context.js';

/**
 * Provide an already-configured media-core client to native React descendants.
 * The adapter does not configure the client or implement data operations.
 * @param {{ client: import('@foto-owl/media-core').MediaClient, children?: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function MediaNativeProvider({ client, children }) {
  if (!client) throw new Error('MediaNativeProvider requires a configured media-core client in its "client" prop.');
  return createElement(MediaClientContext.Provider, { value: client }, children);
}
