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
    let rangeDesc: string;
    const body: Record<string, unknown> = { source: "manual" };

    if (!fromDate && !toDate) {
      rangeDesc = "ALL game slots (past and future)";
      body.all = true;
    } else if (fromDate && !toDate) {
      rangeDesc = `from ${fromDate} onward`;
      body.fromDate = fromDate;
    } else if (!fromDate && toDate) {
      rangeDesc = `up to and including ${toDate}`;
      body.toDate = toDate;
    } else {
      rangeDesc = `from ${fromDate} to ${toDate}`;
      body.fromDate = fromDate;
      body.toDate = toDate;
    }

    if (!confirm(`This will permanently delete ${rangeDesc} and their signups. Are you sure?`)) return;

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

    if (delData.deleted > 0 && toDate) {
      // If user specified an end date, advance the start date past it.
      // (Skip when 'all' or 'fromDate only' — those don't have a clean cutoff.)
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: toDate }),
      });
    }

    // Regenerate slots from today (only relevant if we wiped future slots too)
    if (delData.deleted > 0) {
      await fetch("/api/game-slots?generate=true");
    }

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
          Permanently removes game slots and their signups within the date range.
          <strong> Leave both dates empty to delete ALL game slots (past and future).</strong>
          Leave only the start date empty to delete up through the end date; leave only the end date empty to delete from the start date onward.
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
          {!fromDate && !toDate && <span className="text-danger font-semibold">Will delete ALL game slots (past and future).</span>}
          {fromDate && !toDate && `Will delete from ${fromDate} onward.`}
          {!fromDate && toDate && `Will delete from earliest up to and including ${toDate}.`}
          {fromDate && toDate && `Will delete from ${fromDate} to ${toDate}.`}
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
