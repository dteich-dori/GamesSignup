"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ReportType = "player-frequency" | "cancellation-rate" | "court-utilization";

interface FrequencyRow {
  playerId: number;
  playerName: string;
  gameCount: number;
}

interface CancellationRow {
  playerId: number;
  playerName: string;
  cancellations: number;
}

interface UtilizationRow {
  date: string;
  courtNumber: number;
  signupCount: number;
  maxPlayers: number;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("player-frequency");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: reportType });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/reports?${params}`);
    const result = await res.json();
    setData(result);
    setLoading(false);
  }, [reportType, from, to]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-3">
          <Link href="/setup" className="text-sm text-primary hover:underline">Setup</Link>
          <Link href="/log" className="text-sm text-primary hover:underline">Activity Log</Link>
          <Link href="/" className="text-sm text-primary hover:underline">Games</Link>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
          className="p-2 rounded-lg border border-border text-sm"
        >
          <option value="player-frequency">Games per Player</option>
          <option value="cancellation-rate">Cancellation Rate</option>
          <option value="court-utilization">Court Utilization</option>
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="p-2 rounded-lg border border-border text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="p-2 rounded-lg border border-border text-sm"
        />
      </div>

      {loading ? (
        <div className="text-muted text-center py-8">Loading...</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          {reportType === "player-frequency" && (
            <table className="w-full text-sm">
              <thead className="bg-muted-bg">
                <tr>
                  <th className="text-left p-3 font-medium">Player</th>
                  <th className="text-right p-3 font-medium">Games</th>
                </tr>
              </thead>
              <tbody>
                {(data as FrequencyRow[]).map((row) => (
                  <tr key={row.playerId} className="border-t border-border">
                    <td className="p-3">{row.playerName}</td>
                    <td className="p-3 text-right font-mono">{row.gameCount}</td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={2} className="p-6 text-center text-muted">No data</td></tr>
                )}
              </tbody>
            </table>
          )}

          {reportType === "cancellation-rate" && (
            <table className="w-full text-sm">
              <thead className="bg-muted-bg">
                <tr>
                  <th className="text-left p-3 font-medium">Player</th>
                  <th className="text-right p-3 font-medium">Cancellations</th>
                </tr>
              </thead>
              <tbody>
                {(data as CancellationRow[]).map((row) => (
                  <tr key={row.playerId} className="border-t border-border">
                    <td className="p-3">{row.playerName}</td>
                    <td className="p-3 text-right font-mono">{row.cancellations}</td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={2} className="p-6 text-center text-muted">No data</td></tr>
                )}
              </tbody>
            </table>
          )}

          {reportType === "court-utilization" && (
            <table className="w-full text-sm">
              <thead className="bg-muted-bg">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-center p-3 font-medium">Court</th>
                  <th className="text-right p-3 font-medium">Players</th>
                  <th className="text-right p-3 font-medium">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {(data as UtilizationRow[]).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-3">{row.date}</td>
                    <td className="p-3 text-center">Court {row.courtNumber}</td>
                    <td className="p-3 text-right font-mono">{row.signupCount}/{row.maxPlayers}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-muted-bg rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(row.signupCount / row.maxPlayers) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted">
                          {Math.round((row.signupCount / row.maxPlayers) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted">No data</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
