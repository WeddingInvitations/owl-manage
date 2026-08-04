const { IInvoiceRepository } = require('../../domain/repositories');
const { Invoice } = require('../../domain/entities');
const admin = require('firebase-admin');

/**
 * Implementación de repositorio de facturas usando Firestore
 */
class FirestoreInvoiceRepository extends IInvoiceRepository {
  constructor(firestore) {
    super();
    this.db = firestore;
    this.invoicesCollection = 'invoices';
    this.expensesCollection = 'expenses';
  }

  async save(invoice) {
    const docRef = await this.db.collection(this.invoicesCollection).add({
      ...invoice.toJSON(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  async findById(id) {
    const doc = await this.db.collection(this.invoicesCollection).doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return Invoice.fromJSON({ id: doc.id, ...doc.data() });
  }

  async findByNumber(number) {
    const snapshot = await this.db
      .collection(this.invoicesCollection)
      .where('number', '==', number)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return Invoice.fromJSON({ id: doc.id, ...doc.data() });
  }

  async findAll(filters = {}) {
    let query = this.db.collection(this.invoicesCollection);

    if (filters.startDate) {
      query = query.where('issueDate', '>=', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.where('issueDate', '<=', filters.endDate.toISOString());
    }

    if (filters.supplier) {
      query = query.where('supplierName', '==', filters.supplier);
    }

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    query = query.orderBy('issueDate', 'desc');

    const snapshot = await query.get();
    return snapshot.docs.map(doc => 
      Invoice.fromJSON({ id: doc.id, ...doc.data() })
    );
  }

  async saveAsExpense(expense, userId) {
    const docRef = await this.db.collection(this.expensesCollection).add({
      concept: expense.concept,
      amount: expense.amount,
      date: expense.date,
      invoiceNumber: expense.invoiceNumber || null,
      supplier: expense.supplier || null,
      supplierTaxId: expense.supplierTaxId || null,
      category: expense.category || 'GENERAL',
      notes: expense.notes || null,
      driveFileId: expense.driveFileId || null,
      driveFileName: expense.driveFileName || null,
      processedByAI: expense.processedByAI || false,
      invoiceData: expense.invoiceData || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userId || null,
    });
    return docRef.id;
  }

  async update(id, updates) {
    await this.db.collection(this.invoicesCollection).doc(id).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

module.exports = { FirestoreInvoiceRepository };
