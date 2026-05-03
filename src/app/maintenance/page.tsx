"use client";

import { useState, useEffect } from "react";

interface DeleteLogEntry {
  id: number;
  action: string;
  details: string;
  createdAt: string;
}

export default function MaintenancePage() {
  const [role, setRole] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deleteLogs, setDeleteLogs] = useState<DeleteLogEntry[]>([]);

  useEffect(() => {
    setRole(sessionStorage.getItem("setupRole"));
    fetchDeleteLogs();
  }, []);

  const fetchDeleteLogs = async () => {
    const res = await fetch("/api/activity-log?action=DELETE_GAMES");
    if (res.ok) {
      const data = await res.json();
      setDeleteLogs(data);
    }
  };

  if (role !== "creator" && role !== "maintainer") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted text-lg">Access restricted. Please sign in as Creator or Maintainer.</div>
      </div>
    );
  }

  const handleDeleteOldest = async () => {
    // Compute yesterday in local YYYY-MM-DD — this button never touches today or future.
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, "0");
    const dd = String(yesterday.getDate()).padStart(2, "0");
    const yesterdayStr = `${yyyy}-${mm}-${dd}`;
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Cap the to-date at yesterday so today and future are protected.
    const userToDate = toDate || yesterdayStr;
    const effectiveToDate = userToDate >= todayStr ? yesterdayStr : userToDate;
    const wasCapped = userToDate >= todayStr;

    // Validate fromDate isn't in the future or after the effective to-date.
    if (fromDate && fromDate > effectiveToDate) {
      alert(`Start date (${fromDate}) is after the end date (${effectiveToDate}). Nothing to delete.`);
      return;
    }

    let rangeDesc: string;
    if (!fromDate && !toDate) {
      rangeDesc = `ALL past games (everything on or before ${yesterdayStr})`;
    } else if (fromDate && !toDate) {
      rangeDesc = `games from ${fromDate} through ${yesterdayStr}`;
    } else if (!fromDate && toDate) {
      rangeDesc = wasCapped
        ? `games up to ${effectiveToDate} (capped at yesterday — today and future are protected)`
        : `games up to and including ${effectiveToDate}`;
    } else {
      rangeDesc = wasCapped
        ? `games from ${fromDate} to ${effectiveToDate} (capped at yesterday)`
        : `games from ${fromDate} to ${effectiveToDate}`;
    }

    if (!confirm(`This will permanently delete ${rangeDesc} and their signups. Are you sure?`)) return;

    const body: Record<string, unknown> = { source: "manual", toDate: effectiveToDate };
    if (fromDate) body.fromDate = fromDate;

    const delRes = await fetch("/api/game-slots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!delRes.ok) {
      const err = await delRes.json().catch(() => ({}));
      alert(`Delete failed: ${err.error || delRes.status}`);
      return;
    }

    const delData = await delRes.json();

    if (delData.deleted === 0) {
      alert(`Nothing to delete. No game slots matched the selected range.`);
    } else {
      alert(`Deleted ${delData.deleted} game slot(s) (${delData.fromDate} to ${delData.toDate}).`);
    }
    fetchDeleteLogs();
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Maintenance</h1>

      {/* Delete section */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Delete Oldest Games</h2>
        <p className="text-sm text-muted mb-4">
          Permanently removes <strong>past</strong> game slots and their signups. Today and future games are always protected.
          Leave both dates empty to delete every past game. Pick a start date to limit how far back to go, an end date to stop earlier than yesterday, or both for a specific window.
        </p>

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-sm font-medium mb-1">From date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="p-2 rounded-lg border border-border"
              placeholder="Earliest"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="p-2 rounded-lg border border-border"
              placeholder="Today"
            />
          </div>
          <button
            onClick={handleDeleteOldest}
            className="px-4 py-2 bg-danger text-white rounded-lg text-sm font-medium"
            title="Permanently delete all game slots and signups within the selected date range"
          >
            Delete Oldest
          </button>
        </div>
        <p className="text-xs text-muted mt-2">
          {!fromDate && !toDate && "Will delete every game on or before yesterday."}
          {fromDate && !toDate && `Will delete games from ${fromDate} through yesterday.`}
          {!fromDate && toDate && `Will delete games up to ${toDate} (capped at yesterday if today or later).`}
          {fromDate && toDate && `Will delete games from ${fromDate} to ${toDate} (capped at yesterday if today or later).`}
        </p>
      </div>

      {/* Deletion log */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Deletion Log</h2>
        {deleteLogs.length === 0 ? (
          <p className="text-sm text-muted">No deletions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {deleteLogs.map((log) => {
              const details = JSON.parse(log.details);
              return (
                <div key={log.id} className="flex justify-between items-center text-sm border-b border-border pb-2">
                  <div>
                    <span className="font-medium">{details.deleted} slot(s) deleted</span>
                    <span className="text-muted ml-2">
                      {details.fromDate} &rarr; {details.toDate}
                    </span>
                  </div>
                  <div className="text-xs text-muted text-right">
                    <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                    <div className="capitalize">{details.source || "manual"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
