export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { track, goal, existingItems } = req.body;

  const STATUSES = {
    records:   ['Pre-Production','Recording','Mixing','Mastered','Released'],
    publishing:['Pitched','Placed','Collecting','Monetizing'],
    songstage: ['Backlog','In Progress','Review','Shipped'],
    freelance: ['Booked','In Progress','Completed'],
    content:   ['Planned','In Progress','Published'],
  };

  const TRACK_LABELS = {
    records:'Real Fun Records', publishing:'Real Fun Publishing',
    songstage:'Songstage', freelance:'Freelance', content:'Content',
  };

  const prompt = `You are a productivity assistant for a music entrepreneur. Break down this weekly goal into 2-4 specific, actionable tasks.

Track: ${TRACK_LABELS[track] || track}
Goal: "${goal}"
Existing items: ${(existingItems||[]).map(i=>i.name).join(', ') || 'none'}

Respond ONLY with a JSON array. No markdown, no explanation, no backticks. Each object must have:
- "name": short task name (max 6 words)
- "status": one of ${JSON.stringify(STATUSES[track] || ['In Progress'])}
- "estimatedHours": number between 0.5 and 4
- "notes": one sentence description`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';

    let tasks = [];
    try { tasks = JSON.parse(text.replace(/```json|```/g, '').trim()); }
    catch(e) { tasks = []; }

    res.status(200).json({ tasks });
  } catch (e) {
    res.status(500).json({ error: e.message, tasks: [] });
  }
}
