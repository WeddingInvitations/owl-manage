/**
 * Value Object para el estado de procesamiento
 */
class ProcessingStatus {
  static PENDING = 'PENDING';
  static PROCESSING = 'PROCESSING';
  static COMPLETED = 'COMPLETED';
  static FAILED = 'FAILED';
  static RETRY = 'RETRY';

  constructor(status) {
    const validStatuses = [
      ProcessingStatus.PENDING,
      ProcessingStatus.PROCESSING,
      ProcessingStatus.COMPLETED,
      ProcessingStatus.FAILED,
      ProcessingStatus.RETRY,
    ];

    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    this._status = status;
    Object.freeze(this);
  }

  get value() {
    return this._status;
  }

  isPending() {
    return this._status === ProcessingStatus.PENDING;
  }

  isProcessing() {
    return this._status === ProcessingStatus.PROCESSING;
  }

  isCompleted() {
    return this._status === ProcessingStatus.COMPLETED;
  }

  isFailed() {
    return this._status === ProcessingStatus.FAILED;
  }

  canRetry() {
    return this._status === ProcessingStatus.FAILED || this._status === ProcessingStatus.RETRY;
  }

  equals(other) {
    return this._status === other._status;
  }

  toString() {
    return this._status;
  }
}

module.exports = { ProcessingStatus };
