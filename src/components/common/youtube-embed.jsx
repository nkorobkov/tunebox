import { useState } from 'preact/hooks';
import { youtubeThumbnail } from '../../lib/youtube';

// Click-to-load YouTube embed. Shows a static thumbnail until the user
// plays it, so pages with videos don't talk to YouTube on load. Playback
// controls (including speed) are the embedded player's own.
export function YouTubeEmbed({ videoId, start = 0, title }) {
  const [active, setActive] = useState(false);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        class="relative block w-full aspect-video rounded-md overflow-hidden bg-black group cursor-pointer"
        title={title ? `Play: ${title}` : 'Play video'}
      >
        <img
          src={youtubeThumbnail(videoId)}
          alt={title || 'YouTube video'}
          loading="lazy"
          class="w-full h-full object-cover opacity-90 group-hover:opacity-100"
        />
        <span class="absolute inset-0 flex items-center justify-center">
          <span class="w-14 h-10 rounded-lg bg-black/70 group-hover:bg-red-600 flex items-center justify-center transition-colors">
            <svg class="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </button>
    );
  }

  const params = new URLSearchParams({
    autoplay: '1',
    playsinline: '1',
    rel: '0',
  });
  if (start > 0) params.set('start', String(start));

  return (
    <div class="w-full aspect-video rounded-md overflow-hidden bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?${params}`}
        title={title || 'YouTube video'}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        class="w-full h-full border-0"
      />
    </div>
  );
}
