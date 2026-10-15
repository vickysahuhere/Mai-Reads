export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
    return;
  }

  let body = req.body;
  if (!body || typeof body !== 'object') {
    body = await new Promise(resolve => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({}); }
      });
      req.on('error', () => resolve({}));
    });
  }

  const { category = 'General', message = '', email = '' } = body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Message cannot be empty.' }));
    return;
  }

  // Recipient email is securely held server-side, never exposed to client browsers or web scrapers
  const recipient = process.env.FEEDBACK_RECIPIENT_EMAIL || 'your-email@example.com';

  try {
    const fsRes = await fetch(`https://formsubmit.co/ajax/${recipient}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://mai-reads.vercel.app',
        'Referer': 'https://mai-reads.vercel.app/'
      },
      body: JSON.stringify({
        _subject: `[Mai-Reads Feedback] ${category}: ${message.slice(0, 45)}...`,
        category: category,
        message: message.trim(),
        userEmail: email ? email.trim() : 'Anonymous',
        submittedAt: new Date().toISOString(),
        _template: 'table',
        _captcha: 'false'
      })
    });

    const data = await fsRes.json().catch(() => ({}));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data }));
  } catch (err) {
    console.error('Server error forwarding feedback to FormSubmit:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Failed to dispatch feedback.' }));
  }
}
