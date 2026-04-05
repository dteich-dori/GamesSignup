"use client";

import { useState, useEffect, useCallback } from "react";

interface EmailSettings {
  emailFromName: string;
  emailReplyTo: string;
  emailTestAddress: string;
  emailTestPhone: string;
  emailTestCarrier: string;
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

interface Template {
  id: number;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
}

export default function CommunicationsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"compose" | "templates" | "history">("compose");

  // Email settings
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    emailFromName: "Games Signup",
    emailReplyTo: "",
    emailTestAddress: "",
    emailTestPhone: "",
    emailTestCarrier: "",
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Compose
  const [recipientGroup, setRecipientGroup] = useState("ALL");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [showRecipients, setShowRecipients] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"both" | "email" | "sms">("both");
  const [sending, setSending] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

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
      emailTestPhone: data.emailTestPhone || "",
      emailTestCarrier: data.emailTestCarrier || "",
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

  const fetchTemplates = useCallback(async () => {
    const res = await fetch("/api/communications/templates");
    const data = await res.json();
    setTemplates(data);
  }, []);

  useEffect(() => {
    if (role === "creator" || role === "maintainer") {
      fetchSettings();
      fetchHistory();
      fetchTemplates();
    }
  }, [role, fetchSettings, fetchHistory, fetchTemplates]);

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

    const channelLabel = channel === "email" ? "Email only" : channel === "sms" ? "Text only" : "Email + Text";
    if (!confirm(`Send "${channelLabel}" to ${count} recipient(s) in group "${recipientGroup}"?`)) return;

    setSending(true);
    try {
      const res = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientGroup, subject, body, channel }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`Error: ${data.error}`);
        return;
      }

      let msg = `Sent: ${data.emailsSent} email(s)`;
      if (data.smsSent > 0) msg += `, ${data.smsSent} text(s)`;
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

  const handleLoadTemplate = (template: Template) => {
    setSubject(template.subject);
    setBody(template.body);
    setActiveTab("compose");
  };

  const handleSaveAsTemplate = async (subj: string, bod: string) => {
    const name = prompt("Template name:", subj);
    if (!name?.trim()) return;
    setSavingTemplate(true);
    await fetch("/api/communications/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), subject: subj, body: bod }),
    });
    setSavingTemplate(false);
    fetchTemplates();
    alert("Saved as template!");
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/communications/templates?id=${id}`, { method: "DELETE" });
    fetchTemplates();
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
          title="Compose and send emails or texts to players"
        >
          Compose
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "templates" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
          }`}
          title="Manage saved message templates"
        >
          Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "history" ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
          }`}
          title="View history of sent messages"
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
              <div>
                <label className="block text-xs font-medium mb-1">Test Phone</label>
                <input
                  type="tel"
                  value={emailSettings.emailTestPhone || ""}
                  onChange={(e) => setEmailSettings({ ...emailSettings, emailTestPhone: e.target.value })}
                  className="w-full p-2 rounded-lg border border-border text-sm"
                  placeholder="10 digits"
                  title="Phone number for testing SMS"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Test Carrier</label>
                <select
                  value={emailSettings.emailTestCarrier || ""}
                  onChange={(e) => setEmailSettings({ ...emailSettings, emailTestCarrier: e.target.value })}
                  className="w-full p-2 rounded-lg border border-border text-sm"
                  title="Carrier for testing SMS"
                >
                  <option value="">— Carrier —</option>
                  <option value="verizon">Verizon</option>
                  <option value="att">AT&T</option>
                  <option value="tmobile">T-Mobile</option>
                  <option value="sprint">Sprint</option>
                  <option value="uscellular">US Cellular</option>
                  <option value="boost">Boost Mobile</option>
                  <option value="cricket">Cricket</option>
                  <option value="metro">Metro by T-Mobile</option>
                </select>
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
              Note: Emails are sent from your configured Gmail account. The From Name appears as the sender display name.
            </p>
          </div>

          {/* Compose Form */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">Compose Message</h2>

            {/* Template loader */}
            {templates.length > 0 && (
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1">Load Template</label>
                <select
                  onChange={(e) => {
                    const t = templates.find((t) => t.id === Number(e.target.value));
                    if (t) handleLoadTemplate(t);
                    e.target.value = "";
                  }}
                  className="p-2 rounded-lg border border-border text-sm"
                  title="Select a saved template to load into the compose form"
                  defaultValue=""
                >
                  <option value="" disabled>— Select template —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Recipient Group */}
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1">Send To</label>
              <div className="flex items-center gap-3">
                <select
                  value={recipientGroup}
                  onChange={(e) => setRecipientGroup(e.target.value)}
                  className="p-2 rounded-lg border border-border text-sm"
                  title="Select which group of players to message"
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

            {/* Channel selection */}
            <div className="mb-3">
              <label className="block text-xs font-medium mb-1">Send Via</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer" title="SMS to players with phone+carrier, email to the rest (no duplicates)">
                    <input type="radio" name="channel" value="both" checked={channel === "both"} onChange={() => setChannel("both")} />
                    Email + Text
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer" title="Email only to all players with an email address">
                    <input type="radio" name="channel" value="email" checked={channel === "email"} onChange={() => setChannel("email")} />
                    Email only
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer" title="Prefer text; players without phone+carrier get email instead">
                    <input type="radio" name="channel" value="sms" checked={channel === "sms"} onChange={() => setChannel("sms")} />
                    Text only
                  </label>
                </div>
                <p className="text-xs text-muted mt-1">
                  {channel === "both" && "Players with phone+carrier get text. Others get email. No one gets both."}
                  {channel === "email" && "All players with email receive an email."}
                  {channel === "sms" && "Players with phone+carrier get text. Players without get email as fallback."}
                </p>
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

            {/* Send + Save as template */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                title="Send the message to all selected recipients"
              >
                {sending ? "Sending..." : "Send"}
              </button>
              {subject.trim() && (
                <button
                  onClick={() => handleSaveAsTemplate(subject, body)}
                  disabled={savingTemplate}
                  className="px-3 py-2 bg-gray-200 text-foreground rounded-lg text-sm font-medium"
                  title="Save the current subject and message as a reusable template"
                >
                  Save as Template
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {templates.length === 0 ? (
            <div className="p-6 text-center text-muted text-sm">
              No templates yet. Save one from Compose or from History.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted-bg">
                <tr>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Subject</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="p-3 font-medium">{t.name}</td>
                    <td className="p-3 text-muted">{t.subject}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleLoadTemplate(t)}
                        className="text-primary text-sm"
                        title="Load this template into the compose form"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className="text-danger text-sm"
                        title="Permanently delete this template"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {history.length === 0 ? (
            <div className="p-6 text-center text-muted text-sm">No messages sent yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted-bg">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Subject</th>
                  <th className="text-center p-3 font-medium">Channel</th>
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
                        entry.recipientGroup.includes("URGENT") ? "bg-danger/10 text-danger" :
                        entry.recipientGroup.includes("REMINDER") ? "bg-primary/10 text-primary" :
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
                <div className="text-sm whitespace-pre-wrap bg-card p-3 rounded border border-border mb-3">
                  {entry.body}
                </div>
                <button
                  onClick={() => handleSaveAsTemplate(entry.subject, entry.body)}
                  className="px-3 py-1.5 bg-gray-200 text-foreground rounded-lg text-xs font-medium"
                  title="Save this sent message as a reusable template"
                >
                  Use as Template
                </button>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
