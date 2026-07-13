import { useEffect, useState } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { Button } from '../components/common/button';
import {
  getMobilePlatform,
  isStandalone,
  getInstallPrompt,
  subscribeInstallPrompt,
} from '../lib/install';

function ShareIcon() {
  return (
    <svg class="w-5 h-5 inline-block align-text-bottom text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 15V3m0 0L8 7m4-4l4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg class="w-5 h-5 inline-block align-text-bottom text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function Steps({ children }) {
  return <ol class="list-decimal ml-5 space-y-2 text-sm text-gray-700">{children}</ol>;
}

function IosInstructions() {
  return (
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <h2 class="text-base font-semibold text-gray-900 mb-3">iPhone and iPad</h2>
      <Steps>
        <li>Open <span class="font-medium">tunebox.net</span> in Safari.</li>
        <li>Tap the share button <ShareIcon /> in the toolbar.</li>
        <li>Scroll down and tap <span class="font-medium">Add to Home Screen</span>.</li>
        <li>Tap <span class="font-medium">Add</span>.</li>
      </Steps>
      <p class="text-xs text-gray-400 mt-3">
        Using another browser? Open this page in Safari first — only Safari can
        add web apps to the home screen on iOS.
      </p>
    </div>
  );
}

function AndroidInstructions({ nativePrompt, onInstall }) {
  return (
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <h2 class="text-base font-semibold text-gray-900 mb-3">Android</h2>
      {nativePrompt && (
        <div class="mb-4">
          <Button onClick={onInstall}>Install TuneBox</Button>
        </div>
      )}
      <Steps>
        <li>Open <span class="font-medium">tunebox.net</span> in Chrome.</li>
        <li>Tap the menu button <DotsIcon /> in the top right corner.</li>
        <li>Tap <span class="font-medium">Add to Home screen</span> or <span class="font-medium">Install app</span>.</li>
        <li>Confirm by tapping <span class="font-medium">Install</span>.</li>
      </Steps>
      <p class="text-xs text-gray-400 mt-3">
        Other browsers like Firefox and Samsung Internet have a similar option
        in their menu.
      </p>
    </div>
  );
}

export function InstallPage() {
  const platform = getMobilePlatform();
  const installed = isStandalone();
  const [nativePrompt, setNativePrompt] = useState(() => getInstallPrompt() !== null);

  useEffect(() => subscribeInstallPrompt(() => setNativePrompt(true)), []);

  const handleNativeInstall = async () => {
    const prompt = getInstallPrompt();
    if (!prompt) return;
    await prompt.prompt();
  };

  const sections = [
    <IosInstructions key="ios" />,
    <AndroidInstructions key="android" nativePrompt={nativePrompt} onInstall={handleNativeInstall} />,
  ];
  if (platform === 'android') sections.reverse();

  return (
    <Shell>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Install the app</h1>

      <div class="max-w-xl space-y-6">
        {installed ? (
          <div class="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
            You're already using TuneBox as an installed app. Nothing else to do!
          </div>
        ) : (
          <p class="text-sm text-gray-600">
            TuneBox works as an app on your phone — no app store needed. Add it
            to your home screen to get its own icon, a full-screen view without
            browser bars, and offline access to your tunes.
          </p>
        )}

        {!installed && (
          <>
            {!platform && (
              <div class="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
                Open <span class="font-medium">tunebox.net</span> on your phone
                to install it there.
              </div>
            )}
            {sections}
          </>
        )}
      </div>
    </Shell>
  );
}
