export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed', tasks: [] }); return; }

  const { track, goal, existingItems } = req.body || {};
  if (!track || !goal) return res.status(400).json({ error: 'Missing track or goal', tasks: [] });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables', tasks: [] });

  const STATUSES = {
    records:   ['Pre-Production','Recording','Mixing','Mastered','Released'],
    publishing:['Pitched','Placed','Collecting','Monetizing'],
    songstage: ['Backlog','In Progress','Review','Shipped'],
    freelance: ['Booked','In Progress','Completed'],
    content:   ['Planned','In Progress','Published'],
  };
  const TYPES = {
    records:   ['Song','Album','EP'],
    publishing:['Single','Co-write','Cover'],
    songstage: ['Feature','Bug','Task'],
    freelance: ['Session','Coaching','Production'],
    content:   ['Short-Form','Long-Form','Substack'],
  };
  const TRACK_LABELS = {
    records:'Real Fun Records', publishing:'Real Fun Publishing',
    songstage:'Songstage', freelance:'Freelance', content:'Content',
  };

  const statuses = STATUSES[track] || ['In Progress'];
  const types = TYPES[track] || [];
  const existing = (existingItems || []).map(i => i.name).join(', ') || 'none';

  const prompt = `Break this weekly goal into 2-4 actionable tasks. Return ONLY a valid JSON array, no markdown, no explanation.

Track: ${TRACK_LABELS[track] || track}
Goal: ${goal}
Already in this track: ${existing}

Each task object must have:
- "name": string, max 6 words
- "type": one of ${JSON.stringify(types)}
- "status": one of ${JSON.stringify(statuses)} — use first status for new tasks
- "estimatedHours": number 0.5-4
- "notes": one sentence

Start with [ and end with ].`;

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
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const d = await r.json();
    if (!r.ok) return res.status(500).json({ error: `Anthropic ${r.status}: ${d.error?.message || JSON.stringify(d)}`, tasks: [] });

    const text = d.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.status(500).json({ error: `No JSON in response: ${text.slice(0,200)}`, tasks: [] });

    let tasks = [];
    try { tasks = JSON.parse(match[0]); } catch(e) { return res.status(500).json({ error: `Parse failed: ${match[0].slice(0,200)}`, tasks: [] }); }
    if (!Array.isArray(tasks)) tasks = [];

    tasks = tasks.map(t => ({
      name: t.name || 'Untitled task',
      type: types.includes(t.type) ? t.type : types[0],
      status: statuses.includes(t.status) ? t.status : statuses[0],
      estimatedHours: typeof t.estimatedHours === 'number' ? t.estimatedHours : 1,
      notes: t.notes || '',
    }));

    return res.status(200).json({ tasks });
  } catch(e) {
    return res.status(500).json({ error: `Request failed: ${e.message}`, tasks: [] });
  }
}
