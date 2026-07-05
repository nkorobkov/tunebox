import { useState } from 'preact/hooks';
import { useAuth } from '../../lib/auth';
import { useConnectivity } from '../../lib/connectivity';
import { avatarUrl, initials } from '../../lib/avatar';
import { OfflineIndicator } from './offline-indicator';

// Nav remounts on every route change (each page renders its own Shell),
// so reading location.pathname at render time is enough for active state.
function NavLink({ href, children }) {
  const pathname = window.location.pathname;
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <a
      href={href}
      class={`text-sm no-underline ${active ? 'text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </a>
  );
}

function UserAvatar({ user, size = 'w-7 h-7' }) {
  const avatar = avatarUrl(user);
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        class={`${size} rounded-full object-cover bg-gray-100`}
        referrerpolicy="no-referrer"
      />
    );
  }
  return (
    <span class={`${size} rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-xs`}>
      {initials(user)}
    </span>
  );
}

export function Nav() {
  const { user, logout } = useAuth();
  const { isOffline } = useConnectivity();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav class="bg-white border-b border-gray-200 px-4 py-3">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-6">
          <a href="/" class="flex items-center gap-2 no-underline">
            <img src="/tunebook-logo.svg" alt="TuneBox" class="h-7 lg:hidden" />
            <img src="/tunebook.svg" alt="TuneBox" class="hidden lg:block h-7" />
          </a>
          {user && (
            <>
              {/* Desktop nav */}
              <div class="hidden lg:flex gap-4">
                <NavLink href="/">Library</NavLink>
                {!isOffline && <NavLink href="/add">Add tune</NavLink>}
                <NavLink href="/practice">Practice</NavLink>
                <NavLink href="/settings">Settings</NavLink>
              </div>
              {/* Mobile nav — always visible */}
              <div class="flex lg:hidden gap-4">
                {!isOffline && <NavLink href="/add">Add tune</NavLink>}
                <NavLink href="/practice">Practice</NavLink>
              </div>
            </>
          )}
        </div>
        {user && (
          <div class="flex items-center gap-3">
            <OfflineIndicator />
            {/* Desktop user info */}
            <a
              href="/user"
              title={user.email}
              class="hidden lg:inline-flex no-underline rounded-full hover:ring-2 hover:ring-gray-200"
            >
              <UserAvatar user={user} />
            </a>
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
                    <a href="/user" class="flex items-center gap-2 px-4 pt-1.5 text-xs text-gray-400 hover:text-gray-600 no-underline" onClick={() => setMenuOpen(false)}>
                      <UserAvatar user={user} size="w-5 h-5" />
                      <span class="truncate">{user.email?.split('@')[0]}</span>
                    </a>
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
