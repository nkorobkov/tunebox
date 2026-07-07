import { useState } from 'preact/hooks';
import { extractYouTubeLinks, parseYouTube } from '../../lib/youtube';
import { Markdown } from '../common/markdown';
import { YouTubeEmbed } from '../common/youtube-embed';
import { Button } from '../common/button';
import { useConnectivity } from '../../lib/connectivity';

// Read-only notes body: markdown text plus playable embeds for any YouTube
// links found in it, with an optional shortcut to save one as a proper
// attachment (so it can carry a type/BPM and show up during practice).
export function NotesContent({ notes, attachments = [], onAddAsAttachment }) {
  const { isOffline } = useConnectivity();
  const videos = extractYouTubeLinks(notes);

  // Videos already saved as attachments don't need the promote button.
  const attachedIds = new Set(
    attachments.filter(a => a.url).map(a => parseYouTube(a.url)?.id).filter(Boolean)
  );

  return (
    <div>
      <Markdown text={notes} />

      {videos.length > 0 && !isOffline && (
        <div class="mt-3 space-y-3">
          {videos.map(video => (
            <div key={video.id} class="max-w-md">
              <YouTubeEmbed videoId={video.id} start={video.start} />
              {!attachedIds.has(video.id) && onAddAsAttachment && (
                <button
                  onClick={() => onAddAsAttachment(video.url)}
                  class="mt-1 text-xs text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Add as attachment (backing track, recording...)
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The notes card on the tune page: view + edit in place.
export function TuneNotes({ notes, attachments, onAddAsAttachment, onSave }) {
  const { isOffline } = useConnectivity();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(notes || '');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-medium text-gray-700">Notes</h3>
        {!editing && (
          <button
            onClick={startEditing}
            disabled={isOffline}
            title={isOffline ? 'Unavailable offline' : undefined}
            class="text-sm text-blue-600 hover:text-blue-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {notes ? 'Edit' : 'Add'}
          </button>
        )}
      </div>

      {editing ? (
        <div class="space-y-2">
          <textarea
            value={draft}
            onInput={e => setDraft(e.target.value)}
            rows={Math.max(6, draft.split('\n').length + 1)}
            autoFocus
            placeholder="Any notes about this tune..."
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-gray-400">
              Markdown supported: **bold**, *italic*, # headers, - lists, links
            </span>
            <div class="flex gap-2 shrink-0">
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </div>
      ) : notes ? (
        <NotesContent notes={notes} attachments={attachments} onAddAsAttachment={onAddAsAttachment} />
      ) : (
        <p class="text-sm text-gray-400">No notes yet.</p>
      )}
    </div>
  );
}
