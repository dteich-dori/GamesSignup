"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface LogEntry {
  id: number;
  action: string;
  playerId: number | null;
  playerName: string | null;
  gameSlotId: number | null;
  details: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  JOIN: "bg-success text-white",
  WITHDRAW: "bg-danger text-white",
  SWAP: "bg-warning text-white",
  SETTINGS_CHANGE: "bg-primary text-white",
  PLAYER_ADD: "bg-blue-500 text-white",
};

export default function LogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterAction, setFilterAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [beforeDate, setBeforeDate] = useState("");

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterAction) params.set("action", filterAction);
    params.set("limit", "200");
    const res = await fetch(`/api/activity-log?${params}`);
    const data = await res.json();
    setLogs(data);
    setLoading(false);
  }, [filterAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return null;
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this log entry?")) return;
    await fetch(`/api/activity-log?id=${id}`, { method: "DELETE" });
    fetchLogs();
  };

  const handleClearAll = async () => {
    if (!confirm("Permanently delete ALL activity log entries? This cannot be undone.")) return;
    const res = await fetch("/api/activity-log?all=true", { method: "DELETE" });
    const data = await res.json();
    alert(`Deleted ${data.deleted} entries.`);
    fetchLogs();
  };

  const handleClearBefore = async () => {
    if (!beforeDate) return alert("Please pick a date first");
    if (!confirm(`Delete all log entries on or before ${beforeDate}?`)) return;
    const res = await fetch(`/api/activity-log?before=${beforeDate}`, { method: "DELETE" });
    const data = await res.json();
    alert(`Deleted ${data.deleted} entries.`);
    await fetchLogs();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <div className="flex gap-3">
          <Link href="/setup" className="text-sm text-primary hover:underline">Setup</Link>
          <Link href="/" className="text-sm text-primary hover:underline">Games</Link>
        </div>
      </div>

      {/* Filters + bulk delete */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="p-2 rounded-lg border border-border text-sm"
          title="Filter by action type"
        >
          <option value="">All Actions</option>
          <option value="JOIN">Join</option>
          <option value="WITHDRAW">Withdraw</option>
          <option value="SWAP">Swap</option>
          <option value="SETTINGS_CHANGE">Settings Change</option>
          <option value="DELETE_GAMES">Delete Games</option>
          <option value="SEND_EMAIL">Send Email</option>
          <option value="CRON_ERROR">Cron Error</option>
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={beforeDate}
            onChange={(e) => setBeforeDate(e.target.value)}
            className="p-2 rounded-lg border border-border text-sm"
            title="Date to delete entries before"
          />
          <button
            onClick={handleClearBefore}
            className="px-3 py-2 bg-warning text-white rounded-lg text-sm font-medium"
            title="Delete all log entries on or before the selected date"
          >
            Clear Through
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-2 bg-danger text-white rounded-lg text-sm font-medium"
            title="Delete all log entries"
          >
            Clear All
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted text-center py-8">Loading...</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted-bg">
              <tr>
                <th className="text-left p-3 font-medium">Time</th>
                <th className="text-left p-3 font-medium">Action</th>
                <th className="text-left p-3 font-medium">Player</th>
                <th className="text-left p-3 font-medium">Details</th>
                <th className="text-right p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const details = parseDetails(log.details);
                return (
                  <tr key={log.id} className="border-t border-border">
                    <td className="p-3 text-muted whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || "bg-muted-bg"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3">{log.playerName || "—"}</td>
                    <td className="p-3 text-muted">
                      {details?.date && `${details.date}`}
                      {details?.court && ` Court ${details.court}`}
                      {details?.fromCourt && ` Court ${details.fromCourt} → Court ${details.toCourt}`}
                      {details?.wasFull && " (was full)"}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-danger text-xs hover:underline"
                        title="Delete this log entry"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted">No activity yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
