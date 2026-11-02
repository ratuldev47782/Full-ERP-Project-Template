// Shared modal dialog based on SweetAlert2. Replaces browser confirm()/alert()
// so every prompt in the app looks the same and can be styled.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Returns true when the user confirms, false on cancel/backdrop/escape.
export async function confirmDialog({
  title = 'Are you sure?',
  text,
  lines,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  danger = true,
}) {
  // Lazy import: SweetAlert2 touches the DOM, so it must stay out of server render.
  const { default: Swal } = await import('sweetalert2');
  const body = lines ? lines.map((line) => esc(line)).join('<br>') : esc(text);

  const result = await Swal.fire({
    titleText: title,
    html: body,
    icon: danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? '#e11d48' : '#0f766e',
    cancelButtonColor: '#71717a',
    focusCancel: Boolean(danger),
    reverseButtons: true,
  });

  return result.isConfirmed;
}