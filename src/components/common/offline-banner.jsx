import { useConnectivity } from '../../lib/connectivity';

export function OfflineBanner({ message = 'Unavailable offline.' }) {
  const { isOffline } = useConnectivity();
  if (!isOffline) return null;
  return (
    <div class="mb-4 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
      {message}
    </div>
  );
}
