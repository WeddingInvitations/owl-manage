const { processInvoice } = require('./processInvoice');
const { processInvoicesWeekly } = require('./processInvoicesWeekly');
const { processFolderInvoices } = require('./processFolderInvoices');
const { getInvoicesByPeriod } = require('./getInvoicesByPeriod');
const { listInvoiceFolders } = require('./listInvoiceFolders');

module.exports = {
  processInvoice,
  processInvoicesWeekly,
  processFolderInvoices,
  getInvoicesByPeriod,
  listInvoiceFolders,
};
