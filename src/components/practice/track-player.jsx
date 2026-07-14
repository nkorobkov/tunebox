import { useState, useRef, useEffect } from 'preact/hooks';
import { getFileUrl } from '../../hooks/use-attachments';
import { parseYouTube } from '../../lib/youtube';
import { YouTubeEmbed } from '../common/youtube-embed';
import { useConnectivity } from '../../lib/connectivity';
import { ToolTile, PlayIcon, StopIcon } from './tool-tile';

/**
 * Plays the tune's source recording (a `source`-type attachment) on the
 * practice card. Audio files play/stop straight from the tile with a loop
 * toggle; YouTube sources toggle an inline embed since the iframe player
 * owns its own controls.
 */
export function TrackPlayer({ attachment }) {
  const { isOffline } = useConnectivity();
  const youtube = attachment.url ? parseYouTube(attachment.url) : null;
  if (youtube) {
    return <YouTubeTrack attachment={attachment} youtube={youtube} disabled={isOffline} />;
  }
  return <AudioTrack attachment={attachment} disabled={isOffline} />;
}

function AudioTrack({ attachment, disabled }) {
  const [state, setState] = useState('idle'); // idle | loading | playing
  const [loop, setLoop] = useState(false);
  const audioRef = useRef(null);

  // Unmount (next tune) stops playback.
  useEffect(() => () => {
    if (audioRef.current) audioRef.current.pause();
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop;
  }, [loop]);

  const stop = () => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setState('idle');
  };

  const play = async () => {
    let el = audioRef.current;
    if (!el) {
      el = new Audio(getFileUrl(attachment));
      el.onended = () => setState('idle');
      el.onplaying = () => setState('playing');
      audioRef.current = el;
    }
    el.loop = loop;
    setState('loading');
    try {
      await el.play();
    } catch (err) {
      console.error('Track playback failed:', err);
      setState('idle');
    }
  };

  const active = state !== 'idle';

  return (
    <ToolTile
      active={active}
      disabled={disabled}
      onClick={active ? stop : play}
      icon={state === 'idle' ? <PlayIcon class="w-5 h-5" /> : <StopIcon class="w-5 h-5" />}
      label="Play track"
      sublabel={disabled ? 'offline' : state === 'loading' ? 'loading…' : state === 'playing' ? 'stop' : (attachment.label || 'start')}
      corner={
        <button
          onClick={() => setLoop(!loop)}
          title={loop ? 'Looping — tap to play once' : 'Play once — tap to loop'}
          class={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
            loop ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-600'
          }`}
        >loop</button>
      }
    />
  );
}

function YouTubeTrack({ attachment, youtube, disabled }) {
  const [show, setShow] = useState(false);

  return (
    <div class="space-y-2">
      <ToolTile
        active={show}
        disabled={disabled}
        onClick={() => setShow(!show)}
        icon={<PlayIcon class="w-5 h-5" />}
        label="Play track"
        sublabel={disabled ? 'offline' : show ? 'hide' : (attachment.label || 'YouTube')}
      />
      {show && (
        <div class="bg-white rounded-lg border border-gray-200 p-3">
          <YouTubeEmbed videoId={youtube.id} start={youtube.start} title={attachment.label || 'Source recording'} />
        </div>
      )}
    </div>
  );
}
