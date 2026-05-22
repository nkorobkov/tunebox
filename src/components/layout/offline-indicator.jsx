import { useEffect, useState } from 'preact/hooks';
import { useConnectivity } from '../../lib/connectivity';
import { useAuth } from '../../lib/auth';
import { queueLength, subscribe } from '../../lib/practice-queue';

export function OfflineIndicator() {
  const { isOffline } = useConnectivity();
  const { user } = useAuth();
  const userId = user?.id;
  const [pending, setPending] = useState(() => queueLength(userId));

  useEffect(() => {
    setPending(queueLength(userId));
    return subscribe(() => setPending(queueLength(userId)));
  }, [userId]);

  if (isOffline) {
    return (
      <span
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs"
        title="Read-only. Practice will sync when you reconnect."
      >
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Offline
      </span>
    );
  }

  if (pending > 0) {
    return (
      <span
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"
        title={`${pending} practice ${pending === 1 ? 'record' : 'records'} syncing`}
      >
        <span class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
        Syncing {pending}
      </span>
    );
  }

  return null;
}
