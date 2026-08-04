const { IProcessingLogRepository } = require('../../domain/repositories');
const { ProcessingResult } = require('../../domain/entities');
const { ProcessingStatus } = require('../../domain/value-objects');
const admin = require('firebase-admin');

/**
 * Implementación de repositorio de logs de procesamiento usando Firestore
 */
class FirestoreProcessingLogRepository extends IProcessingLogRepository {
  constructor(firestore) {
    super();
    this.db = firestore;
    this.collection = 'processing_logs';
  }

  async save(result) {
    const docRef = await this.db.collection(this.collection).add({
      ...result.toJSON(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  async findByDocumentId(documentId) {
    // Consulta simple sin orderBy para no requerir índice
    const snapshot = await this.db
      .collection(this.collection)
      .where('documentId', '==', documentId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    return new ProcessingResult({
      id: doc.id,
      documentId: data.documentId,
      status: data.status,
      data: data.data,
      errors: data.errors || [],
      warnings: data.warnings || [],
      duration: data.duration,
      attemptCount: data.attemptCount,
      lastAttemptAt: data.lastAttemptAt ? new Date(data.lastAttemptAt) : null,
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      metadata: data.metadata || {},
    });
  }

  async findAll(filters = {}) {
    let query = this.db.collection(this.collection);

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    query = query.orderBy('lastAttemptAt', 'desc');

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return new ProcessingResult({
        id: doc.id,
        ...data,
        lastAttemptAt: data.lastAttemptAt ? new Date(data.lastAttemptAt) : null,
        completedAt: data.completedAt ? new Date(data.completedAt) : null,
      });
    });
  }

  async update(id, updates) {
    await this.db.collection(this.collection).doc(id).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

module.exports = { FirestoreProcessingLogRepository };
