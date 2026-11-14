export const discountReasonOptions = [
  ['ALL', 'Todos'],
  ['Ninguno', 'Ninguno'],
  ['promoApertura', 'Promo apertura'],
  ['Familiar', 'Familiar'],
  ['Funcionario', 'Funcionario'],
  ['Mañanas', 'Mañanas'],
  ['Amigo', 'Amigo'],
  ['Otro', 'Otro'],
];

export function matchesDiscountReason(reason, selected = 'ALL') {
  if (selected === 'ALL') return true;
  const actual = String(reason ?? '').trim() || 'Ninguno';
  return actual === selected;
}

// Match the effective monthly reason displayed in the row, not a different history record.
export function matchesListDiscountReason(list, reason) {
  const selected = document.getElementById(`${list}DiscountReasonFilter`)?.value || 'ALL';
  return matchesDiscountReason(reason, selected);
}

export function initializeDiscountFilters(renderers) {
  for (const [list, render] of Object.entries(renderers)) {
    const select = document.getElementById(`${list}DiscountReasonFilter`);
    if (!select) continue;
    select.replaceChildren(...discountReasonOptions.map(([value, label]) => new Option(label, value)));
    select.value = 'ALL';
    select.addEventListener('change', () => {
      Promise.resolve().then(render).catch((error) => console.error(`Error filtering ${list} by discount reason:`, error));
    });
  }
}