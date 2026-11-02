// Shared modal dialog based on SweetAlert2. Replaces browser confirm()/alert()
// so every prompt in the app looks the same and can be styled.
//
// Styling note: buttonsStyling is off and the dialog is styled with Tailwind
// classes below, so it matches the rest of the app (blue primary, slate neutrals,
// red for destructive actions). Requires SweetAlert2 v11+.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const BUTTON =
  'inline-flex flex-1 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm ' +
  'transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const classes = (danger) => ({
  popup: 'w-[26rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 !p-0 pt-2 shadow-xl shadow-slate-900/10',
  icon: '!mb-2 !mt-6 scale-75',
  title: '!px-8 !pt-0 !text-lg !font-semibold !text-slate-900',
  htmlContainer: '!mx-0 !mb-0 !mt-2 !px-8 !text-sm !leading-relaxed !text-slate-500',
  actions: '!mt-7 !w-full !flex-nowrap !gap-3 !border-t !border-slate-100 !bg-slate-50 !px-6 !py-4 rounded-b-2xl',
  confirmButton: `${BUTTON} !m-0 text-white ${
    danger
      ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
      : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500'
  }`,
  cancelButton: `${BUTTON} !m-0 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400`,
});

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
  // Each line is its own <div> (min-height keeps blank lines as spacing)
  const toDiv = (line) => `<div class="min-h-[1.25em]">${esc(line)}</div>`;
  const body = lines ? lines.map(toDiv).join('') : toDiv(text);

  // Skip the pop-in animation for people who prefer reduced motion
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const noAnimation = reduceMotion ? { popup: '', backdrop: '', icon: '' } : undefined;

  const result = await Swal.fire({
    titleText: title,
    html: body,
    icon: danger ? 'warning' : 'question',
    iconColor: danger ? '#dc2626' : '#2563eb',
    width: 'auto',
    padding: 0,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    buttonsStyling: false,
    customClass: classes(danger),
    backdrop: 'rgba(15, 23, 42, 0.5)',
    focusCancel: Boolean(danger),
    reverseButtons: true,
    ...(noAnimation && { showClass: noAnimation, hideClass: noAnimation }),
  });

  return result.isConfirmed;
}