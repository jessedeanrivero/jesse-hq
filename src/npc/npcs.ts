import type { Look } from '@/game/art/characters';

export interface TopicDef {
  id: string;
  label: string;
  /** Words that route typed or spoken questions to this topic */
  keywords: string[];
}

export interface NpcDef {
  id: string;
  name: string;
  role: string;
  roomId: string;
  look: Look;
  /** One-line personality, used for flavor text only */
  manner: string;
  job: string;
  sources: string;
  topics: TopicDef[];
}

// All coworkers are fictional characters. None represents a real person.
export const NPCS: NpcDef[] = [
  {
    id: 'chief',
    name: 'Vesper',
    role: 'Chief of Staff',
    roomId: 'command',
    look: { skin: '#c68642', hair: '#1f1a17', hairStyle: 'bun', top: '#7b2cbf', bottom: '#2b2d42', shoes: '#111111', accessory: 'badge' },
    manner: 'Calm, precise, a little dry.',
    job: 'Keeps your day straight: priorities, commitments, meetings and the decisions waiting on you.',
    sources: 'Latest daily checkout, the loops spine, the current operating-system file and your calendars.',
    topics: [
      { id: 'briefing', label: 'Give me the daily briefing', keywords: ['brief', 'briefing', 'today', 'morning', 'summary', 'start'] },
      { id: 'deadlines', label: "What's due soon?", keywords: ['due', 'deadline', 'deadlines', 'soon', 'week'] },
      { id: 'decisions', label: 'What decisions are waiting on me?', keywords: ['decide', 'decision', 'decisions'] },
      { id: 'waiting', label: 'Who am I waiting on?', keywords: ['waiting', 'wait', 'owe me', 'their move'] },
      { id: 'meetings', label: "What's on the calendar?", keywords: ['meeting', 'meetings', 'calendar', 'schedule'] },
      { id: 'weekplan', label: "This week's plan", keywords: ['plan', 'plays', 'week plan'] },
      { id: 'room', label: 'What is in this room?', keywords: ['room', 'here', 'what is this'] },
    ],
  },
  {
    id: 'archivist',
    name: 'Quill',
    role: 'The Archivist',
    roomId: 'library',
    look: { skin: '#f1c27d', hair: '#b8b8b8', hairStyle: 'short', top: '#6b4226', bottom: '#3e2c23', shoes: '#2a1a10', accessory: 'glasses', beard: true },
    manner: 'Warm, unhurried, loves a good index.',
    job: 'Finds past decisions, notes, ideas and older checkouts. Every finding comes with its original file.',
    sources: 'Daily, weekly and monthly records, older loops and OS files, and Drive search.',
    topics: [
      { id: 'recent', label: 'Show me recent checkouts', keywords: ['checkout', 'checkouts', 'daily', 'recent', 'yesterday'] },
      { id: 'weekly', label: 'Weekly rollups', keywords: ['weekly', 'week', 'rollup', 'rollups'] },
      { id: 'monthly', label: 'Monthly wraps', keywords: ['monthly', 'month'] },
      { id: 'closed', label: 'What got closed lately?', keywords: ['closed', 'done', 'finished', 'shipped'] },
      { id: 'killed', label: 'What did I decide to kill?', keywords: ['killed', 'kill', 'dropped', 'cut'] },
      { id: 'find', label: 'Find something in my Drive', keywords: ['find', 'search', 'look up', 'decision', 'where'] },
      { id: 'room', label: 'What is in this room?', keywords: ['room', 'here'] },
    ],
  },
  {
    id: 'comms',
    name: 'Patch',
    role: 'Communications Coordinator',
    roomId: 'comms',
    look: { skin: '#8d5524', hair: '#2b1b10', hairStyle: 'curly', top: '#16a085', bottom: '#34495e', shoes: '#f4efe2', accessory: 'headset' },
    manner: 'Quick, upbeat, never sends anything without you.',
    job: 'Helps you find emails, prepare replies, open Slack and follow up on what is outstanding.',
    sources: 'Gmail (read-only previews, if allowed), the waiting-on items in your loops, your calendar.',
    topics: [
      { id: 'inbox', label: 'What needs a reply?', keywords: ['reply', 'inbox', 'email', 'emails', 'unread', 'mail'] },
      { id: 'waiting', label: 'Who am I waiting on?', keywords: ['waiting', 'follow up', 'follow-up', 'followup', 'chase'] },
      { id: 'compose', label: 'Write an email', keywords: ['write', 'compose', 'draft', 'send', 'email to'] },
      { id: 'slack', label: 'Prepare a Slack message', keywords: ['slack', 'message', 'dm'] },
      { id: 'meetings', label: 'Upcoming meetings', keywords: ['meeting', 'meetings', 'calendar', 'call', 'calls'] },
      { id: 'room', label: 'What is in this room?', keywords: ['room', 'here'] },
    ],
  },
  {
    id: 'coordinator',
    name: 'Gantt',
    role: 'Project Coordinator',
    roomId: 'work',
    look: { skin: '#ffdbac', hair: '#d35400', hairStyle: 'long', top: '#f39c12', bottom: '#2c3e50', shoes: '#2c3e50' },
    manner: 'Organized, encouraging, loves a clean board.',
    job: 'Knows which lanes are active from your current OS file and helps you open their resources and prepare updates.',
    sources: 'The OS file lane list and allocation, the loops spine and the latest checkout.',
    topics: [
      { id: 'lanes', label: 'Which lanes are active?', keywords: ['lanes', 'lane', 'active', 'projects', 'buildings'] },
      { id: 'pending', label: "What's pending across lanes?", keywords: ['pending', 'owed', 'tasks', 'my move', 'todo'] },
      { id: 'allocation', label: "This month's allocation", keywords: ['allocation', 'focus', 'month', 'bet'] },
      { id: 'lanemap', label: 'Which lane gets which day?', keywords: ['day', 'days', 'map', 'schedule'] },
      { id: 'update', label: 'Prepare a project update', keywords: ['update', 'status', 'report'] },
      { id: 'room', label: 'What is in this district?', keywords: ['room', 'here', 'district'] },
    ],
  },
  {
    id: 'scout',
    name: 'Rook',
    role: 'The Scout',
    roomId: 'warroom',
    look: { skin: '#e0ac69', hair: '#3b2a1a', hairStyle: 'cap', capColor: '#0b2545', top: '#69be28', bottom: '#0b2545', shoes: '#f4efe2', accessory: 'whistle' },
    manner: 'Fired up, short sentences, all business on game day.',
    job: 'Shortcuts to the site, game sheets, the picks leaderboard, planning notes and dev tools.',
    sources: 'Only what hawkswarroom.com publishes (sitemap, pages, leaderboard file) and your own loops.',
    topics: [
      { id: 'week', label: "What's this week?", keywords: ['week', 'game', 'this week', 'next game', 'opponent'] },
      { id: 'sheets', label: 'Game sheets and recaps', keywords: ['sheet', 'sheets', 'recap', 'recaps'] },
      { id: 'leaderboard', label: 'Picks leaderboard', keywords: ['leaderboard', 'picks', 'standings', 'predictions'] },
      { id: 'planning', label: 'Content planning notes', keywords: ['plan', 'planning', 'content', 'ideas'] },
      { id: 'dev', label: 'Dev tools', keywords: ['dev', 'code', 'repo', 'github', 'deploy', 'vercel'] },
      { id: 'site', label: 'Open the site', keywords: ['site', 'website', 'open'] },
    ],
  },
  {
    id: 'inventor',
    name: 'Tinker',
    role: 'The Inventor',
    roomId: 'lounge',
    look: { skin: '#ffcd94', hair: '#6c5ce7', hairStyle: 'curly', top: '#e17055', bottom: '#2d3436', shoes: '#fdcb6e', accessory: 'goggles' },
    manner: 'Curious, playful, zero pressure.',
    job: 'Helps you revisit old ideas and play with new ones. Nothing here becomes a task unless you say so.',
    sources: 'Ideas and parked items you wrote down, aspirations in your OS file and your creative folders.',
    topics: [
      { id: 'build', label: 'What have I wanted to build?', keywords: ['build', 'make', 'app', 'tool'] },
      { id: 'forgot', label: 'Show me an idea I forgot about', keywords: ['forgot', 'forgotten', 'old', 'remember'] },
      { id: 'fun', label: 'Give me something fun to explore', keywords: ['fun', 'surprise', 'explore', 'random', 'play'] },
      { id: 'parked', label: 'What has been parked the longest?', keywords: ['parked', 'putting off', 'waiting', 'longest'] },
      { id: 'think', label: 'Help me think through an idea', keywords: ['think', 'idea', 'brainstorm', 'help'] },
      { id: 'journal', label: 'Write down a new dream', keywords: ['write', 'journal', 'dream', 'capture', 'new'] },
    ],
  },
  {
    id: 'blip',
    name: 'BLIP',
    role: 'Lab assistant',
    roomId: 'lab',
    look: { skin: '#cccccc', hair: '#cccccc', hairStyle: 'bald', top: '#7f8c8d', bottom: '#7f8c8d', shoes: '#7f8c8d', robot: true },
    manner: 'Literal. Beeps. Very honest about what it cannot see.',
    job: 'Shows what your workflows actually wrote to Drive, and hands off to the tools that run them.',
    sources: 'File timestamps in your numbered Drive folders. It cannot see scheduled-task logs.',
    topics: [
      { id: 'outputs', label: 'What did the workflows write?', keywords: ['outputs', 'output', 'workflows', 'status', 'ran'] },
      { id: 'checkout', label: 'Run the daily checkout', keywords: ['checkout', 'run', 'daily'] },
      { id: 'limits', label: "What can't you see?", keywords: ['limits', 'cannot', "can't", 'blind'] },
    ],
  },
];

export function npcById(id: string): NpcDef | undefined {
  return NPCS.find((n) => n.id === id);
}

/** Route free text to one of an NPC's topics by keyword. */
export function topicForText(npc: NpcDef, text: string): string | null {
  const t = text.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const topic of npc.topics) {
    const score = topic.keywords.reduce((acc, k) => acc + (t.includes(k) ? k.length : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = topic.id;
    }
  }
  return best;
}
