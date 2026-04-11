import { useAuth } from '../../lib/auth';

export function Nav() {
  const { user, logout } = useAuth();

  return (
    <nav class="bg-white border-b border-gray-200 px-4 py-3">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-6">
          <a href="/" class="flex items-center gap-2 text-xl font-bold text-gray-900 no-underline">
            <svg viewBox="0 0 64 64" class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
              <circle cx="32" cy="20" r="12"/>
              <circle cx="21.6" cy="38" r="12"/>
              <circle cx="42.4" cy="38" r="12"/>
            </svg>
            TuneBox
          </a>
          {user && (
            <div class="flex gap-4">
              <a href="/" class="text-sm text-gray-600 hover:text-gray-900 no-underline">Library</a>
              <a href="/add" class="text-sm text-gray-600 hover:text-gray-900 no-underline">Add Tune</a>
              <a href="/practice" class="text-sm text-gray-600 hover:text-gray-900 no-underline">Practice</a>
              <a href="/settings" class="text-sm text-gray-600 hover:text-gray-900 no-underline">Settings</a>
            </div>
          )}
        </div>
        {user && (
          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={logout}
              class="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
