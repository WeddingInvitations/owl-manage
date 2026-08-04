const { DomainError } = require('./DomainError');

/**
 * Error de procesamiento de documento
 */
class DocumentProcessingError extends DomainError {
  constructor(message, subtype = 'PROCESSING', metadata = {}) {
    super(message, `DOCUMENT_${subtype}_ERROR`, metadata);
  }
}

/**
 * Error al extraer documento del origen
 */
class ExtractionError extends DocumentProcessingError {
  constructor(message, metadata = {}) {
    super(message, 'EXTRACTION', metadata);
  }
}

/**
 * Error al parsear documento con IA
 */
class ParsingError extends DocumentProcessingError {
  constructor(message, metadata = {}) {
    super(message, 'PARSING', metadata);
  }
}

/**
 * Error al almacenar documento
 */
class StorageError extends DocumentProcessingError {
  constructor(message, metadata = {}) {
    super(message, 'STORAGE', metadata);
  }
}

module.exports = {
  DocumentProcessingError,
  ExtractionError,
  ParsingError,
  StorageError,
};
