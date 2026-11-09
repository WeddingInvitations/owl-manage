let timer = null;

export function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast is-visible ${type}`;
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}
