import { render } from 'preact';
import './index.css';
import { App } from './app.jsx';
import { applyTheme, getTheme } from './lib/theme';

// The boot script in index.html already applied the theme before first paint;
// re-applying here keeps it correct even if that script was blocked.
applyTheme(getTheme());

render(<App />, document.getElementById('app'));

// The boot script hides the prerendered landing page (.booting) when it isn't
// the right content for this visit; reveal the app now that it has rendered.
document.documentElement.classList.remove('booting');
