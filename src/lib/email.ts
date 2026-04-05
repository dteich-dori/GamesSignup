import { Resend } from "resend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateResendKey(): string | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_your_key") {
    return "RESEND_API_KEY is not configured";
  }
  return null;
}

export async function sendEmail({
  to,
  subject,
  text,
  fromName,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  fromName: string;
  replyTo?: string;
}): Promise<{ success: boolean; error?: string }> {
  const keyError = validateResendKey();
  if (keyError) return { success: false, error: keyError };

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from: `${fromName} <onboarding@resend.dev>`,
      to: [to],
      replyTo: replyTo || undefined,
      subject,
      text,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export interface Recipient {
  name: string;
  email: string;
}

export interface BulkResult {
  sent: number;
  errors: string[];
  skipped: string[];
  recipients: string[]; // names of successfully sent
}

export async function sendBulkEmails(
  recipients: Recipient[],
  subject: string,
  text: string,
  fromName: string,
  replyTo?: string
): Promise<BulkResult> {
  const result: BulkResult = { sent: 0, errors: [], skipped: [], recipients: [] };

  const keyError = validateResendKey();
  if (keyError) {
    result.errors.push(keyError);
    return result;
  }

  for (const r of recipients) {
    const email = r.email.replace(/\s/g, "");
    if (!EMAIL_REGEX.test(email)) {
      result.skipped.push(`${r.name} (invalid email: ${r.email})`);
      continue;
    }

    const sendResult = await sendEmail({ to: email, subject, text, fromName, replyTo });
    if (sendResult.success) {
      result.sent++;
      result.recipients.push(r.name);
    } else {
      result.errors.push(`${r.name}: ${sendResult.error}`);
    }
  }

  return result;
}
