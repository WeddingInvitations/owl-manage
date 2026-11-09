const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DIContainer } = require('../../infrastructure/config');

/**
 * Cloud Function HTTP Callable
 * Obtiene facturas de un periodo
 * 
 * Uso:
 * const result = await getInvoicesByPeriod({ 
 *   startDate: '2024-01-01', 
 *   endDate: '2024-12-31' 
 * });
 */
exports.getInvoicesByPeriod = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticación requerida');
  }

  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  const userRole = userDoc.exists ? userDoc.data()?.role : 'PENDING';
  if (userRole !== 'OWNER') {
    throw new functions.https.HttpsError('permission-denied', 'Solo OWNER puede consultar facturas');
  }

  // Validar entrada
  const { startDate, endDate, supplier, status } = data;
  if (!startDate || !endDate) {
    throw new functions.https.HttpsError(
      'invalid-argument', 
      'startDate y endDate son requeridos'
    );
  }

  // Ejecutar caso de uso
  const container = new DIContainer(admin.firestore());
  const useCase = container.getGetInvoicesByPeriodUseCase();
  const errorHandler = container.getErrorHandler();

  try {
    const result = await useCase.execute({
      startDate,
      endDate,
      supplier,
      status,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    throw errorHandler.toHttpsError(error);
  }
});
