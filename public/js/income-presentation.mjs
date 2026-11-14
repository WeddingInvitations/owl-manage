// Display labels and navigation only. Stored concepts and accounting amounts
// are intentionally left untouched.
export function incomeRowPresentation(concept = '') {
  const label = String(concept).replace(/\s*\(total\)/gi, '').replace(/\btotal\b/gi, '').replace(/\s+/g, ' ').trim();
  const destinations = {
    'cuotas atletas': 'athletesView',
    'cuotas acrobacias': 'acroView',
    'cuotas acrokids': 'acroKidsView',
    'cuotas halterofilia': 'halteView',
    'cuotas telas': 'telasView',
    'cuotas the nest pilates': 'pilatesView',
    'cuotas the nest barre': 'pilatesView',
    'cuotas the nest': 'pilatesView',
    'ventas caja': 'cajaView',
  };
  return { label, viewId: destinations[label.toLocaleLowerCase('es-ES')] || null };
}