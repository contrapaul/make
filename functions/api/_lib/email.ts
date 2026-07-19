// Transactional email via the Resend REST API.
// RESEND_API_KEY is a Pages secret; RESEND_FROM optionally overrides the
// sender (must be on a domain verified in Resend).

const DEFAULT_FROM = 'Blood Bowl Companion <bloodbowl@contrapaul.com>';

async function sendEmail(env: any, to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.RESEND_FROM || DEFAULT_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
  }
}

export function sendVerifyEmail(env: any, to: string, link: string): Promise<void> {
  return sendEmail(
    env,
    to,
    'Verify your email — Blood Bowl Companion',
    `<p>Welcome to the Blood Bowl Companion!</p>
     <p><a href="${link}">Click here to verify your email address</a> (link valid for 24 hours).</p>
     <p>If you didn't create an account, you can ignore this email.</p>`
  );
}

export function sendResetEmail(env: any, to: string, link: string): Promise<void> {
  return sendEmail(
    env,
    to,
    'Reset your password — Blood Bowl Companion',
    `<p><a href="${link}">Click here to choose a new password</a> (link valid for 1 hour).</p>
     <p>If you didn't request this, you can ignore this email — your password is unchanged.</p>`
  );
}
