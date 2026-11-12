// Stored price already includes discounts. Multi-month plans are collected once.
export function programIncomeTotals(acroKidsRecords, nestRecords) {
  const categories = new Map();
  const add = (record, concept) => {
    if (!record.paid || (Number(record.durationMonths) > 1 && record.isPaymentMonth !== true)) return;
    const amount = Number(record.price || 0);
    if (!Number.isFinite(amount) || !amount) return;
    if (!categories.has(concept)) categories.set(concept, new Map());
    const totals = categories.get(concept);
    const month = record.month || 'sin-fecha';
    totals.set(month, (totals.get(month) || 0) + amount);
  };
  acroKidsRecords.forEach((record) => add(record, 'Cuotas Acrokids (total)'));
  nestRecords.forEach((record) => {
    const tariff = String(record.tariff || record.tarifa || record.plan || record.idTarifa || '').toLowerCase();
    const family = record.family || (tariff.includes('barre') ? 'barre' : tariff.includes('reformer') ? 'pilates' : '');
    const concept = family === 'barre' ? 'Cuotas The Nest Barre (total)'
      : family === 'pilates' ? 'Cuotas The Nest Pilates (total)' : 'Cuotas The Nest (total)';
    add(record, concept);
  });
  return Array.from(categories, ([concept, totals]) => Array.from(totals, ([month, amount]) => ({ concept, month, amount }))).flat();
}