import { HttpError, json, readJson, getIP } from './_lib/http';
import { rateLimit } from './_lib/ratelimit';
import { sendContactEmail } from './_lib/email';
import { ContactFormError, parseContact, type ContactMessage } from './_lib/contact';

const MAX_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
const USE_EMAIL_LINK = 'Please use the email link.';

function readContact(data: unknown): ContactMessage {
  try {
    return parseContact(data);
  } catch (e) {
    if (e instanceof ContactFormError) throw new HttpError(400, e.message);
    throw e;
  }
}

// POST /api/contact: the contact form on /map/. Sends the message to the
// CONTACT_TO inbox through Resend. A filled honeypot gets a fake success.
export const onRequestPost = async (context: any) => {
  const { env, request } = context;
  const form = readContact(await readJson(request));
  if (form.isBot) return json({ ok: true });
  if (!env.RESEND_API_KEY || !env.CONTACT_TO) {
    throw new HttpError(503, `Email is not set up yet. ${USE_EMAIL_LINK}`);
  }
  await rateLimit(env, `contact:${getIP(request)}`, MAX_PER_HOUR, HOUR_MS);
  const sent = await sendContactEmail(env, form);
  if (!sent) throw new HttpError(502, `Could not send your message. ${USE_EMAIL_LINK}`);
  return json({ ok: true });
};
