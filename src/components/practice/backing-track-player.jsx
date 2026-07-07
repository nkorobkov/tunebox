import { useRef, useState, useEffect } from 'preact/hooks';
import { getFileUrl } from '../../hooks/use-attachments';
import { parseYouTube } from '../../lib/youtube';
import { YouTubeEmbed } from '../common/youtube-embed';
import { useConnectivity } from '../../lib/connectivity';

// Plays a backing-track attachment. File tracks use HTML5 audio playbackRate
// (pitch preserved) to map the track's recorded BPM onto the practice tempo.
// YouTube tracks just show the recorded BPM — speed changes happen inside
// the embedded player's own controls.
export function BackingTrackPlayer({ attachment, targetTempo }) {
  const { isOffline } = useConnectivity();

  if (isOffline) {
    return (
      <div class="bg-white rounded-lg border border-gray-200 p-3 text-sm text-gray-400 italic">
        Backing track unavailable offline
      </div>
    );
  }

  const youtube = attachment.url ? parseYouTube(attachment.url) : null;
  if (youtube) {
    return <YouTubeBackingTrack attachment={attachment} youtube={youtube} />;
  }
  if (attachment.url) return null; // non-YouTube link — nothing to play inline
  return <AudioBackingTrack attachment={attachment} targetTempo={targetTempo} />;
}

function TrackTitle({ attachment, suffix }) {
  return (
    <span class="text-sm font-medium text-gray-700">
      Backing track{attachment.label ? ` — ${attachment.label}` : ''}{suffix}
    </span>
  );
}

function RateToggle({ atTarget, onChange, targetLabel, originalLabel }) {
  return (
    <div class="flex items-center gap-1 text-xs shrink-0">
      <button
        onClick={() => onChange(true)}
        class={`px-2 py-1 rounded cursor-pointer ${atTarget ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      >
        {targetLabel}
      </button>
      <button
        onClick={() => onChange(false)}
        class={`px-2 py-1 rounded cursor-pointer ${!atTarget ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
      >
        {originalLabel}
      </button>
    </div>
  );
}

function AudioBackingTrack({ attachment, targetTempo }) {
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

  const url = getFileUrl(attachment);

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <TrackTitle attachment={attachment} />
        {canRetempo && (
          <RateToggle
            atTarget={atTarget}
            onChange={setAtTarget}
            targetLabel={`${target} BPM`}
            originalLabel={`Original${originalBpm ? ` (${originalBpm})` : ''}`}
          />
        )}
      </div>
      <audio ref={audioRef} src={url} controls preload="none" class="w-full h-8" />
    </div>
  );
}

function YouTubeBackingTrack({ attachment, youtube }) {
  const bpm = attachment.bpm > 0 ? attachment.bpm : null;

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <TrackTitle attachment={attachment} suffix=" (YouTube)" />
        {bpm && <span class="text-xs text-gray-500 shrink-0">{bpm} BPM</span>}
      </div>
      <YouTubeEmbed videoId={youtube.id} start={youtube.start} title={attachment.label || 'Backing track'} />
    </div>
  );
}
