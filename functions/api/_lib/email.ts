// Transactional email via the Resend REST API.
// RESEND_API_KEY is a Pages secret; RESEND_FROM optionally overrides the
// sender (must be on a domain verified in Resend).

import { contactEmailHtml, type ContactMessage } from './contact';

const DEFAULT_FROM = 'Blood Bowl Companion <bloodbowl@send.contrapaul.com>';
const CONTACT_FROM = 'contrapaul make <contact@send.contrapaul.com>';

interface EmailOptions {
  from?: string;
  replyTo?: string;
}

// Resolves true when Resend accepted the message.
async function sendEmail(
  env: any, to: string, subject: string, html: string, options: EmailOptions = {}
): Promise<boolean> {
  const from = options.from || env.RESEND_FROM || DEFAULT_FROM;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html, reply_to: options.replyTo }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
  }
  return res.ok;
}

// Contact form on /map/: goes to the CONTACT_TO inbox, replies go to the sender.
export function sendContactEmail(env: any, form: ContactMessage): Promise<boolean> {
  return sendEmail(env, env.CONTACT_TO, `Network map contact form: ${form.name}`, contactEmailHtml(form), {
    from: env.CONTACT_FROM || CONTACT_FROM,
    replyTo: form.email,
  });
}

export function sendVerifyEmail(env: any, to: string, link: string): Promise<boolean> {
  return sendEmail(
    env,
    to,
    'Verify your email — Blood Bowl Companion',
    `<p>Welcome to the Blood Bowl Companion!</p>
     <p><a href="${link}">Click here to verify your email address</a> (link valid for 24 hours).</p>
     <p>If you didn't create an account, you can ignore this email.</p>`
  );
}

export function sendResetEmail(env: any, to: string, link: string): Promise<boolean> {
  return sendEmail(
    env,
    to,
    'Reset your password — Blood Bowl Companion',
    `<p><a href="${link}">Click here to choose a new password</a> (link valid for 1 hour).</p>
     <p>If you didn't request this, you can ignore this email — your password is unchanged.</p>`
  );
}
