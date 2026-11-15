// Contact form: posts to /api/contact, which sends the message through Resend.
// Same behaviour as the form on edu.contrapaul.com/about.

const SENT = 'Thanks! Your message has been sent.';
const FAILED = 'Something went wrong. Please use the email link below.';
const OFFLINE = 'Network error. Please use the email link below.';

function readForm(form) {
  const fields = new FormData(form);
  const value = (name) => String(fields.get(name) || '').trim();
  return { name: value('name'), email: value('email'), message: value('message'), company: value('company') };
}

async function postMessage(payload) {
  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  return response.ok ? { ok: true } : { ok: false, error: body.error || FAILED };
}

export function wireContactForm(form) {
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[role="status"]');
  const setStatus = (text, kind) => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = readForm(form);
    if (!payload.name || !payload.email || !payload.message) {
      return setStatus('Please fill in all fields.', 'error');
    }
    button.disabled = true;
    setStatus('Sending...', '');
    const result = await postMessage(payload).catch(() => ({ ok: false, error: OFFLINE }));
    button.disabled = false;
    setStatus(result.ok ? SENT : result.error, result.ok ? 'success' : 'error');
    if (result.ok) form.reset();
  });
}
