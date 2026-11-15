// Contact form rules shared by POST /api/contact. No imports, so it can be
// tested directly with `node --test`.

const MAX_NAME = 100;
const MAX_EMAIL = 200;
const MAX_MESSAGE = 5000;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
  isBot: boolean;
}

export class ContactFormError extends Error {}

const field = (value: unknown): string => String(value ?? '').trim();

/**
 * Validates a submitted form. Throws ContactFormError with a message that is
 * safe to show the sender. `isBot` is true when the hidden field was filled.
 * `parseContact({ name: 'A', email: 'a@b.co', message: 'Hi' })`
 */
export function parseContact(data: any): ContactMessage {
  const form = { name: field(data?.name), email: field(data?.email), message: field(data?.message) };
  if (field(data?.company)) return { ...form, isBot: true };
  if (!form.name || !form.email || !form.message) {
    throw new ContactFormError('Please fill in all fields.');
  }
  if (!EMAIL_SHAPE.test(form.email)) {
    throw new ContactFormError('Please enter a valid email address.');
  }
  if (form.name.length > MAX_NAME || form.email.length > MAX_EMAIL || form.message.length > MAX_MESSAGE) {
    throw new ContactFormError('One of the fields is too long.');
  }
  return { ...form, isBot: false };
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** The email body sent to the site owner. Every submitted value is escaped. */
export function contactEmailHtml(form: ContactMessage): string {
  return (
    `<p><strong>From:</strong> ${escapeHtml(form.name)} &lt;${escapeHtml(form.email)}&gt;</p>` +
    `<p style="white-space:pre-wrap">${escapeHtml(form.message)}</p>`
  );
}
