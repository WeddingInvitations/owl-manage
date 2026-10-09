/**
 * Cloud Function para listar las facturas (archivos) de una subcarpeta de Drive
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DIContainer } = require('../../infrastructure/config');

const INVOICE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

/**
 * Comprueba en Firestore qué driveFileId ya han sido procesados (status PROCESSED)
 */
async function findProcessedFileIds(firestore, fileIds) {
  const processed = new Set();
  const chunkSize = 10; // límite de Firestore para el operador 'in'

  for (let i = 0; i < fileIds.length; i += chunkSize) {
    const chunk = fileIds.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;

    const snapshot = await firestore
      .collection('documents')
      .where('driveFileId', 'in', chunk)
      .get();

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.driveFileId && data.status === 'PROCESSED') {
        processed.add(data.driveFileId);
      }
    });
  }

  return processed;
}

/**
 * Lista las facturas (PDF/JPG/PNG/DOCX/DOC) de una subcarpeta de Drive,
 * marcando cuáles ya fueron procesadas previamente.
 */
exports.listInvoiceFiles = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticación requerida');
  }

  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const userRole = userData.role || 'OWNER';

  if (userRole !== 'OWNER') {
    throw new functions.https.HttpsError('permission-denied', 'Solo OWNER puede listar facturas');
  }

  const { folderId } = data;
  if (!folderId) {
    throw new functions.https.HttpsError('invalid-argument', 'folderId es requerido');
  }

  try {
    const firestore = admin.firestore();
    const container = new DIContainer(firestore);
    const driveAdapter = container.factory.createDriveAdapter();

    const files = await driveAdapter.listFiles(folderId, { mimeTypes: INVOICE_MIME_TYPES, limit: 200 });
    const processedIds = await findProcessedFileIds(firestore, files.map((file) => file.id));

    return {
      success: true,
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        createdTime: file.createdTime,
        alreadyProcessed: processedIds.has(file.id),
      })),
    };
  } catch (error) {
    console.error('Error listando facturas:', error);
    throw new functions.https.HttpsError('internal', `Error listando facturas: ${error.message}`);
  }
});
