export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ status: 'error', issue: 'No API key found in environment' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Say hello in exactly 5 words.' }],
      }),
    });

    const d = await r.json();
    return res.status(200).json({
      status: r.ok ? 'success' : 'api_error',
      http_status: r.status,
      raw_response: d,
      text: d.content?.[0]?.text || null,
      key_prefix: apiKey.slice(0, 20) + '...',
    });
  } catch(e) {
    return res.status(200).json({ status: 'fetch_error', error: e.message });
  }
}
