"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

function generateTimeOptions(earliest: string, latest: string, durationMinutes: number): { value: string; label: string }[] {
  const [eh, em] = earliest.split(":").map(Number);
  const [lh, lm] = latest.split(":").map(Number);
  const options: { value: string; label: string }[] = [];
  let totalMins = eh * 60 + em;
  const latestMins = lh * 60 + lm;
  while (totalMins <= latestMins) {
    const sh = Math.floor(totalMins / 60);
    const sm = totalMins % 60;
    const endMins = totalMins + durationMinutes;
    const eh2 = Math.floor(endMins / 60);
    const em2 = endMins % 60;
    const start = `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`;
    const end = `${String(eh2).padStart(2, "0")}:${String(em2).padStart(2, "0")}`;
    const value = `${start}-${end}`;
    options.push({ value, label: `${start} – ${end}` });
    totalMins += 15;
  }
  return options;
}

interface Settings {
  id: number;
  clubName: string;
  courtsAvailable: number;
  defaultTimeSlot: string;
  playersPerGame: number;
  daysAhead: number;
  reservationCutoffHours: number;
  reminderTime: string;
  creatorPlayerId: number | null;
  creatorPin: string;
  maintainerPlayerId: number | null;
  maintainerPin: string;
  errorReportEmail: string | null;
  startDate: string | null;
  dropdownResetSeconds: number;
  weatherZip: string;
  weatherLat: string;
  weatherLon: string;
  weatherEnabled: boolean;
  timeSlotEarliestStart: string;
  timeSlotLatestStart: string;
  timeSlotDurationMinutes: number;
}

