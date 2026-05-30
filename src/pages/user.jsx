import { Component } from 'preact';
import { useMemo } from 'preact/hooks';
import { ActivityCalendar } from 'react-activity-calendar';
import { Shell } from '../components/layout/shell';
import { LoadingIndicator } from '../components/loading-indicator';
import { useAuth } from '../lib/auth';
import { useTunes } from '../hooks/use-tunes';
import { usePracticeStats } from '../hooks/use-practice-stats';
import { instrumentProficiency } from '../lib/practice-algorithm';
import { pb } from '../lib/pb';

class CalendarBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error('Calendar render failed:', err); }
  render() {
    if (this.state.err) {
      return <p class="text-sm text-gray-500">Couldn't render the practice calendar: {this.state.err.message}</p>;
    }
    return this.props.children;
  }
}

function avatarUrl(user) {
  if (!user) return null;
  // PocketBase file field — user.avatar is a filename when stored as a file.
  if (user.avatar && typeof user.avatar === 'string') {
    if (user.avatar.startsWith('http')) return user.avatar;
    try {
      return pb.files.getURL(user, user.avatar, { thumb: '128x128' });
    } catch {
      return null;
    }
  }
  return null;
}

function initials(user) {
  const source = user?.name || user?.email || '?';
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
}

function aggregateLibrary(tunes, instruments) {
  let playing = 0;
  let learning = 0;
  let notStarted = 0;
  for (const t of tunes) {
    let best = null;
    for (const inst of instruments) {
      const prof = instrumentProficiency(t, inst);
      if (prof === 'playing') { best = 'playing'; break; }
      if (prof === 'learning') best = 'learning';
    }
    if (best === 'playing') playing++;
    else if (best === 'learning') learning++;
    else notStarted++;
  }
  return { playing, learning, notStarted };
}

function Stat({ label, value }) {
  return (
    <div class="flex items-baseline gap-1.5">
      <span class="text-lg font-semibold text-gray-900 tabular-nums">{value}</span>
      <span class="text-xs text-gray-500">{label}</span>
    </div>
  );
}

const CALENDAR_THEME = {
  light: ['#f3f4f6', '#bbf7d0', '#86efac', '#4ade80', '#16a34a'],
};

export function UserPage() {
  const { user } = useAuth();
  const { tunes, loading: tunesLoading } = useTunes();
  const { calendar, totalSessions, loading: statsLoading, error: statsError } = usePracticeStats();

  const instruments = user?.instruments || [];
  const library = useMemo(
    () => aggregateLibrary(tunes || [], instruments),
    [tunes, instruments]
  );

  const avatar = avatarUrl(user);

  return (
    <Shell>
      <div class="space-y-6">
        {/* Header: avatar + name + email */}
        <div class="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              class="w-16 h-16 rounded-full object-cover bg-gray-100"
              referrerpolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div class="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-xl">
              {initials(user)}
            </div>
          )}
          <div class="min-w-0">
            <h1 class="text-xl font-bold text-gray-900 truncate">{user?.name || user?.email}</h1>
            {user?.name && <p class="text-sm text-gray-500 truncate">{user.email}</p>}
          </div>
        </div>

        {/* Library stats */}
        <div class="bg-white rounded-lg border border-gray-200 px-4 py-3 flex flex-wrap items-baseline gap-x-5 gap-y-2">
          {tunesLoading ? (
            <LoadingIndicator />
          ) : (
            <>
              <Stat label="tunes" value={tunes?.length || 0} />
              <Stat label="playing" value={library.playing} />
              <Stat label="learning" value={library.learning} />
            </>
          )}
        </div>

        {/* Practice heatmap */}
        <div class="user-page-heatmap bg-white rounded-lg border border-gray-200 p-4">
          {statsLoading ? (
            <LoadingIndicator />
          ) : statsError || calendar.length === 0 ? (
            <p class="text-sm text-gray-500">Couldn't load practice history.</p>
          ) : (
            <CalendarBoundary>
              <ActivityCalendar
                data={calendar}
                theme={CALENDAR_THEME}
                colorScheme="light"
                blockSize={12}
                blockMargin={3}
                fontSize={12}
                labels={{ totalCount: '{{count}} practice sessions in the last year' }}
                renderBlock={(block, activity) => (
                  <>
                    {block}
                    <title>{`${activity.count} session${activity.count === 1 ? '' : 's'} on ${activity.date}`}</title>
                  </>
                )}
              />
            </CalendarBoundary>
          )}
        </div>
      </div>
    </Shell>
  );
}
