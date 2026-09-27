const SUPPORTED_EVENTS = new Set(['view', 'download']);

/** @typedef {'view' | 'download'} MediaEventName */

/**
 * @typedef {object} MediaEventPayload
 * @property {string | number} mediaId Pexels media identifier.
 * @property {'photo' | 'video'} mediaType Kind of Pexels resource.
 * @property {string} [url] Relevant media URL, such as a download URL.
 * @property {string} [source] Optional application context for the event.
 * @property {Record<string, unknown>} [metadata] Additional app-owned context.
 */

/** Framework-agnostic emitter for media view and download events. */
export class MediaEventEmitter {
  #listeners = new Map();

  /**
   * Installs the default console listener for both supported event types.
   * @param {{ logger?: Pick<Console, 'info'> | null }} [options]
   */
  constructor({ logger = console } = {}) {
    this.logger = logger;
    if (logger) {
      this.on('view', (payload) => logger.info('[media-core] view', payload));
      this.on('download', (payload) => logger.info('[media-core] download', payload));
    }
  }

  /**
   * Subscribe to an event. The returned function removes this subscription.
   * @param {MediaEventName} event
   * @param {(payload: MediaEventPayload) => void} listener
   * @returns {() => void} Unsubscribe function.
   */
  on(event, listener) {
    this.#assertEvent(event);
    if (typeof listener !== 'function') throw new TypeError('Event listener must be a function.');
    const listeners = this.#listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(event, listeners);
    return () => this.off(event, listener);
  }

  /** Remove a previously registered event listener. */
  off(event, listener) {
    this.#assertEvent(event);
    const listeners = this.#listeners.get(event);
    listeners?.delete(listener);
    if (listeners?.size === 0) this.#listeners.delete(event);
  }

  /** Notify current listeners with a media event payload. */
  emit(event, payload) {
    this.#assertEvent(event);
    if (!payload || typeof payload !== 'object' || !('mediaId' in payload)) {
      throw new TypeError('Media event payload must include mediaId.');
    }
    const listeners = this.#listeners.get(event);
    if (!listeners) return;
    for (const listener of [...listeners]) listener(payload);
  }

  #assertEvent(event) {
    if (!SUPPORTED_EVENTS.has(event)) throw new TypeError(`Unsupported media event: ${String(event)}.`);
  }
}

/** Create a fresh emitter with the default console listeners installed. */
export function createMediaEventEmitter(options) {
  return new MediaEventEmitter(options);
}
