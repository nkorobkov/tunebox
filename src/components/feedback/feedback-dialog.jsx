import { useState } from 'preact/hooks';
import { pb } from '../../lib/pb';
import { useAuth } from '../../lib/auth';
import { useConnectivity } from '../../lib/connectivity';
import { Button } from '../common/button';
import { Dialog } from '../common/dialog';

export const OWNER_EMAIL = 'nikkorobk@gmail.com';
export const MAILTO = `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent('TuneBox feedback')}`;
const MAX_LENGTH = 5000;

const KINDS = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'bug', label: 'Bug' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' },
];

/** The e-mail fallback — shown alongside the form and after sending. */
function EmailFallback({ lead }) {
  return (
    <p class="text-xs text-gray-400">
      {lead}{' '}
      <a href={MAILTO} class="text-blue-600 hover:underline">{OWNER_EMAIL}</a>.
    </p>
  );
}

export function FeedbackDialog({ onClose }) {
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  const [kind, setKind] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const text = message.trim();
  const canSubmit = !!text && !sending && !isOffline;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    setError('');
    try {
      await pb.collection('feedback').create({
        user: user?.id,
        user_email: user?.email || '',
        kind,
        message: text.slice(0, MAX_LENGTH),
        page: typeof window !== 'undefined' ? window.location.pathname : '',
      });
      setSent(true);
    } catch (err) {
      console.error('Failed to send feedback:', err);
      setError('Could not send that — please try again, or email instead.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Dialog title="Thanks!" onClose={onClose}>
        <p class="text-sm text-gray-600">
          Your feedback is in — I read all of it.
        </p>
        <EmailFallback lead="Want to add something?" />
        <div class="flex justify-end pt-2">
          <Button onClick={onClose}>Close</Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog title="Leave feedback" onClose={onClose} closeDisabled={sending}>
      <form onSubmit={handleSubmit} class="space-y-4">
        <p class="text-sm text-gray-600">
          Found a bug, missing something, or just have a thought? Tell me about it.
        </p>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <div class="flex gap-2 flex-wrap">
            {KINDS.map(k => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                class={`px-3 py-1.5 text-sm rounded-md border cursor-pointer ${
                  kind === k.value
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label for="feedback-message" class="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            id="feedback-message"
            value={message}
            onInput={e => setMessage(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={5}
            placeholder="What's on your mind?"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {user?.email && (
            <p class="text-xs text-gray-400 mt-1">
              Sent from {user.email} so I can reply.
            </p>
          )}
        </div>

        {isOffline && (
          <p class="text-sm text-amber-700">
            You're offline — reconnect to send, or use the email below.
          </p>
        )}
        {error && <p class="text-sm text-red-500">{error}</p>}

        <EmailFallback lead="Would rather send an email? Write to" />

        <div class="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button type="submit" disabled={!canSubmit}>{sending ? 'Sending...' : 'Send feedback'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
