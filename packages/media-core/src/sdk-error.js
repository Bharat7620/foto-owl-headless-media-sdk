/** Error raised when a media-core operation cannot complete. */
export class MediaSdkError extends Error {
  /**
   * @param {string} message Safe, user-readable description of the failure.
   * @param {{ code?: string, status?: number }} [options]
   */
  constructor(message, { code = 'MEDIA_SDK_ERROR', status } = {}) {
    super(message);
    this.name = 'MediaSdkError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}
