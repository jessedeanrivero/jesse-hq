// Deterministic voice command routing. No language model: a short list of patterns, and
// anything else is answered with the list of phrases that work.

export type PanelTarget =
  | 'loops'
  | 'checkout'
  | 'calendar'
  | 'inbox'
  | 'map'
  | 'search'
  | 'settings'
  | 'dreamboard'
  | 'journal'
  | 'surprise'
  | 'briefing'
  | 'menu';

export type VoiceCommand =
  | { type: 'travel'; roomId: string; label: string }
  | { type: 'panel'; panel: PanelTarget; label: string; query?: string }
  | { type: 'talk'; npcId: string; label: string }
  | { type: 'compose'; to?: string; label: string };

export interface RouteTarget {
  id: string;
  label: string;
  aliases: string[];
}

export const EXAMPLE_COMMANDS = [
  'Open Hawks War Room',
  'Show my open loops',
  "Open today's checkout",
  'Go to the Command Center',
  'Talk to the Archivist',
  'Search for <anything>',
  'Compose an email to <name>',
  'Surprise me',
  'Open the map',
];

const FILLER = /^(?:please|hey|ok|okay|hq|jesse hq|can you|could you|would you|i want to|lets|let's)\s+/;
const STOP = new Set(['the', 'a', 'an', 'my', 'to', 'of', 'room', 'please', 'in', 'into', 'go', 'open', 'take', 'me', 'on']);

export function normalizeUtterance(input: string): string {
  let s = (input ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s<>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (let i = 0; i < 3; i++) s = s.replace(FILLER, '');
  return s;
}

function words(s: string): string[] {
  return s.split(' ').filter((w) => w && !STOP.has(w));
}

export function matchTarget(phrase: string, targets: RouteTarget[]): RouteTarget | null {
  const q = normalizeUtterance(phrase);
  const qw = words(q);
  if (!qw.length) return null;
  let best: RouteTarget | null = null;
  let bestScore = 0;
  for (const t of targets) {
    const names = [t.label, ...t.aliases].map((n) => normalizeUtterance(n));
    let score = 0;
    for (const n of names) {
      if (n && (q === n || q.includes(n))) score = Math.max(score, 10 + n.length / 100);
      const nw = words(n);
      const overlap = qw.filter((w) => nw.some((x) => x === w || (w.length >= 4 && (x.startsWith(w) || w.startsWith(x))))).length;
      if (overlap) score = Math.max(score, overlap * 3 - Math.abs(nw.length - qw.length) * 0.1);
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= 3 ? best : null;
}

export function routeVoiceCommand(input: string, ctx: { rooms: RouteTarget[]; npcs: RouteTarget[] }): VoiceCommand | null {
  const s = normalizeUtterance(input);
  if (!s) return null;

  if (/^(?:show|open|pull up|read|bring up|check)?\s*(?:me\s+)?(?:my\s+|the\s+)?(?:current\s+|latest\s+)?(?:open\s+)?loops$/.test(s))
    return { type: 'panel', panel: 'loops', label: 'Open loops' };
  if (/^(?:show|open|read|pull up|bring up)?\s*(?:me\s+)?(?:todays|today s|the|my)?\s*(?:latest\s+|last\s+)?check ?out$/.test(s))
    return { type: 'panel', panel: 'checkout', label: "Today's checkout" };
  if (/^(?:show|open|whats on)?\s*(?:me\s+)?(?:my\s+)?(?:calendar|schedule|agenda)(?:\s+today)?$/.test(s))
    return { type: 'panel', panel: 'calendar', label: 'Calendar' };
  if (/^(?:open|check|show)\s+(?:my\s+)?(?:inbox|email|emails|gmail|mail)$/.test(s)) return { type: 'panel', panel: 'inbox', label: 'Inbox' };
  if (/^surprise me$/.test(s)) return { type: 'panel', panel: 'surprise', label: 'Surprise me' };
  if (/^(?:open|show)\s+(?:the\s+|my\s+)?dream ?board$/.test(s)) return { type: 'panel', panel: 'dreamboard', label: 'Dream Board' };
  if (/^(?:open\s+)?(?:the\s+|my\s+)?(?:dream\s+)?journal$|^(?:new dream|capture an? idea|capture a thought)$/.test(s))
    return { type: 'panel', panel: 'journal', label: 'Dream Journal' };
  if (/^(?:open\s+)?(?:the\s+)?(?:map|world map)$|^fast travel$/.test(s)) return { type: 'panel', panel: 'map', label: 'Map' };
  if (/^(?:open\s+)?(?:the\s+)?settings$/.test(s)) return { type: 'panel', panel: 'settings', label: 'Settings' };
  if (/^(?:open\s+)?(?:the\s+)?(?:main\s+)?menu$/.test(s)) return { type: 'panel', panel: 'menu', label: 'Menu' };
  if (/^(?:daily\s+)?briefing$|^brief me$/.test(s)) return { type: 'panel', panel: 'briefing', label: 'Daily briefing' };

  const search = s.match(/^(?:search|find|look up|look for)\s+(?:for\s+)?(.+)$/);
  if (search && !/^(?:the\s+)?(?:archivist|coordinator|scout|inventor|chief)/.test(search[1]))
    return { type: 'panel', panel: 'search', label: `Search for “${search[1]}”`, query: search[1] };

  const compose = s.match(/^(?:compose|write|draft|send|new)\s+(?:an?\s+)?(?:email|e mail|message|note)(?:\s+to\s+(.+))?$/);
  if (compose) return { type: 'compose', to: compose[1], label: compose[1] ? `Email to ${compose[1]}` : 'New email' };

  const talk = s.match(/^(?:talk to|speak to|speak with|chat with|ask|find)\s+(.+)$/);
  if (talk) {
    const npc = matchTarget(talk[1], ctx.npcs);
    if (npc) return { type: 'talk', npcId: npc.id, label: `Talk to ${npc.label}` };
  }

  if (/^(?:go\s+)?home$|^(?:back\s+)?to\s+(?:the\s+)?command center$/.test(s)) {
    const home = ctx.rooms.find((r) => r.id === 'command');
    if (home) return { type: 'travel', roomId: home.id, label: home.label };
  }

  const travel = s.match(/^(?:open|go to|go into|take me to|walk to|travel to|head to|enter|visit|teleport to|warp to|show me)\s+(.+)$/);
  const place = travel ? travel[1] : s;
  const room = matchTarget(place, ctx.rooms);
  if (room) return { type: 'travel', roomId: room.id, label: room.label };

  if (talk || travel) {
    const npc = matchTarget(place, ctx.npcs);
    if (npc) return { type: 'talk', npcId: npc.id, label: `Talk to ${npc.label}` };
  }
  return null;
}
