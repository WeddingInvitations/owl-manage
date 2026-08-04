const crypto = require('crypto');

/**
 * Value Object para identificar documentos de forma única
 * Genera un hash basado en el contenido del archivo
 */
class DocumentId {
  constructor(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('DocumentId must be a non-empty string');
    }
    this._value = value;
    Object.freeze(this);
  }

  get value() {
    return this._value;
  }

  equals(other) {
    return this._value === other._value;
  }

  toString() {
    return this._value;
  }

  /**
   * Genera un DocumentId a partir del contenido de un archivo
   * Usa como idempotency key
   */
  static fromFileContent(fileBuffer, filename) {
    const hash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .update(filename)
      .digest('hex');
    return new DocumentId(hash);
  }

  /**
   * Genera un DocumentId a partir de un string
   */
  static fromString(str) {
    return new DocumentId(str);
  }
}

module.exports = { DocumentId };
