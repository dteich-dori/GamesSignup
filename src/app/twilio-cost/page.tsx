"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Batch {
  id: number;
  sentAt: string;
  recipientGroup: string;
  recipientCount: number;
  channel: "text" | "text+email" | "email" | "other";
  estimatedSmsCount: number;
}

interface CostData {
  startDate: string;
  monthsElapsed: number;
  smsOnlyCount: number;
  dualSendCount: number;
  estimatedSmsSegments: number;
  batches: Batch[];
}

const LS_KEY = "gs-twilio-cost-rates-v1";
const LS_DATE_KEY = "gs-twilio-cost-startdate-v1";
const LS_WINTER_START_KEY = "gs-twilio-cost-winter-start-v1";
const LS_WINTER_END_KEY = "gs-twilio-cost-winter-end-v1";

// Default winter exclusion window = the TennisScheduler season. Months that
// fall inside this window are billed to the Scheduler app, not here.
const DEFAULT_WINTER_START = "2026-09-14";
const DEFAULT_WINTER_END = "2027-05-30";

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.4375;

function monthsInBurdenWindow(
  twilioEnabledIso: string,
  endIso: string,
  winterStartIso: string,
  winterEndIso: string
): number {
  const start = new Date(twilioEnabledIso + "T00:00:00").getTime();
  const end = new Date(endIso + "T23:59:59").getTime();
  const winterStart = new Date(winterStartIso + "T00:00:00").getTime();
  const winterEnd = new Date(winterEndIso + "T23:59:59").getTime();
  const totalMs = Math.max(0, end - start);
  const overlapMs = Math.max(
    0,
    Math.min(end, winterEnd) - Math.max(start, winterStart)
  );
  return Math.max(0, (totalMs - overlapMs) / MS_PER_MONTH);
}

interface Rates {
  brandRegistration: number;
  campaignRegistration: number;
  phoneNumberMonthly: number;
  campaignMonthly: number;
  perSmsTwilio: number;
  perSmsCarrierFee: number;
  avgSegmentsPerText: number;
}

const DEFAULT_RATES: Rates = {
  brandRegistration: 4,
  campaignRegistration: 15,
  phoneNumberMonthly: 1.15,
  campaignMonthly: 1.5,
  perSmsTwilio: 0.0083,
  perSmsCarrierFee: 0.005,
  avgSegmentsPerText: 1.2,
};

const DEFAULT_START_DATE = "2026-06-01";

