const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ProcessNewInvoice } = require('./ProcessNewInvoice');

function createProcessor(issueDate, folderName = null) {
  const saved = { invoice: null, expense: null };
  const processor = new ProcessNewInvoice({
    documentExtractor: {
      downloadFile: async () => Buffer.from('test invoice'),
      getFileMetadata: async () => ({ name: 'invoice.pdf', mimeType: 'application/pdf', size: 12, path: folderName ? 'folder-id' : null }),
      getFolderMetadata: async () => ({ name: folderName }),
    },
    documentParser: {
      parseInvoice: async () => ({
        number: 'INV-001', issueDate, dueDate: null, supplierName: 'Proveedor',
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 10, taxRate: 0, total: 10 }],
        subtotal: 10, taxAmount: 0, total: 10,
      }),
    },
    invoiceRepository: {
      findByNumber: async () => null,
      save: async (invoice) => { saved.invoice = invoice; return 'invoice-id'; },
      saveAsExpense: async (expense) => { saved.expense = expense; return 'expense-id'; },
    },
    documentRepository: { save: async () => 'document-id', update: async () => {} },
    processingLogRepository: { save: async () => {} },
    idempotencyService: { check: async () => null, store: async () => {} },
    logger: { info() {}, warn() {}, error() {} },
  });
  return { processor, saved };
}

test('sin fecha de factura, asigna fecha genérica del mes de la carpeta', async () => {
  const { processor, saved } = createProcessor(null);
  const result = await processor.execute({ driveFileId: 'file', userId: 'owner', expenseMonth: '2026-09' });
  assert.equal(result.success, true);
  assert.equal(saved.invoice.issueDate.toISOString().slice(0, 10), '2026-09-01');
  assert.equal(saved.expense.date, '2026-09-01');
});

test('fecha inválida: usa el mes de la carpeta, no la fecha de la factura', async () => {
  const { processor, saved } = createProcessor('fecha ilegible');
  await processor.execute({ driveFileId: 'file', expenseMonth: '2026-09' });
  assert.equal(saved.expense.date, '2026-09-01');
});

test('fecha válida: la conserva en la factura pero contabiliza en el mes de la carpeta', async () => {
  const { processor, saved } = createProcessor('2026-08-22');
  await processor.execute({ driveFileId: 'file', expenseMonth: '2026-09' });
  assert.equal(saved.invoice.issueDate.toISOString().slice(0, 10), '2026-08-22');
  assert.equal(saved.expense.date, '2026-09-01');
});

test('sin fecha ni mes de carpeta no crea una factura con fecha inventada', async () => {
  const { processor, saved } = createProcessor(null);
  await assert.rejects(processor.execute({ driveFileId: 'file' }), /Los datos extraídos no son válidos/);
  assert.equal(saved.invoice, null);
  assert.equal(saved.expense, null);
});

test('sin fecha ni selector, deduce el mes de la carpeta de Drive sin importar mayúsculas', async () => {
  const { processor, saved } = createProcessor(null, 'Facturas septiembre 2026');
  await processor.execute({ driveFileId: 'file' });
  assert.equal(saved.invoice.issueDate.toISOString().slice(0, 10), '2026-09-01');
  assert.equal(saved.expense.date, '2026-09-01');
});

test('la carpeta prevalece sobre un mes de selector diferente', async () => {
  const { processor, saved } = createProcessor('2026-08-20', 'SETIEMBRE 2026');
  await processor.execute({ driveFileId: 'file', expenseMonth: '2026-08' });
  assert.equal(saved.expense.date, '2026-09-01');
});