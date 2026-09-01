import { useState } from 'preact/hooks';
import { FeedbackDialog, OWNER_EMAIL, MAILTO } from './feedback-dialog';

/**
 * The tinted strip closing out the library and settings pages. Reads as a
 * footer but stays noticeable, and shows the email address up front so the
 * other channel doesn't require opening the form first. The mobile hamburger
 * opens the same dialog from its own entry (see layout/nav.jsx).
 */
export function FeedbackFooter() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div class="mt-10 rounded-lg border border-gray-200 bg-gray-100 px-4 py-5 text-center">
        <p class="text-sm text-gray-600">Missing something, or hit a bug?</p>
        <p class="mt-1.5 text-sm">
          <button
            onClick={() => setOpen(true)}
            class="font-medium text-blue-600 hover:underline cursor-pointer"
          >
            Leave feedback
          </button>
          <span class="mx-2 text-gray-300" aria-hidden="true">·</span>
          <a href={MAILTO} class="text-blue-600 hover:underline">{OWNER_EMAIL}</a>
        </p>
      </div>
      {/* Outside the centred wrapper — the dialog would inherit text-center. */}
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}
