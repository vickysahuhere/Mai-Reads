// In-memory rate limiting map: ip -> [timestamps]
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitMap.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);

  // Periodic cleanup
  if (rateLimitMap.size > 1000) {
    for (const [key, times] of rateLimitMap.entries()) {
      const valid = times.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) rateLimitMap.delete(key);
      else rateLimitMap.set(key, valid);
    }
  }

  return false;
}

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

  // 1. Rate limiting by IP
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.headers['x-real-ip'] || 
                   req.socket?.remoteAddress || 
                   'unknown';

  if (isRateLimited(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      message: 'Too many submissions. Please wait a few minutes before sending again.' 
    }));
    return;
  }

  // Parse request body
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

  const { _honey = '', category = 'General', message = '', email = '' } = body;

  // 2. Anti-Spam Honeypot check: Bots auto-fill _honey; real users never see or fill it
  if (typeof _honey === 'string' && _honey.trim().length > 0) {
    // Silently drop bot submission with success code to prevent bot adaptation
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Feedback received.' }));
    return;
  }

  // 3. User Input Validation: message must be 5 to 2000 characters
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (!trimmedMessage || trimmedMessage.length < 5) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Feedback message must be at least 5 characters.' }));
    return;
  }

  if (trimmedMessage.length > 2000) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Feedback message exceeds the 2000 character limit.' }));
    return;
  }

  // Email validation: optional, max 150 chars, valid format if provided
  let sanitizedEmail = typeof email === 'string' ? email.trim() : '';
  if (sanitizedEmail) {
    if (sanitizedEmail.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Please provide a valid email address or leave it blank.' }));
      return;
    }
  } else {
    sanitizedEmail = 'Anonymous';
  }

  // Category normalization
  const allowedCategories = ['Feature Request', 'Improvement', 'Issue / Bug', 'Bug Report', 'General'];
  const safeCategory = allowedCategories.includes(category) ? category : 'General';

  // Recipient email is read from environment variable (configured in Vercel or local .env)
  // Encoded fallback ensures the live production website never breaks even if env vars are pending
  const recipient = process.env.FEEDBACK_RECIPIENT_EMAIL || 
    Buffer.from('YmFiaXRhc2FodTkzMTA2QGdtYWlsLmNvbQ==', 'base64').toString('utf8');

  if (!recipient) {
    console.error('FEEDBACK_RECIPIENT_EMAIL is not configured in environment variables.');
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      message: 'Feedback service is not currently configured. Please try again later.' 
    }));
    return;
  }

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
        _subject: `[Mai-Reads Feedback] ${safeCategory}: ${trimmedMessage.slice(0, 45)}...`,
        category: safeCategory,
        message: trimmedMessage,
        userEmail: sanitizedEmail,
        submittedAt: new Date().toISOString(),
        _honey: '',
        _captcha: 'false',
        _template: 'table'
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
