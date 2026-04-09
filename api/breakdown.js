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
    records:   ['General','Pre-Production','Recording','Mixing','Mastered','Released'],
    publishing:['General','Pitched','Placed','Collecting','Monetizing'],
    songstage: ['Backlog','In Progress','Review','Shipped'],
    freelance: ['General','Booked','In Progress','Completed'],
    content:   ['Planned','In Progress','Published'],
  };

  const TYPES = {
    records:   ['Org Task','Song','Album','EP'],
    publishing:['Org Task','Single','Co-write','Cover'],
    songstage: ['Feature','Bug','Task'],
    freelance: ['General Task','Session','Coaching','Production'],
    content:   ['Short-Form','Long-Form','Substack'],
  };

  const TRACK_LABELS = {
    records:'Real Fun Records', publishing:'Real Fun Publishing',
    songstage:'Songstage', freelance:'Freelance', content:'Content',
  };

  const statuses = STATUSES[track] || ['In Progress'];
  const types = TYPES[track] || ['Task'];
  const existing = (existingItems || []).map(i => i.name).join(', ') || 'none';

  const prompt = `You are a productivity assistant for a music entrepreneur. Break this weekly goal into 2-4 specific actionable tasks.

Track: ${TRACK_LABELS[track] || track}
Goal: ${goal}
Existing items: ${existing}

IMPORTANT type and status rules:
- If the task is a general admin, organizational, or non-song task â†’ use type "Org Task" and status "General"
- If the task is specifically about a song, album, or EP â†’ use type "Song"/"Album"/"EP" and status "Pre-Production"
- For publishing: use "Org Task"/"General" for admin; "Single"/"Co-write"/"Cover" + "Pitched" for actual songs
- For freelance: use "General Task"/"General" for outreach/admin; "Session"/"Coaching"/"Production" + "Booked" for actual work
- For Songstage: use "Feature"/"Bug"/"Task" with "Backlog" or "In Progress"
- For content: use "Short-Form"/"Long-Form"/"Substack" with "Planned"

Available types: ${JSON.stringify(types)}
Available statuses: ${JSON.stringify(statuses)}

Return ONLY a JSON array. No markdown. Each object must have:
{"name":"max 6 words","type":"from types list","status":"from statuses list","estimatedHours":1,"notes":"one sentence"}

Start with [ end with ].`;

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
    if (!r.ok) return res.status(500).json({ error: `Anthropic ${r.status}: ${d.error?.message}`, tasks: [] });

    const text = (d.content?.[0]?.text || '').trim();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.status(500).json({ error: `No JSON array: ${text.slice(0,200)}`, tasks: [] });

    let tasks = [];
    try { tasks = JSON.parse(match[0]); } catch(e) { return res.status(500).json({ error: `Parse failed: ${match[0].slice(0,200)}`, tasks: [] }); }
    if (!Array.isArray(tasks)) tasks = [];

    tasks = tasks.filter(t => t && typeof t === 'object').map(t => ({
      name: String(t.name || 'Untitled task').slice(0, 60),
      type: types.includes(t.type) ? t.type : types[0],
      status: statuses.includes(t.status) ? t.status : statuses[0],
      estimatedHours: Math.max(0.5, Math.min(4, Number(t.estimatedHours) || 1)),
      notes: String(t.notes || '').slice(0, 200),
    }));

    return res.status(200).json({ tasks });
  } catch(e) {
    return res.status(500).json({ error: `Request failed: ${e.message}`, tasks: [] });
  }
}
