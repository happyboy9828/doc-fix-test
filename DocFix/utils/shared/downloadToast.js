/* Lightweight, dependency-free toast for download-limit warnings.
   Uses the shared .tool-toast class from app/tool.css so it matches the
   rest of the site. Works in both React and imperative-DOM tools. */

const TOAST_ID = "docfix-dl-toast";

function ensureToast() {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "tool-toast is-error";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  return toast;
}

export function showDownloadLimitToast(message) {
  const toast = ensureToast();
  toast.textContent = message || "Daily download limit reached.";
  toast.style.opacity = "1";
  toast.style.transform = "translate(-50%, 0)";
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, 8px)";
  }, 5000);
}

export function hideDownloadLimitToast() {
  const toast = document.getElementById(TOAST_ID);
  if (toast) {
    clearTimeout(toast._hideTimer);
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, 8px)";
    setTimeout(() => {
      const t = document.getElementById(TOAST_ID);
      if (t && t.parentNode) t.parentNode.removeChild(t);
    }, 300);
  }
}
