// ============================================================================
// Mai-Reads: Instant Search Engine Indexing Ping (IndexNow Protocol)
// Pings Bing, Yandex, Naver, and Seznam search engines for instant crawl.
// ============================================================================

import https from 'node:https';

const host = 'mai-reads.vercel.app';
const key = 'e88a3b5c4f2e46c7b960b779412f98d7';
const keyLocation = `https://${host}/${key}.txt`;

const urlList = [
  `https://${host}/`,
  `https://${host}/read-pdf-offline`,
  `https://${host}/open-docx-online-free`,
  `https://${host}/multi-pdf-reader`,
  `https://${host}/notebook`,
  `https://${host}/docs`
];

const payload = JSON.stringify({
  host,
  key,
  keyLocation,
  urlList
});

const endpoints = [
  'api.indexnow.org',
  'www.bing.com'
];

async function pingEndpoint(hostname) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname,
      port: 443,
      path: '/indexnow',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`[IndexNow] ${hostname} responded with status: ${res.statusCode} ${res.statusMessage}`);
        resolve({ hostname, status: res.statusCode });
      });
    });

    req.on('error', (err) => {
      console.error(`[IndexNow] ${hostname} error:`, err.message);
      resolve({ hostname, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log(`[IndexNow] Submitting ${urlList.length} URLs for instant indexing on ${host}...`);
  for (const endpoint of endpoints) {
    await pingEndpoint(endpoint);
  }
  console.log('[IndexNow] Ping process finished.');
}

run();