interface Player {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function SetupPage() {
  const [role, setRole] = useState<"creator" | "maintainer" | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [activeTab] = useState<"settings">("settings");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [saving, setSaving] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [resettingOverflow, setResettingOverflow] = useState(false);
  const [overflowMessage, setOverflowMessage] = useState("");


  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setSettings(data);
  }, []);

  const fetchPlayers = useCallback(async () => {
    const res = await fetch("/api/players");
    const data = await res.json();
    setPlayers(data);
  }, []);

  useEffect(() => {
    const savedRole = sessionStorage.getItem("setupRole");
    if (savedRole === "creator" || savedRole === "maintainer") {
      setRole(savedRole);
      return;
    }
    // Check if PINs are empty (first-time setup) — auto-login as creator
    fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "" }),
    }).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data.firstTime) {
          setRole(data.role);
          sessionStorage.setItem("setupRole", data.role);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (role) {
      fetchSettings();
      fetchPlayers();
    }
  }, [role, fetchSettings, fetchPlayers]);

  const handleLogin = async () => {
    setPinError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      setPinError("Invalid PIN");
      return;
    }
    const data = await res.json();
    setRole(data.role);
    sessionStorage.setItem("setupRole", data.role);
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    // Check if courts were reduced and if affected slots have signups
    const checkRes = await fetch(`/api/game-slots?checkExcess=${settings.courtsAvailable}`);
    const checkData = await checkRes.json();

    if (checkData.slotsWithSignups > 0) {
      const proceed = confirm(
        `Warning: Reducing courts will affect ${checkData.slotsWithSignups} game slot(s) that have player signups. ` +
        `Those slots will be kept until their signups are removed.\n\nContinue?`
      );
      if (!proceed) return;
    }

    setSaving(true);
    setBackupMessage("");
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    // Regenerate slots (will remove empty excess courts)
    await fetch("/api/game-slots?generate=true");

    // Generate a full database backup and prompt the browser to save it.
    // The browser writes the file to the user's configured Downloads folder.
    try {
      const backupRes = await fetch("/api/backup");
      if (!backupRes.ok) {
        setBackupMessage(`Settings saved, but backup download failed (HTTP ${backupRes.status}).`);
      } else {
        const blob = await backupRes.blob();
        const filename =
          backupRes.headers.get("X-Backup-Filename") ||
          `gamessignup-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setBackupMessage(
          `Settings saved. Backup downloaded as “${filename}” to your browser's Downloads folder.`
        );
      }
    } catch (err) {
      setBackupMessage(`Settings saved, but backup download failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    setSaving(false);
  };

  const handleResetOverflow = async () => {
    if (!confirm("Remove all empty overflow game slots and revert to the configured number of games?")) return;
    setResettingOverflow(true);
    setOverflowMessage("");
    try {
      const res = await fetch("/api/game-slots/reset-overflow", { method: "POST" });
      const data = await res.json();
      if (data.removed > 0) {
        setOverflowMessage(`Removed ${data.removed} overflow slot${data.removed !== 1 ? "s" : ""}.`);
      } else {
        setOverflowMessage("No empty overflow slots to remove.");
      }
      setTimeout(() => setOverflowMessage(""), 4000);
    } catch {
      setOverflowMessage("Failed to reset overflow.");
    }
    setResettingOverflow(false);
  };

  // PIN gate
  if (!role) {
    return (
      <div className="max-w-sm mx-auto mt-24 px-4">
        <h1 className="text-2xl font-bold mb-6 text-center">Setup Access</h1>
        <div className="border border-border rounded-lg p-6 bg-card">
          <label className="block text-sm font-medium mb-2">Enter PIN</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full p-3 rounded-lg border border-border text-lg text-center tracking-widest"
            placeholder="****"
            autoFocus
          />
          {pinError && <p className="text-danger text-sm mt-2">{pinError}</p>}
          <button
            onClick={handleLogin}
            className="w-full mt-4 p-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover"
            title="Submit PIN to access setup"
          >
            Enter
          </button>
        </div>
        <div className="text-center mt-4">
          <Link href="/" className="text-sm text-primary hover:underline">Back to Games</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Setup</h1>
          <p className="text-sm text-muted">
            Logged in as <span className="font-medium capitalize">{role}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/log" className="text-sm text-primary hover:underline">Activity Log</Link>
          <Link href="/reports" className="text-sm text-primary hover:underline">Reports</Link>
          <Link href="/" className="text-sm text-primary hover:underline">Games</Link>
          <button
            onClick={() => { setRole(null); sessionStorage.removeItem("setupRole"); }}
            className="text-sm text-danger hover:underline"
            title="Sign out and return to PIN login"
          >
            Logout
          </button>
        </div>
      </div>


      {/* Settings Tab */}
      {activeTab === "settings" && settings && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Club Name</label>
              <input
                type="text"
                value={settings.clubName}
                onChange={(e) => setSettings({ ...settings, clubName: e.target.value })}
                className="w-full p-2 rounded-lg border border-border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Earliest Start Time</label>
              <input
                type="time"
                value={settings.timeSlotEarliestStart}
                onChange={(e) => setSettings({ ...settings, timeSlotEarliestStart: e.target.value })}
                className="w-full p-2 rounded-lg border border-border"
              />
              <p className="text-xs text-muted mt-1">First option in the time picker dropdown</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Latest Start Time</label>
              <input
                type="time"
                value={settings.timeSlotLatestStart}
                onChange={(e) => setSettings({ ...settings, timeSlotLatestStart: e.target.value })}
                className="w-full p-2 rounded-lg border border-border"
              />
              <p className="text-xs text-muted mt-1">Last option in the time picker dropdown</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Game Duration (minutes)</label>
              <input
                type="number"
                min={30}
                max={240}
                step={15}
                value={settings.timeSlotDurationMinutes}
                onChange={(e) => setSettings({ ...settings, timeSlotDurationMinutes: Number(e.target.value) })}
                className="w-full p-2 rounded-lg border border-border"
              />
              <p className="text-xs text-muted mt-1">End time = start + this many minutes</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Default Time Slot</label>
              <select
                value={settings.defaultTimeSlot}
                onChange={(e) => setSettings({ ...settings, defaultTimeSlot: e.target.value })}
                className="w-full p-2 rounded-lg border border-border"
              >
                {generateTimeOptions(settings.timeSlotEarliestStart, settings.timeSlotLatestStart, settings.timeSlotDurationMinutes).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1">Applied to new game slots (can be overridden per cell)</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Courts Available</label>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.courtsAvailable}
                onChange={(e) => setSettings({ ...settings, courtsAvailable: Number(e.target.value) })}
                className="w-full p-2 rounded-lg border border-border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Players Per Game</label>
              <input
                type="number"
                min={2}
                max={8}
                value={settings.playersPerGame}
                onChange={(e) => setSettings({ ...settings, playersPerGame: Number(e.target.value) })}
                className="w-full p-2 rounded-lg border border-border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Days Ahead</label>
              <input
                type="number"
                min={1}
                max={30}
                value={settings.daysAhead}
                onChange={(e) => setSettings({ ...settings, daysAhead: Number(e.target.value) })}
                className="w-full p-2 rounded-lg border border-border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reservation Cutoff (hours)</label>
              <input
                type="number"
                min={0}
                max={72}
                value={settings.reservationCutoffHours}
                onChange={(e) => setSettings({ ...settings, reservationCutoffHours: Number(e.target.value) })}
                className="w-full p-2 rounded-lg border border-border"
                title="How many hours before a game players can no longer withdraw"
              />
              <p className="text-xs text-muted mt-1">Players cannot withdraw from a game within this many hours of game time. Players can always join. Set to 0 to allow withdrawals up to game time.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reminder Time (24h)</label>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => setSettings({ ...settings, reminderTime: e.target.value })}
                className="w-full p-2 rounded-lg border border-border"
                title="Time of day to send email reminders to players about upcoming games"
              />
              <p className="text-xs text-muted mt-1">Email reminders are sent at this time the day before each game.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Error Report Email</label>
              <input
                type="email"
                value={settings.errorReportEmail || ""}
                onChange={(e) => setSettings({ ...settings, errorReportEmail: e.target.value || null })}
                className="w-full p-2 rounded-lg border border-border"
                placeholder="maintainer@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Dropdown Reset (seconds)</label>
              <input
                type="number"
                min={0}
                max={300}
                value={settings.dropdownResetSeconds}
                onChange={(e) => setSettings({ ...settings, dropdownResetSeconds: Number(e.target.value) })}
                className="w-full p-2 rounded-lg border border-border"
                title="Seconds before the player dropdown resets to default after selection"
              />
              <p className="text-xs text-muted mt-1">Player dropdown resets after this many seconds. Set to 0 to disable.</p>
            </div>
          </div>

          {/* Weather forecast location */}
          <div className="border-t border-border pt-4 mt-4">
            <h3 className="font-semibold mb-3">Rain Forecast</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">ZIP Code</label>
                <input
                  type="text"
                  value={settings.weatherZip}
                  onChange={(e) => setSettings({ ...settings, weatherZip: e.target.value })}
                  className="w-full p-2 rounded-lg border border-border"
                  placeholder="07052"
                  maxLength={10}
                  title="ZIP code where games are played. The forecast is generated for this location."
                />
                <p className="text-xs text-muted mt-1">
                  Used to look up rain probability around game times.
                  {settings.weatherLat && settings.weatherLon && ` (${settings.weatherLat}, ${settings.weatherLon})`}
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={settings.weatherEnabled}
                    onChange={(e) => setSettings({ ...settings, weatherEnabled: e.target.checked })}
                  />
                  Show rain forecast on home page
                </label>
                <p className="text-xs text-muted mt-1">
                  Each game shows the highest chance of rain in the 6 hours before the game and during it.
                </p>
              </div>
            </div>
          </div>

          {/* Admin assignment — Creator only */}
          {role === "creator" && (
            <div className="border-t border-border pt-4 mt-4">
              <h3 className="font-semibold mb-3">Admin Assignment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Creator Player</label>
                  <select
                    value={settings.creatorPlayerId ?? ""}
                    onChange={(e) => setSettings({ ...settings, creatorPlayerId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full p-2 rounded-lg border border-border"
                  >
                    <option value="">— None —</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Creator PIN</label>
                  <input
                    type="text"
                    value={settings.creatorPin}
                    onChange={(e) => setSettings({ ...settings, creatorPin: e.target.value })}
                    className="w-full p-2 rounded-lg border border-border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Maintainer Player</label>
                  <select
                    value={settings.maintainerPlayerId ?? ""}
                    onChange={(e) => setSettings({ ...settings, maintainerPlayerId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full p-2 rounded-lg border border-border"
                  >
                    <option value="">— None —</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Maintainer PIN</label>
                  <input
                    type="text"
                    value={settings.maintainerPin}
                    onChange={(e) => setSettings({ ...settings, maintainerPin: e.target.value })}
                    className="w-full p-2 rounded-lg border border-border"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover disabled:opacity-50"
              title="Save all settings changes to the database"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            <button
              onClick={handleResetOverflow}
              disabled={resettingOverflow}
              className="px-4 py-2 border border-orange-400 text-orange-600 rounded-lg font-medium hover:bg-orange-50 disabled:opacity-50"
              title="Remove all empty overflow game slots and revert to configured number of games"
            >
              {resettingOverflow ? "Resetting..." : "Reset Overflow"}
            </button>
            {overflowMessage && (
              <span className="text-sm text-green-600">{overflowMessage}</span>
            )}
          </div>

          {backupMessage && (
            <div className="mt-3 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-900">
              <div className="font-medium mb-1">{backupMessage}</div>
              <div className="text-xs text-green-700">
                <strong>File location:</strong> Your browser&apos;s Downloads folder (typically <code>~/Downloads</code> on macOS, <code>Downloads</code> on Windows, or the iOS/Android Files app under Downloads).
                The full dump includes every table: settings, players, game slots, signups, notifications, activity log, email log, email templates, and game stats.
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
