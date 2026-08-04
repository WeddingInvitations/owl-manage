/**
 * DTO para resultado de procesamiento
 */
class ProcessingResultDTO {
  constructor(result) {
    this.documentId = result.documentId;
    this.status = result.status.value;
    this.success = result.isSuccessful();
    this.errors = result.errors;
    this.warnings = result.warnings;
    this.data = result.data;
    this.attemptCount = result.attemptCount;
    this.duration = result.duration;
  }

  static fromEntity(result) {
    return new ProcessingResultDTO(result);
  }
}

module.exports = { ProcessingResultDTO };
