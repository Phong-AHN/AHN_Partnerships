/**
 * The two emails the app sends. Plain functions returning subject, text and
 * HTML, so they can be tested and previewed without sending anything. The
 * HTML is deliberately simple - inline styles, one button - because email
 * clients render little else reliably.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(input: {
  greeting: string;
  lines: string[];
  button: string;
  url: string;
  footer: string;
}) {
  const paragraphs = input.lines
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#1f2937">${escapeHtml(line)}</p>`,
    )
    .join('');
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f6fa;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px">
<tr><td>
<p style="margin:0 0 20px;font-size:13px;font-weight:600;color:#4f46e5;letter-spacing:.02em">AHN Partnerships</p>
<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#1f2937">${escapeHtml(input.greeting)}</p>
${paragraphs}
<p style="margin:24px 0"><a href="${escapeHtml(input.url)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${escapeHtml(input.button)}</a></p>
<p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#6b7280">Or paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(input.url)}</span></p>
<p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#6b7280">${escapeHtml(input.footer)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function renderSignInEmail(input: {
  name: string;
  url: string;
  minutes: number;
}): RenderedEmail {
  const greeting = `Hi ${firstName(input.name)},`;
  const body = `Here is your link to sign in to AHN Partnerships. It works once and expires in ${input.minutes} minutes.`;
  const footer =
    "If you didn't ask to sign in, you can ignore this email - nobody can use it without this inbox.";
  return {
    subject: 'Your AHN Partnerships sign-in link',
    text: `${greeting}\n\n${body}\n\n${input.url}\n\n${footer}\n`,
    html: layout({ greeting, lines: [body], button: 'Sign in', url: input.url, footer }),
  };
}

export function renderInviteEmail(input: {
  name: string;
  inviterName: string;
  url: string;
  days: number;
}): RenderedEmail {
  const greeting = `Hi ${firstName(input.name)},`;
  const lines = [
    `${input.inviterName} has added you to AHN Partnerships, where the team tracks AHN/AHNF partners, deals and corporate memberships.`,
    `There is no password: this link signs you in. It works once and expires in ${input.days} days. After that, ask for a new link on the sign-in page any time.`,
  ];
  const footer = "If you weren't expecting this, you can ignore it.";
  return {
    subject: `${input.inviterName} invited you to AHN Partnerships`,
    text: `${greeting}\n\n${lines.join('\n\n')}\n\n${input.url}\n\n${footer}\n`,
    html: layout({ greeting, lines, button: 'Open AHN Partnerships', url: input.url, footer }),
  };
}
