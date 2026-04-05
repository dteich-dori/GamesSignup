"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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
}

interface Player {
  id: number;
  name: string;
  email: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function SetupPage() {
  const [role, setRole] = useState<"creator" | "maintainer" | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "players">("settings");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [saving, setSaving] = useState(false);

  // New player form
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerEmail, setNewPlayerEmail] = useState("");

  // Edit player
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

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
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    // Regenerate slots (will remove empty excess courts)
    await fetch("/api/game-slots?generate=true");
    setSaving(false);
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPlayerName.trim(), email: newPlayerEmail.trim() || null }),
    });
    if (!res.ok) {
      const err = await res.json();
      return alert(err.error);
    }
    setNewPlayerName("");
    setNewPlayerEmail("");
    fetchPlayers();
  };

  const handleUpdatePlayer = async (player: Player) => {
    await fetch("/api/players", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(player),
    });
    setEditingPlayer(null);
    fetchPlayers();
  };

  const handleToggleActive = async (player: Player) => {
    await fetch("/api/players", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: player.id, isActive: !player.isActive }),
    });
    fetchPlayers();
  };

  const handleDeletePlayer = async (id: number) => {
    if (!confirm("Delete this player? This will remove all their signups and history.")) return;
    await fetch(`/api/players?id=${id}`, { method: "DELETE" });
    fetchPlayers();
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

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "settings" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
          }`}
          title="Configure club name, courts, time slots, and admin PINs"
        >
          Settings
        </button>
        <button
          onClick={() => setActiveTab("players")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "players" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
          }`}
          title="Add, edit, or remove players"
        >
          Players ({players.length})
        </button>
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
              <label className="block text-sm font-medium mb-1">Default Time Slot</label>
              <input
                type="text"
                value={settings.defaultTimeSlot}
                onChange={(e) => setSettings({ ...settings, defaultTimeSlot: e.target.value })}
                className="w-full p-2 rounded-lg border border-border"
              />
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
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reminder Time (24h)</label>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => setSettings({ ...settings, reminderTime: e.target.value })}
                className="w-full p-2 rounded-lg border border-border"
              />
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

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover disabled:opacity-50"
            title="Save all settings changes to the database"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}

      {/* Players Tab */}
      {activeTab === "players" && (
        <div>
          {/* Add player form */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
              placeholder="Player name"
              className="flex-1 p-2 rounded-lg border border-border"
            />
            <input
              type="email"
              value={newPlayerEmail}
              onChange={(e) => setNewPlayerEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
              placeholder="Email"
              className="flex-1 p-2 rounded-lg border border-border"
            />
            <button
              onClick={handleAddPlayer}
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover"
              title="Add a new player to the roster"
            >
              Add
            </button>
          </div>

          {/* Players list */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted-bg">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-center p-3 font-medium">Active</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id} className="border-t border-border">
                    {editingPlayer?.id === player.id ? (
                      <>
                        <td className="p-2">
                          <input
                            type="text"
                            value={editingPlayer.name}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                            className="w-full p-1 rounded border border-border"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="email"
                            value={editingPlayer.email || ""}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, email: e.target.value || null })}
                            className="w-full p-1 rounded border border-border"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={editingPlayer.isActive}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, isActive: e.target.checked })}
                          />
                        </td>
                        <td className="p-2 text-right space-x-2">
                          <button onClick={() => handleUpdatePlayer(editingPlayer)} className="text-success font-medium" title="Save changes to this player">Save</button>
                          <button onClick={() => setEditingPlayer(null)} className="text-muted" title="Discard changes">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={`p-3 ${!player.isActive ? "text-muted line-through" : ""}`}>{player.name}</td>
                        <td className="p-3 text-muted">{player.email || "—"}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => handleToggleActive(player)} title={player.isActive ? "Click to deactivate this player" : "Click to reactivate this player"}>
                            {player.isActive ? (
                              <span className="text-success">Active</span>
                            ) : (
                              <span className="text-muted">Inactive</span>
                            )}
                          </button>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button onClick={() => setEditingPlayer({ ...player })} className="text-primary" title="Edit this player's name, email, or status">Edit</button>
                          <button onClick={() => handleDeletePlayer(player.id)} className="text-danger" title="Permanently remove this player">Delete</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {players.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted">No players added yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
