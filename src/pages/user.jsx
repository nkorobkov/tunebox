import { Component } from 'preact';
import { useMemo } from 'preact/hooks';
import { ActivityCalendar } from 'react-activity-calendar';
import { Shell } from '../components/layout/shell';
import { LoadingIndicator } from '../components/loading-indicator';
import { useAuth } from '../lib/auth';
import { useTunes } from '../hooks/use-tunes';
import { usePracticeStats } from '../hooks/use-practice-stats';
import { instrumentProficiency } from '../lib/practice-algorithm';
import { avatarUrl, initials } from '../lib/avatar';
import { getTheme } from '../lib/theme';

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

// Grays to brand green (--color-brand-600), matching the app palette.
const CALENDAR_THEME = {
  light: ['#f3f4f6', '#c4e8c0', '#9ad594', '#6fbf69', '#389833'],
  dark: ['#232e42', '#1d3f1a', '#2c7a28', '#4aab44', '#9ad594'],
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
          ) : totalSessions === 0 ? (
            <p class="text-sm text-gray-500">No practice sessions yet — they'll show up here.</p>
          ) : (
            <CalendarBoundary>
              <ActivityCalendar
                data={calendar}
                theme={CALENDAR_THEME}
                colorScheme={getTheme()}
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