const fmt$ = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TwilioCostPage() {
  const [startDate, setStartDate] = useState<string>(DEFAULT_START_DATE);
  const [winterStart, setWinterStart] = useState<string>(DEFAULT_WINTER_START);
  const [winterEnd, setWinterEnd] = useState<string>(DEFAULT_WINTER_END);
  const [data, setData] = useState<CostData | null>(null);
  const [error, setError] = useState("");
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);
  const [showBatches, setShowBatches] = useState(false);

  // Restore saved rates + start date
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setRates((prev) => ({ ...prev, ...(JSON.parse(raw) as Partial<Rates>) }));
      const d = localStorage.getItem(LS_DATE_KEY);
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setStartDate(d);
      const ws = localStorage.getItem(LS_WINTER_START_KEY);
      if (ws && /^\d{4}-\d{2}-\d{2}$/.test(ws)) setWinterStart(ws);
      const we = localStorage.getItem(LS_WINTER_END_KEY);
      if (we && /^\d{4}-\d{2}-\d{2}$/.test(we)) setWinterEnd(we);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_WINTER_START_KEY, winterStart);
      localStorage.setItem(LS_WINTER_END_KEY, winterEnd);
    } catch {
      /* ignore */
    }
  }, [winterStart, winterEnd]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(rates));
    } catch {
      /* ignore */
    }
  }, [rates]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_DATE_KEY, startDate);
    } catch {
      /* ignore */
    }
  }, [startDate]);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/communications/twilio-cost?startDate=${startDate}`);
      if (!res.ok) {
        setError("Failed to load Twilio cost data.");
        return;
      }
      setData((await res.json()) as CostData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [startDate]);

  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) load();
  }, [load, startDate]);

  const updateRate = (key: keyof Rates, val: number) =>
    setRates((r) => ({ ...r, [key]: Number.isFinite(val) ? val : 0 }));

  const oneTime = rates.brandRegistration + rates.campaignRegistration;
  const monthly = rates.phoneNumberMonthly + rates.campaignMonthly;

  // Total months since Twilio was enabled, and the GamesSignup-burdened
  // portion (excluding the winter window which belongs to the Scheduler).
  const totalMonthsElapsed = data?.monthsElapsed ?? 0;
  const todayIso = new Date().toISOString().slice(0, 10);
  const burdenMonthsElapsed =
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(winterStart) &&
    /^\d{4}-\d{2}-\d{2}$/.test(winterEnd)
      ? monthsInBurdenWindow(startDate, todayIso, winterStart, winterEnd)
      : totalMonthsElapsed;

  const accruedMonthly = monthly * burdenMonthsElapsed;
  const segments = (data?.estimatedSmsSegments ?? 0) * rates.avgSegmentsPerText;
  const perSmsAll = rates.perSmsTwilio + rates.perSmsCarrierFee;
  const accruedSms = segments * perSmsAll;
  const totalAccrued = oneTime + accruedMonthly + accruedSms;

  // Annual projection: 12 months minus the winter window length (cycled).
  const winterLengthMonths =
    /^\d{4}-\d{2}-\d{2}$/.test(winterStart) &&
    /^\d{4}-\d{2}-\d{2}$/.test(winterEnd)
      ? Math.max(
          0,
          (new Date(winterEnd + "T23:59:59").getTime() -
            new Date(winterStart + "T00:00:00").getTime()) /
            MS_PER_MONTH
        )
      : 0;
  const projectedBurdenMonths = Math.max(0, 12 - winterLengthMonths);
  const projectedMonthly = monthly * projectedBurdenMonths;
  const projectedSms = segments > 0 && burdenMonthsElapsed > 0
    ? (segments / burdenMonthsElapsed) * projectedBurdenMonths * perSmsAll
    : 0;
  const projectedTotal = oneTime + projectedMonthly + projectedSms;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Twilio SMS Cost Estimate</h1>
        <div className="flex gap-3">
          <Link href="/reports" className="text-sm text-primary hover:underline">Reports</Link>
          <Link href="/communications" className="text-sm text-primary hover:underline">Communications</Link>
          <Link href="/" className="text-sm text-primary hover:underline">Games</Link>
        </div>
      </div>

      <p className="text-sm text-muted mb-4">
        Estimates GamesSignup&apos;s share of the (shared) Twilio cost.
        The account is shared with the Scheduler app: months that fall
        within the Scheduler&apos;s winter window are billed there, not
        here. Setup + monthly fees default to GamesSignup. Adjust the
        &ldquo;Twilio enabled date&rdquo; so only sends after Twilio went
        live are counted (earlier sends used the free carrier gateway).
        Per-segment counts assume an average of{" "}
        <strong>{rates.avgSegmentsPerText.toFixed(1)}</strong> segments
        per text (one segment ≈ 160 chars).
      </p>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Date windows */}
      <section className="border border-border rounded-lg p-4 mb-6 space-y-3">
        <label className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold w-56">Twilio enabled date:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold w-56">Scheduler winter window:</span>
          <input
            type="date"
            value={winterStart}
            onChange={(e) => setWinterStart(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm"
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            value={winterEnd}
            onChange={(e) => setWinterEnd(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm"
          />
          <span className="text-xs text-muted">
            ({winterLengthMonths.toFixed(1)} months excluded — burdened to Scheduler)
          </span>
        </label>
      </section>

      {/* Rates form */}
      <section className="border border-border rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">Rates (US$, editable)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <RateRow label="One-time: A2P 10DLC brand registration" value={rates.brandRegistration} step="0.01" onChange={(v) => updateRate("brandRegistration", v)} />
          <RateRow label="One-time: A2P 10DLC campaign registration" value={rates.campaignRegistration} step="0.01" onChange={(v) => updateRate("campaignRegistration", v)} />
          <RateRow label="Monthly: Phone number rental" value={rates.phoneNumberMonthly} step="0.01" onChange={(v) => updateRate("phoneNumberMonthly", v)} />
          <RateRow label="Monthly: Campaign / carrier maintenance" value={rates.campaignMonthly} step="0.01" onChange={(v) => updateRate("campaignMonthly", v)} />
          <RateRow label="Per segment: Twilio base SMS rate" value={rates.perSmsTwilio} step="0.0001" onChange={(v) => updateRate("perSmsTwilio", v)} />
          <RateRow label="Per segment: Carrier (A2P 10DLC) pass-through" value={rates.perSmsCarrierFee} step="0.0001" onChange={(v) => updateRate("perSmsCarrierFee", v)} />
          <RateRow label="Avg segments per text" value={rates.avgSegmentsPerText} step="0.1" onChange={(v) => updateRate("avgSegmentsPerText", v)} />
        </div>
        <button
          onClick={() => setRates(DEFAULT_RATES)}
          className="mt-3 text-xs text-primary hover:underline"
        >
          Reset to defaults
        </button>
      </section>

      {/* Accrued */}
      <section className="border border-border rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">Accrued to date</h2>
        {data ? (
          <table className="w-full text-sm">
            <tbody>
              <Row label="Twilio enabled" value={data.startDate} />
              <Row label="Total months elapsed" value={data.monthsElapsed.toFixed(1)} />
              <Row label="GamesSignup-burdened months (excluding winter)" value={burdenMonthsElapsed.toFixed(1)} bold />
              <Row label="SMS-only batch recipients" value={String(data.smsOnlyCount)} />
              <Row label="Email+Text batch recipients" value={String(data.dualSendCount)} />
              <Row label="Estimated SMS recipients (sum)" value={String(data.estimatedSmsSegments)} bold />
              <Row label={`× avg segments/text (${rates.avgSegmentsPerText})`} value={segments.toFixed(1)} />
              <tr><td colSpan={2}><hr className="my-2 border-border" /></td></tr>
              <Row label="One-time setup fees" value={fmt$(oneTime)} />
              <Row label={`Monthly fees × ${burdenMonthsElapsed.toFixed(1)} burden months`} value={fmt$(accruedMonthly)} />
              <Row label={`SMS segments × ${fmt$(perSmsAll)}`} value={fmt$(accruedSms)} />
              <tr><td colSpan={2}><hr className="my-2 border-border" /></td></tr>
              <Row label="Total accrued" value={fmt$(totalAccrued)} bold large />
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </section>

      {/* Projected */}
      <section className="border border-border rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">Projected annual (GamesSignup&apos;s share)</h2>
        {data ? (
          <table className="w-full text-sm">
            <tbody>
              <Row label="One-time setup fees" value={fmt$(oneTime)} />
              <Row label={`Monthly fees × ${projectedBurdenMonths.toFixed(1)} non-winter months`} value={fmt$(projectedMonthly)} />
              <Row label="Projected SMS cost (annualised from current burden usage)" value={fmt$(projectedSms)} />
              <tr><td colSpan={2}><hr className="my-2 border-border" /></td></tr>
              <Row label="Projected annual total" value={fmt$(projectedTotal)} bold large />
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </section>

      {/* Batches */}
      {data && data.batches.length > 0 && (
        <section className="border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Batch detail ({data.batches.length})</h2>
            <button
              onClick={() => setShowBatches((s) => !s)}
              className="text-sm text-primary hover:underline"
            >
              {showBatches ? "Hide" : "Show"}
            </button>
          </div>
          {showBatches && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted-bg">
                  <tr>
                    <th className="text-left px-2 py-1">Sent</th>
                    <th className="text-left px-2 py-1">Group / Channel</th>
                    <th className="text-right px-2 py-1">Recipients</th>
                    <th className="text-right px-2 py-1">Est. SMS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.batches.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-2 py-1">{b.sentAt}</td>
                      <td className="px-2 py-1">{b.recipientGroup}</td>
                      <td className="px-2 py-1 text-right">{b.recipientCount}</td>
                      <td className="px-2 py-1 text-right">{b.estimatedSmsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <p className="text-xs text-muted">
        SMS counts are estimates derived from the email_log&apos;s
        recipientGroup labels. Each recipient is counted once regardless
        of message length; the &ldquo;avg segments per text&rdquo;
        multiplier accounts for longer messages. The Email+Text count
        assumes every recipient also got an SMS, which over-counts when
        some had email-only profiles. For exact billing, check the{" "}
        <a
          href="https://console.twilio.com/us1/billing/usage"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          Twilio Console
        </a>.
      </p>
    </div>
  );
}

function RateRow({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="border border-border rounded px-2 py-1 text-sm w-28 text-right"
      />
    </label>
  );
}

function Row({
  label,
  value,
  bold = false,
  large = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <tr>
      <td className={`py-1 ${bold ? "font-semibold" : ""} ${large ? "text-base" : ""}`}>{label}</td>
      <td className={`py-1 text-right font-mono ${bold ? "font-semibold" : ""} ${large ? "text-base" : ""}`}>{value}</td>
    </tr>
  );
}
