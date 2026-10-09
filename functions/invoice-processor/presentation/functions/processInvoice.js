const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DIContainer } = require('../../infrastructure/config');

/**
 * Cloud Function HTTP Callable
 * Procesa una factura individual desde Drive
 * 
 * Uso:
 * const result = await processInvoice({ driveFileId: 'xxx' });
 */
exports.processInvoice = functions
  .runWith({
    timeoutSeconds: 300, // 5 minutos
    memory: '512MB',
  })
  .https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticación requerida');
  }

  // Verificar permisos (solo OWNER)
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(context.auth.uid)
    .get();

  const userData = userDoc.exists ? userDoc.data() : {};
  const userRole = userData.role || 'OWNER';

  if (userRole !== 'OWNER') {
    throw new functions.https.HttpsError('permission-denied', 'Solo OWNER puede procesar facturas');
  }

  // Validar entrada
  const { driveFileId, force, expenseMonth } = data;
  if (!driveFileId) {
    throw new functions.https.HttpsError('invalid-argument', 'driveFileId es requerido');
  }
  if (expenseMonth != null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(expenseMonth)) {
    throw new functions.https.HttpsError('invalid-argument', 'expenseMonth debe tener formato YYYY-MM');
  }

  // Inicializar contenedor de dependencias
  const container = new DIContainer(admin.firestore());
  const useCase = container.getProcessNewInvoiceUseCase();
  const errorHandler = container.getErrorHandler();

  try {
    const result = await useCase.execute({
      driveFileId,
      userId: context.auth.uid,
      force: Boolean(force),
      expenseMonth: expenseMonth || null,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    throw errorHandler.toHttpsError(error);
  }
});
