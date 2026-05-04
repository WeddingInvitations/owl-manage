// toast.js
export function showToast(message, type = "success", duration = 2500) {
  let toast = document.createElement("div");
  toast.className = `custom-toast custom-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}
