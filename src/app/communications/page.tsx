"use client";

import { useState, useEffect, useCallback } from "react";

interface EmailSettings {
  emailFromName: string;
  emailReplyTo: string;
  emailTestAddress: string;
}

interface Recipient {
  name: string;
  email: string;
}

interface HistoryEntry {
  id: number;
  subject: string;
  body: string;
  recipientGroup: string;
  recipientCount: number;
  recipientList: string;
  fromName: string;
  replyTo: string;
  sentAt: string;
}

export default function CommunicationsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"compose" | "history">("compose");

  // Email settings
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    emailFromName: "Games Signup",
    emailReplyTo: "",
    emailTestAddress: "",
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Compose
  const [recipientGroup, setRecipientGroup] = useState("ALL");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [showRecipients, setShowRecipients] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendSms, setSendSms] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    setRole(sessionStorage.getItem("setupRole"));
  }, []);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setEmailSettings({
      emailFromName: data.emailFromName || "Games Signup",
      emailReplyTo: data.emailReplyTo || "",
      emailTestAddress: data.emailTestAddress || "",
    });
  }, []);

  const fetchRecipients = useCallback(async (group: string) => {
    const res = await fetch(`/api/communications/recipients?group=${group}`);
    const data = await res.json();
    setRecipients(data);
  }, []);

  const fetchHistory = useCallback(async () => {
    const res = await fetch("/api/communications/history");
    const data = await res.json();
    setHistory(data);
  }, []);

  useEffect(() => {
    if (role === "creator" || role === "maintainer") {
      fetchSettings();
      fetchHistory();
    }
  }, [role, fetchSettings, fetchHistory]);

  useEffect(() => {
    if (role === "creator" || role === "maintainer") {
      fetchRecipients(recipientGroup);
    }
  }, [recipientGroup, role, fetchRecipients]);

  if (role !== "creator" && role !== "maintainer") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted text-lg">Access restricted. Please sign in as Creator or Maintainer.</div>
      </div>
    );
  }

  const handleSaveSettings = async () => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailSettings),
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      alert("Subject and message body are required");
      return;
    }

    const count = recipients.length;
    if (count === 0) {
      alert("No recipients with valid email addresses");
      return;
    }

    if (count > 100) {
      alert(`Warning: Resend free tier is limited to 100 emails/day. You have ${count} recipients.`);
    }

    if (!confirm(`Send email to ${count} recipient(s) in group "${recipientGroup}"?`)) return;

    setSending(true);
    try {
      const res = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientGroup, subject, body, sendSms }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`Error: ${data.error}`);
        return;
      }

      let msg = `Sent: ${data.emailsSent} email(s)`;
      if (data.smsSent > 0) msg += `, ${data.smsSent} SMS`;
      msg += ".";
      if (data.warnings?.length) {
        msg += `\n\nWarnings:\n${data.warnings.join("\n")}`;
      }
      alert(msg);

      setSubject("");
      setBody("");
      fetchHistory();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Communications</h1>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("compose")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "compose" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
          }`}
          title="Compose and send emails to players"
        >
          Compose
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "history" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
          }`}
          title="View history of sent emails"
        >
          History
        </button>
      </div>

      {/* Compose Tab */}
      {activeTab === "compose" && (
        <div className="space-y-6">
          {/* Email Settings */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Email Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">From Name</label>
                <input
                  type="text"
                  value={emailSettings.emailFromName}
                  onChange={(e) => setEmailSettings({ ...emailSettings, emailFromName: e.target.value })}
                  className="w-full p-2 rounded-lg border border-border text-sm"
                  title="Display name that appears as the sender"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Reply-To Email</label>
                <input
                  type="email"
                  value={emailSettings.emailReplyTo}
                  onChange={(e) => setEmailSettings({ ...emailSettings, emailReplyTo: e.target.value })}
                  className="w-full p-2 rounded-lg border border-border text-sm"
                  placeholder="replies@example.com"
                  title="Where replies from players will be sent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Test Email</label>
                <input
                  type="email"
                  value={emailSettings.emailTestAddress}
                  onChange={(e) => setEmailSettings({ ...emailSettings, emailTestAddress: e.target.value })}
                  className="w-full p-2 rounded-lg border border-border text-sm"
                  placeholder="your@email.com"
                  title="Email address used when sending to the Test group"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleSaveSettings}
                className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium"
                title="Save email settings to the database"
              >
                Save Settings
              </button>
              {settingsSaved && <span className="text-success text-sm">Saved!</span>}
            </div>
            <p className="text-xs text-muted mt-2">
              Note: Emails are sent from onboarding@resend.dev (Resend free tier). The From Name appears as the sender display name.
            </p>
          </div>

          {/* Compose Form */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Compose Email</h2>

            {/* Recipient Group */}
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1">Send To</label>
              <div className="flex items-center gap-3">
                <select
                  value={recipientGroup}
                  onChange={(e) => setRecipientGroup(e.target.value)}
                  className="p-2 rounded-lg border border-border text-sm"
                  title="Select which group of players to email"
                >
                  <option value="ALL">All Players</option>
                  <option value="Test">Test (your email)</option>
                </select>
                <span className="text-sm text-muted">{recipients.length} recipient(s)</span>
                <button
                  onClick={() => setShowRecipients(!showRecipients)}
                  className="text-sm text-primary hover:underline"
                  title="Show or hide the list of recipients"
                >
                  {showRecipients ? "Hide" : "Show"} recipients
                </button>
              </div>
              {showRecipients && (
                <div className="mt-2 p-2 bg-muted-bg rounded text-xs max-h-32 overflow-y-auto">
                  {recipients.map((r, i) => (
                    <div key={i}>{r.name} &lt;{r.email}&gt;</div>
                  ))}
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-2 rounded-lg border border-border text-sm"
                placeholder="Email subject"
              />
            </div>

            {/* Body */}
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full p-2 rounded-lg border border-border text-sm min-h-[120px]"
                placeholder="Type your message..."
              />
            </div>

            {/* Send options */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                title="Send the email (and optionally SMS) to all selected recipients"
              >
                {sending ? "Sending..." : "Send"}
              </button>
              {recipientGroup !== "Test" && (
                <label className="flex items-center gap-2 text-sm cursor-pointer" title="Also send as text message to players with phone number and carrier configured">
                  <input
                    type="checkbox"
                    checked={sendSms}
                    onChange={(e) => setSendSms(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Also send SMS
                </label>
              )}
            </div>
            <p className="text-xs text-muted mt-2">SMS uses email-to-text gateways. Players need phone number and carrier set in Setup.</p>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {history.length === 0 ? (
            <div className="p-6 text-center text-muted text-sm">No emails sent yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted-bg">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Subject</th>
                  <th className="text-center p-3 font-medium">Group</th>
                  <th className="text-center p-3 font-medium">Sent</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-t border-border cursor-pointer hover:bg-muted-bg/50"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="p-3 text-muted">{new Date(entry.sentAt).toLocaleDateString()}</td>
                    <td className="p-3">{entry.subject}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        entry.recipientGroup === "URGENT" ? "bg-danger/10 text-danger" :
                        entry.recipientGroup === "REMINDER" ? "bg-primary/10 text-primary" :
                        "bg-muted-bg text-foreground"
                      }`}>
                        {entry.recipientGroup}
                      </span>
                    </td>
                    <td className="p-3 text-center">{entry.recipientCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {expandedId && (() => {
            const entry = history.find((h) => h.id === expandedId);
            if (!entry) return null;
            return (
              <div className="border-t border-border p-4 bg-muted-bg/30">
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div><span className="font-medium">From:</span> {entry.fromName}</div>
                  <div><span className="font-medium">Reply-To:</span> {entry.replyTo || "—"}</div>
                  <div className="col-span-2"><span className="font-medium">Recipients:</span> {entry.recipientList}</div>
                </div>
                <div className="text-sm whitespace-pre-wrap bg-card p-3 rounded border border-border">
                  {entry.body}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
