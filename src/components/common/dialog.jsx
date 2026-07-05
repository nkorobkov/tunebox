import { useEffect } from 'preact/hooks';
import { Button } from './button';

/**
 * Modal dialog: dimmed backdrop, centered white panel. Closes on backdrop
 * click or Escape unless `closeDisabled` (e.g. while an operation runs).
 */
export function Dialog({ title, onClose, closeDisabled = false, maxWidth = 'max-w-md', children }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !closeDisabled) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, closeDisabled]);

  return (
    <>
      <div class="fixed inset-0 bg-black/40 z-30" onClick={() => !closeDisabled && onClose()} />
      <div class="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
        <div class={`bg-white rounded-lg shadow-xl w-full p-5 space-y-4 pointer-events-auto ${maxWidth}`} role="dialog" aria-modal="true">
          {title && <h3 class="text-base font-semibold text-gray-900">{title}</h3>}
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * Confirmation dialog for destructive actions.
 */
export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <Dialog title={title} onClose={onCancel} maxWidth="max-w-sm">
      <p class="text-sm text-gray-600">{message}</p>
      <div class="flex gap-3 justify-end">
        <Button variant="secondary" size="md" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" size="md" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
