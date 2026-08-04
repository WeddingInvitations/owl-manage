const {
  DomainError,
  InvoiceValidationError,
  DocumentProcessingError,
  ExtractionError,
  ParsingError,
  StorageError,
} = require('../../domain/errors');

/**
 * Manejador centralizado de errores
 * Clasifica errores y genera respuestas apropiadas
 */
class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Maneja un error y retorna una respuesta formateada
   */
  handle(error, context = {}) {
    this.logger.error('Error capturado', {
      ...context,
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      stack: error.stack,
    });

    // Clasificar error
    const errorResponse = this._classifyError(error);

    return errorResponse;
  }

  _classifyError(error) {
    // Errores de dominio
    if (error instanceof InvoiceValidationError) {
      return {
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: error.message,
          code: error.code,
          details: error.validationErrors,
        },
        httpStatus: 400,
      };
    }

    if (error instanceof ExtractionError) {
      return {
        success: false,
        error: {
          type: 'EXTRACTION_ERROR',
          message: 'Error extrayendo documento de Drive',
          code: error.code,
          details: error.metadata,
        },
        httpStatus: 502,
      };
    }

    if (error instanceof ParsingError) {
      return {
        success: false,
        error: {
          type: 'PARSING_ERROR',
          message: 'Error procesando documento con IA',
          code: error.code,
          details: error.metadata,
        },
        httpStatus: 502,
      };
    }

    if (error instanceof StorageError) {
      return {
        success: false,
        error: {
          type: 'STORAGE_ERROR',
          message: 'Error almacenando archivo',
          code: error.code,
          details: error.metadata,
        },
        httpStatus: 500,
      };
    }

    if (error instanceof DomainError) {
      return {
        success: false,
        error: {
          type: 'DOMAIN_ERROR',
          message: error.message,
          code: error.code,
          details: error.metadata,
        },
        httpStatus: 400,
      };
    }

    // Errores de Firebase
    if (error.code && error.code.startsWith('permission-denied')) {
      return {
        success: false,
        error: {
          type: 'PERMISSION_ERROR',
          message: 'Permisos insuficientes',
          code: 'PERMISSION_DENIED',
        },
        httpStatus: 403,
      };
    }

    // Error genérico
    return {
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      httpStatus: 500,
    };
  }

  /**
   * Convierte error en HttpsError de Firebase
   */
  toHttpsError(error) {
    const { functions } = require('firebase-functions');
    const errorResponse = this._classifyError(error);
    
    const codeMap = {
      400: 'invalid-argument',
      403: 'permission-denied',
      500: 'internal',
      502: 'unavailable',
    };

    const code = codeMap[errorResponse.httpStatus] || 'unknown';
    
    return new functions.https.HttpsError(
      code,
      errorResponse.error.message,
      errorResponse.error.details
    );
  }
}

module.exports = { ErrorHandler };
