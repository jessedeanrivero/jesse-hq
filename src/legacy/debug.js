export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  const prompt = `You are a productivity assistant. Break this weekly goal into 2-4 tasks.

Track: Real Fun Records
Goal: Finish the Still Waters mix
Existing items: none

Return ONLY a JSON array. Start with [ end with ]. No markdown, no explanation.

Each object: {"name":"short name","type":"Song","status":"Pre-Production","estimatedHours":1,"notes":"one sentence"}

Example: [{"name":"Send mix to Chris","type":"Song","status":"Pre-Production","estimatedHours":1,"notes":"Export and deliver final mix via email"}]`;

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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const d = await r.json();
    const text = d.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);

    return res.status(200).json({
      http_status: r.status,
      raw_text: text,
      found_json: !!match,
      json_match: match ? match[0] : null,
      parsed: match ? (() => { try { return JSON.parse(match[0]); } catch(e) { return 'PARSE ERROR: ' + e.message; } })() : null,
      full_response: d,
    });
  } catch(e) {
    return res.status(200).json({ error: e.message });
  }
}
