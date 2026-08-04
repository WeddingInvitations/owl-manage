const { ProcessingStatus } = require('../value-objects/ProcessingStatus');

/**
 * Entidad que representa el resultado de un procesamiento
 */
class ProcessingResult {
  constructor({
    id = null,
    documentId,
    status,
    data = null,
    errors = [],
    warnings = [],
    duration = 0,
    attemptCount = 0,
    lastAttemptAt = null,
    completedAt = null,
    metadata = {},
  }) {
    this.id = id;
    this.documentId = documentId;
    this.status = status instanceof ProcessingStatus ? status : new ProcessingStatus(status);
    this.data = data;
    this.errors = errors;
    this.warnings = warnings;
    this.duration = duration;
    this.attemptCount = attemptCount;
    this.lastAttemptAt = lastAttemptAt || new Date();
    this.completedAt = completedAt;
    this.metadata = metadata;
  }

  isSuccessful() {
    return this.status.isCompleted() && this.errors.length === 0;
  }

  hasFailed() {
    return this.status.isFailed();
  }

  canRetry() {
    return this.status.canRetry() && this.attemptCount < 3;
  }

  incrementAttempt() {
    this.attemptCount += 1;
    this.lastAttemptAt = new Date();
  }

  markAsCompleted(data) {
    this.status = new ProcessingStatus(ProcessingStatus.COMPLETED);
    this.data = data;
    this.completedAt = new Date();
  }

  markAsFailed(error) {
    this.status = new ProcessingStatus(ProcessingStatus.FAILED);
    this.errors.push({
      message: error.message,
      code: error.code || 'UNKNOWN',
      timestamp: new Date().toISOString(),
    });
  }

  toJSON() {
    return {
      id: this.id,
      documentId: this.documentId,
      status: this.status.value,
      data: this.data,
      errors: this.errors,
      warnings: this.warnings,
      duration: this.duration,
      attemptCount: this.attemptCount,
      lastAttemptAt: this.lastAttemptAt.toISOString(),
      completedAt: this.completedAt ? this.completedAt.toISOString() : null,
      metadata: this.metadata,
    };
  }
}

module.exports = { ProcessingResult };
