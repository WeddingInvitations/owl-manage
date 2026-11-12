const dialog = document.getElementById('bookingGuideDialog');
const frame = document.getElementById('bookingGuideFrame');
const closeButton = document.getElementById('bookingGuideClose');
let opener = null;
let previousOverflow = '';

document.querySelectorAll('[data-guide-open]').forEach((button) => {
  button.addEventListener('click', () => {
    if (dialog.open) return;
    opener = button;
    previousOverflow = document.body.style.overflow;
    frame.src = frame.dataset.guideSrc;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    closeButton.focus();
  });
});

closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    dialog.close();
  }
});
dialog.addEventListener('close', () => {
  frame.removeAttribute('src');
  document.body.style.overflow = previousOverflow;
  opener?.focus();
  opener = null;
});