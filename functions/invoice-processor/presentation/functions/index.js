const { processInvoice } = require('./processInvoice');
const { processInvoicesWeekly } = require('./processInvoicesWeekly');
const { processFolderInvoices } = require('./processFolderInvoices');
const { getInvoicesByPeriod } = require('./getInvoicesByPeriod');

module.exports = {
  processInvoice,
  processInvoicesWeekly,
  processFolderInvoices,
  getInvoicesByPeriod,
};
