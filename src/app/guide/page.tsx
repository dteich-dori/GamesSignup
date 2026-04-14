"use client";

import Link from "next/link";

export default function PlayerGuidePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Player Guide</h1>
        <Link
          href="/"
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
          title="Return to the Home screen"
        >
          ← Return to Home
        </Link>
      </div>

      <div className="space-y-6 text-sm leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold mb-2">Getting Started</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open the app in your phone&apos;s browser</li>
            <li>Select your name from the dropdown at the top</li>
            <li>Your name will be remembered next time you visit</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Joining a Game</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>Make sure your name is selected in the dropdown</li>
            <li>Find the date and court you want to play</li>
            <li>Tap the <span className="text-primary font-bold">+</span> button in an empty slot</li>
            <li>Your name appears in that slot with a brief blue flash</li>
            <li>You can join one slot per court per day</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Withdrawing from a Game</h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>Find your name in the game grid (shown in <span className="text-primary font-semibold underline">blue underlined text</span>)</li>
            <li>Tap your name</li>
            <li>Confirm the withdrawal</li>
          </ol>
          <p className="mt-2 text-muted">
            Note: You may not be able to withdraw within a certain number of hours before game time.
            Check with your club administrator for the current cutoff policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Understanding the Grid</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Columns</strong> = Days (today and upcoming)</li>
            <li><strong>Game 1, Game 2, etc.</strong> = Courts available that day</li>
            <li><strong>Ct#</strong> row = Reserved physical court number (set by admin)</li>
            <li><strong>Time</strong> row = Game time for that court</li>
            <li><strong>Numbered rows (1, 2, 3, 4)</strong> = Player slots</li>
            <li><span className="text-primary font-bold">+</span> = Open slot you can join</li>
            <li><span className="text-primary underline">Your name</span> = You&apos;re signed up (tap to withdraw)</li>
            <li>Grayed-out columns = Past dates (no changes allowed)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Notifications</h2>
          <p>
            Tap the bell icon (top right) to see your notifications. These include:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li><strong>Reminders</strong> — Sent the day before your game</li>
            <li><strong>Urgent notices</strong> — When tomorrow&apos;s game needs more players</li>
            <li><strong>Cancellations</strong> — When a player withdraws from your game</li>
          </ul>
          <p className="mt-2 text-muted">
            If your email and/or phone+carrier are configured, you&apos;ll also receive these by email or text.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Add to Home Screen</h2>
          <p>For quick access, add this app to your phone&apos;s home screen:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li><strong>iPhone:</strong> Open in Safari &rarr; tap Share &rarr; &quot;Add to Home Screen&quot;</li>
            <li><strong>Android:</strong> Open in Chrome &rarr; tap &#8942; menu &rarr; &quot;Add to Home Screen&quot;</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Tips</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>The grid auto-refreshes every 30 seconds</li>
            <li>Your player selection automatically resets after a period of inactivity — just re-select your name to continue</li>
            <li>If you have questions, contact your club administrator</li>
          </ul>
        </section>

      </div>

      <div className="mt-8 pt-4 border-t border-border">
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium"
          title="Return to the Home screen"
        >
          ← Return to Home
        </Link>
      </div>
    </div>
  );
}
