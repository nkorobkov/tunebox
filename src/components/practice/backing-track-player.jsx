import { useRef, useState, useEffect } from 'preact/hooks';
import { getFileUrl } from '../../hooks/use-attachments';
import { useConnectivity } from '../../lib/connectivity';

// Plays a backing-track attachment, optionally retempo'd to the practice speed.
// We change HTML5 audio playbackRate (pitch preserved) to map the track's
// recorded BPM onto the tempo the user is practicing at.
export function BackingTrackPlayer({ attachment, targetTempo }) {
  const { isOffline } = useConnectivity();
  const audioRef = useRef(null);

  const originalBpm = attachment.bpm > 0 ? attachment.bpm : null;
  const target = targetTempo > 0 ? Math.round(targetTempo) : null;
  // We can only adjust speed if we know both the recorded BPM and a target,
  // and they actually differ.
  const canRetempo = originalBpm && target && target !== originalBpm;

  const [atTarget, setAtTarget] = useState(canRetempo);

  const rate = atTarget && canRetempo ? target / originalBpm : 1;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.preservesPitch = true;
    el.mozPreservesPitch = true;
    el.webkitPreservesPitch = true;
    el.playbackRate = rate;
  }, [rate]);

  if (isOffline) {
    return (
      <div class="bg-white rounded-lg border border-gray-200 p-3 text-sm text-gray-400 italic">
        Backing track unavailable offline
      </div>
    );
  }

  const url = getFileUrl(attachment);

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium text-gray-700">
          Backing track{attachment.label ? ` — ${attachment.label}` : ''}
        </span>
        {canRetempo && (
          <div class="flex items-center gap-1 text-xs shrink-0">
            <button
              onClick={() => setAtTarget(true)}
              class={`px-2 py-1 rounded cursor-pointer ${atTarget ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {target} BPM
            </button>
            <button
              onClick={() => setAtTarget(false)}
              class={`px-2 py-1 rounded cursor-pointer ${!atTarget ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Original{originalBpm ? ` (${originalBpm})` : ''}
            </button>
          </div>
        )}
      </div>
      <audio ref={audioRef} src={url} controls preload="none" class="w-full h-8" />
    </div>
  );
}
