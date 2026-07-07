// Light/dark theme. Default is light (deliberately not system preference);
// the toggle lives on the settings page. Dark mode works by remapping the
// Tailwind palette CSS variables under the `.dark` class — see index.css.
const STORAGE_KEY = 'tunebox_theme';

export function getTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* private browsing — theme just won't persist */ }
  applyTheme(theme);
}
