export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', tasks: [] }); return; }

  const { track, goal, existingItems } = req.body || {};
  if (!track || !goal) return res.status(400).json({ error: 'Missing track or goal', tasks: [] });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set', tasks: [] });

  const STATUSES = {
    records:   ['Pre-Production','Recording','Mixing','Mastered','Released'],
    publishing:['Pitched','Placed','Collecting','Monetizing'],
    songstage: ['Backlog','In Progress','Review','Shipped'],
    freelance: ['General','Booked','In Progress','Completed'],
    content:   ['Planned','In Progress','Published'],
  };

  const TYPES = {
    records:   ['Song','Album','EP','Org Task'],
    publishing:['Single','Co-write','Cover','Org Task'],
    songstage: ['Feature','Bug','Task'],
    freelance: ['Session','Coaching','Production'],
    content:   ['Short-Form','Long-Form','Substack'],
  };

  const TRACK_LABELS = {
    records:'Real Fun Records', publishing:'Real Fun Publishing',
    songstage:'Songstage', freelance:'Freelance', content:'Content',
  };

  const statuses = STATUSES[track] || ['In Progress'];
  const types = TYPES[track] || ['Task'];
  const existing = (existingItems || []).map(i => i.name).join(', ') || 'none';

  const prompt = `You are a productivity assistant. Break this weekly goal into 2-4 tasks.

Track: ${TRACK_LABELS[track] || track}
Goal: ${goal}
Existing items: ${existing}

Return ONLY a JSON array. Start with [ end with ]. No markdown, no explanation.

Each object: {"name":"short name","type":"${types[0]}","status":"${statuses[0]}","estimatedHours":1,"notes":"one sentence"}

Example: [{"name":"Send mix to Chris","type":"${types[0]}","status":"${statuses[0]}","estimatedHours":1,"notes":"Export and deliver final mix via email"}]`;

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

    if (!r.ok) {
      return res.status(500).json({
        error: `Anthropic ${r.status}: ${d.error?.message || JSON.stringify(d)}`,
        tasks: [],
      });
    }

    const text = (d.content?.[0]?.text || '').trim();

    if (!text) {
      return res.status(500).json({ error: 'Empty response from model', tasks: [] });
    }

    // Try to extract JSON array — be generous with parsing
    let tasks = [];
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) tasks = parsed;
      } catch(e) {
        // Try cleaning up common issues
        try {
          const cleaned = match[0]
            .replace(/,\s*}/g, '}')
            .replace(/,\s*\]/g, ']')
            .replace(/'/g, '"');
          tasks = JSON.parse(cleaned);
        } catch(e2) {
          return res.status(500).json({ error: `Parse failed: ${text.slice(0,300)}`, tasks: [] });
        }
      }
    } else {
      return res.status(500).json({ error: `No JSON array in response: ${text.slice(0,300)}`, tasks: [] });
    }

    // Sanitize each task
    tasks = tasks.filter(t => t && typeof t === 'object').map(t => ({
      name: String(t.name || 'Untitled task').slice(0, 60),
      type: types.includes(t.type) ? t.type : types[0],
      status: statuses.includes(t.status) ? t.status : statuses[0],
      estimatedHours: Math.max(0.5, Math.min(4, Number(t.estimatedHours) || 1)),
      notes: String(t.notes || '').slice(0, 200),
    }));

    if (tasks.length === 0) {
      return res.status(500).json({ error: `Parsed array was empty. Raw: ${text.slice(0,300)}`, tasks: [] });
    }

    return res.status(200).json({ tasks });

  } catch(e) {
    return res.status(500).json({ error: `Request failed: ${e.message}`, tasks: [] });
  }
}
