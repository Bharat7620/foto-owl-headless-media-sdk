import { createContext } from 'react';

/** @type {import('react').Context<import('@foto-owl/media-core').MediaClient | null>} */
export const MediaClientContext = createContext(null);
