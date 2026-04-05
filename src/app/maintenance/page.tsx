"use client";

import { useState, useEffect } from "react";

export default function MaintenancePage() {
  const [role, setRole] = useState<string | null>(null);
  const [deleteBeforeDate, setDeleteBeforeDate] = useState("");
  const [startDate, setStartDate] = useState("");

  useEffect(() => {
    setRole(sessionStorage.getItem("setupRole"));
    // Fetch current start date from settings
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.startDate) setStartDate(data.startDate);
      });
  }, []);

  if (role !== "creator" && role !== "maintainer") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted text-lg">Access restricted. Please sign in as Creator or Maintainer.</div>
      </div>
    );
  }

  const handleDeleteOldest = async () => {
    if (!deleteBeforeDate) {
      alert("Please select a date first");
      return;
    }
    if (!confirm(`This will permanently delete all game slots before ${deleteBeforeDate} and their signups. Are you sure?`)) return;

    // Update start date in settings
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: deleteBeforeDate }),
    });

    // Delete old slots
    const delRes = await fetch("/api/game-slots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beforeDate: deleteBeforeDate }),
    });
    const delData = await delRes.json();

    // Generate new slots from the new start date
    await fetch("/api/game-slots?generate=true");

    setStartDate(deleteBeforeDate);
    alert(`Deleted ${delData.deleted} old game slot(s). New slots generated from ${deleteBeforeDate}.`);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Maintenance</h1>

      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Delete Oldest Games</h2>
        <p className="text-sm text-muted mb-4">
          Permanently removes all game slots (and their signups) before the selected date.
          Games on or after this date are preserved.
        </p>

        {startDate && (
          <p className="text-sm mb-4">
            Current start date: <span className="font-semibold">{startDate}</span>
          </p>
        )}

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Delete games before:</label>
            <input
              type="date"
              value={deleteBeforeDate}
              onChange={(e) => setDeleteBeforeDate(e.target.value)}
              className="p-2 rounded-lg border border-border"
            />
          </div>
          <button
            onClick={handleDeleteOldest}
            className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium"
          >
            Delete Oldest
          </button>
        </div>
      </div>
    </div>
  );
}
