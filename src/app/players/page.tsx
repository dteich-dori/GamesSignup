"use client";

import { useState, useEffect, useCallback } from "react";

interface Player {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  carrier: string | null;
  isActive: boolean;
  createdAt: string;
}

const CARRIERS = [
  { value: "", label: "— Carrier —" },
  { value: "verizon", label: "Verizon" },
  { value: "att", label: "AT&T" },
  { value: "tmobile", label: "T-Mobile" },
  { value: "sprint", label: "Sprint" },
  { value: "uscellular", label: "US Cellular" },
  { value: "boost", label: "Boost Mobile" },
  { value: "cricket", label: "Cricket" },
  { value: "metro", label: "Metro by T-Mobile" },
];

export default function PlayersPage() {
  const [role, setRole] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerEmail, setNewPlayerEmail] = useState("");
  const [newPlayerPhone, setNewPlayerPhone] = useState("");
  const [newPlayerCarrier, setNewPlayerCarrier] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  useEffect(() => {
    setRole(sessionStorage.getItem("setupRole"));
  }, []);

  const fetchPlayers = useCallback(async () => {
    const res = await fetch("/api/players");
    const data = await res.json();
    setPlayers(data);
  }, []);

  useEffect(() => {
    if (role === "creator" || role === "maintainer") {
      fetchPlayers();
    }
  }, [role, fetchPlayers]);

  if (role !== "creator" && role !== "maintainer") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted text-lg">Access restricted. Please sign in as Creator or Maintainer.</div>
      </div>
    );
  }

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPlayerName.trim(),
        email: newPlayerEmail.trim() || null,
        phone: newPlayerPhone.trim() || null,
        carrier: newPlayerCarrier || null,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      return alert(err.error);
    }
    setNewPlayerName("");
    setNewPlayerEmail("");
    setNewPlayerPhone("");
    setNewPlayerCarrier("");
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
    if (!confirm("Are you sure you want to delete this player?")) return;
    await fetch(`/api/players?id=${id}`, { method: "DELETE" });
    fetchPlayers();
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Players</h1>

      {/* Add/Edit player form */}
      <div className={`flex gap-2 mb-4 flex-wrap p-3 rounded-lg border ${editingPlayer ? "border-primary bg-blue-50" : "border-border"}`}>
        {editingPlayer ? (
          <>
            <div className="w-full text-xs font-semibold text-primary mb-1">Editing: {editingPlayer.name}</div>
            <input
              type="text"
              value={editingPlayer.name}
              onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
              placeholder="Player name"
              className="flex-1 min-w-[120px] p-2 rounded-lg border border-border"
            />
            <input
              type="email"
              value={editingPlayer.email || ""}
              onChange={(e) => setEditingPlayer({ ...editingPlayer, email: e.target.value || null })}
              placeholder="Email"
              className="flex-1 min-w-[120px] p-2 rounded-lg border border-border"
            />
            <input
              type="tel"
              value={editingPlayer.phone || ""}
              onChange={(e) => setEditingPlayer({ ...editingPlayer, phone: e.target.value || null })}
              placeholder="Phone (10 digits)"
              className="w-32 p-2 rounded-lg border border-border"
              title="10-digit phone number for SMS notifications"
            />
            <select
              value={editingPlayer.carrier || ""}
              onChange={(e) => setEditingPlayer({ ...editingPlayer, carrier: e.target.value || null })}
              className="w-32 p-2 rounded-lg border border-border"
              title="Mobile carrier for SMS gateway"
            >
              {CARRIERS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={editingPlayer.isActive}
                onChange={(e) => setEditingPlayer({ ...editingPlayer, isActive: e.target.checked })}
              />
              Active
            </label>
            <button
              onClick={() => handleUpdatePlayer(editingPlayer)}
              className="px-4 py-2 bg-success text-white rounded-lg font-medium"
              title="Save changes to this player"
            >
              Save
            </button>
            <button
              onClick={() => setEditingPlayer(null)}
              className="px-4 py-2 bg-gray-200 text-foreground rounded-lg font-medium"
              title="Discard changes"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
              placeholder="Player name"
              className="flex-1 min-w-[120px] p-2 rounded-lg border border-border"
            />
            <input
              type="email"
              value={newPlayerEmail}
              onChange={(e) => setNewPlayerEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
              placeholder="Email"
              className="flex-1 min-w-[120px] p-2 rounded-lg border border-border"
            />
            <input
              type="tel"
              value={newPlayerPhone}
              onChange={(e) => setNewPlayerPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
              placeholder="Phone (10 digits)"
              className="w-32 p-2 rounded-lg border border-border"
              title="10-digit phone number for SMS notifications"
            />
            <select
              value={newPlayerCarrier}
              onChange={(e) => setNewPlayerCarrier(e.target.value)}
              className="w-32 p-2 rounded-lg border border-border"
              title="Mobile carrier for SMS gateway"
            >
              {CARRIERS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={handleAddPlayer}
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover"
              title="Add a new player to the roster"
            >
              Add
            </button>
          </>
        )}
      </div>

      {/* Players list */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted-bg">
            <tr>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Phone</th>
              <th className="text-left p-3 font-medium">Carrier</th>
              <th className="text-center p-3 font-medium">Active</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className={`border-t border-border ${editingPlayer?.id === player.id ? "bg-blue-50" : ""}`}>
                <td className={`p-3 ${!player.isActive ? "text-muted line-through" : ""}`}>{player.name}</td>
                <td className="p-3 text-muted">{player.email || "—"}</td>
                <td className="p-3 text-muted">{player.phone || "—"}</td>
                <td className="p-3 text-muted">{CARRIERS.find((c) => c.value === player.carrier)?.label || "—"}</td>
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
                  <button onClick={() => { setEditingPlayer({ ...player }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-primary" title="Edit this player in the form above">Edit</button>
                  <button onClick={() => handleDeletePlayer(player.id)} className="text-danger" title="Permanently remove this player">Delete</button>
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">No players added yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
