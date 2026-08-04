/**
 * Estados de procesamiento
 */
const ProcessingStates = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  RETRY: 'RETRY',
};

module.exports = { ProcessingStates };
