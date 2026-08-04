const { IDocumentRepository } = require('../../domain/repositories');
const { Document } = require('../../domain/entities');
const { DocumentId } = require('../../domain/value-objects');
const admin = require('firebase-admin');

/**
 * Implementación de repositorio de documentos usando Firestore
 */
class FirestoreDocumentRepository extends IDocumentRepository {
  constructor(firestore) {
    super();
    this.db = firestore;
    this.collection = 'documents';
  }

  async save(document) {
    const docRef = await this.db.collection(this.collection).add({
      ...document.toJSON(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  async findById(id) {
    const doc = await this.db.collection(this.collection).doc(id).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data();
    return new Document({
      id: doc.id,
      documentId: data.documentId,
      type: data.type,
      filename: data.filename,
      mimeType: data.mimeType,
      size: data.size,
      driveFileId: data.driveFileId,
      driveFilePath: data.driveFilePath,
      status: data.status,
      metadata: data.metadata,
      createdAt: data.createdAt?.toDate(),
    });
  }

  async findByDocumentId(documentId) {
    const idValue = documentId instanceof DocumentId ? documentId.value : documentId;
    
    const snapshot = await this.db
      .collection(this.collection)
      .where('documentId', '==', idValue)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    return new Document({
      id: doc.id,
      documentId: data.documentId,
      type: data.type,
      filename: data.filename,
      mimeType: data.mimeType,
      size: data.size,
      driveFileId: data.driveFileId,
      driveFilePath: data.driveFilePath,
      status: data.status,
      metadata: data.metadata,
      createdAt: data.createdAt?.toDate(),
    });
  }

  async findAll(filters = {}) {
    let query = this.db.collection(this.collection);

    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    query = query.orderBy('createdAt', 'desc');

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return new Document({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
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

module.exports = { FirestoreDocumentRepository };
