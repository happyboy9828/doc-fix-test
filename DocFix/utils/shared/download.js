import { canDownload, recordDownload, getDownloadStats, formatTimeRemaining } from "./downloadLimit";
import { showDownloadLimitToast } from "./downloadToast";

/** Result of downloadBlob:
 *   { ok: true  }           – download initiated, limit incremented
 *   { ok: false, reason }   – blocked; reason is "limit" or "error"
 */
export function downloadBlob(blob, filename) {
  if (!canDownload()) {
    const { remaining, resetsAt } = getDownloadStats();
    const when = resetsAt ? formatTimeRemaining(resetsAt - Date.now()) : "";
    const message = when
      ? `Daily limit reached (${remaining} downloads left). Resets in ${when}.`
      : `Daily limit reached. Try again later.`;
    showDownloadLimitToast(message);
    return { ok: false, reason: message, remaining, resetsAt };
  }

  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    recordDownload();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Download failed: ${err.message}`, remaining: getDownloadStats().remaining };
  }
}
