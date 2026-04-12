import { useState } from 'preact/hooks';
import { useAuth } from '../../lib/auth';

export function Nav() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav class="bg-white border-b border-gray-200 px-4 py-3">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-6">
          <a href="/" class="flex items-center gap-2 text-xl font-bold text-gray-900 no-underline">
            <svg viewBox="0 0 64 64" class="w-6 h-6">
              <g fill="none" stroke="#5b8c72" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M 24,35 A 24,24 0 0,1 32,12 A 24,24 0 0,1 40,35"/>
                <path d="M 40,35 A 24,24 0 0,1 53,52 A 24,24 0 0,1 32,48"/>
                <path d="M 32,48 A 24,24 0 0,1 11,52 A 24,24 0 0,1 24,35"/>
              </g>
            </svg>
            <span class="hidden lg:inline">TuneBox</span>
          </a>
          {user && (
            <>
              {/* Desktop nav */}
              <div class="hidden lg:flex gap-4">
                <a href="/" class="text-sm text-gray-600 hover:text-gray-900 no-underline">Library</a>
                <a href="/add" class="text-sm text-gray-600 hover:text-gray-900 no-underline">Add Tune</a>
                <a href="/practice" class="text-sm text-gray-600 hover:text-gray-900 no-underline">Practice</a>
                <a href="/settings" class="text-sm text-gray-600 hover:text-gray-900 no-underline">Settings</a>
              </div>
              {/* Mobile nav — always visible */}
              <div class="flex lg:hidden gap-4">
                <a href="/add" class="text-sm text-gray-600 hover:text-gray-900 no-underline">Add Tune</a>
                <a href="/practice" class="text-sm text-gray-600 hover:text-gray-900 no-underline">Practice</a>
              </div>
            </>
          )}
        </div>
        {user && (
          <div class="flex items-center gap-3">
            {/* Desktop user info */}
            <span class="hidden lg:inline text-sm text-gray-500">{user.email}</span>
            <button
              onClick={logout}
              class="hidden lg:inline text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              Logout
            </button>
            {/* Mobile hamburger */}
            <div class="relative lg:hidden">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                class="p-1 text-gray-600 hover:text-gray-900 cursor-pointer"
                aria-label="Menu"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  {menuOpen
                    ? <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    : <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div class="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div class="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                    <a href="/" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 no-underline" onClick={() => setMenuOpen(false)}>Library</a>
                    <a href="/settings" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 no-underline" onClick={() => setMenuOpen(false)}>Settings</a>
                    <hr class="my-1 border-gray-100" />
                    <span class="block px-4 pt-1.5 text-xs text-gray-400 truncate">{user.email?.split('@')[0]}</span>
                    <button
                      onClick={() => { setMenuOpen(false); logout(); }}
                      class="w-full text-left px-4 py-1.5 pb-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
