'use client';

// The coworkers' "brain": deterministic answers built from your own records. No model involved.
// Every reply says where it came from. If a source is missing, the reply says so instead of guessing.

import { api, ApiFailure } from '@/ui/api';
import { getState } from '@/ui/store';
import type { GmailResponse, LoopsResponse, Overview, SlimLoop } from '@/ui/types';
import type { WarRoomData } from '@/ui/panels/warroom';
import { CATEGORY_LABEL } from '@/lib/shared/ideas';
import { STATUS_LABEL } from '@/lib/shared/loops';
import { daysBetween, greetingFor, hourIn, todayIn } from '@/lib/shared/dates';
import type { Idea, LoopStatus, SourceRef } from '@/lib/shared/types';
import type { NpcDef } from './npcs';

export interface ReplyItem {
  label: string;
  sub?: string;
  status?: LoopStatus;
  href?: string;
  panel?: { type: string; props?: Record<string, unknown> };
}

export interface ReplyAction {
  label: string;
  panel?: string;
  props?: Record<string, unknown>;
  href?: string;
  sameTab?: boolean;
  travel?: string;
  copy?: string;
  openAfterCopy?: string;
}

export interface Reply {
  lines: string[];
  items?: ReplyItem[];
  actions?: ReplyAction[];
  sources?: (Partial<SourceRef> & { url: string; name: string })[];
  /** True when the reply is built from Jesse's records rather than general help text. */
  fromRecords: boolean;
}

interface ArchiveResponse {
  files: { id: string; name: string; date?: string; url: string }[];
  folder: { name: string; url: string } | null;
}

interface IdeasResponse {
  ideas: Idea[];
  today: string;
}

interface AutomationsResponse {
  outputs: { role: string; folder: { name: string; url: string }; newest: { name: string; url?: string; modifiedTime?: string; ageDays?: number } | null; filesLast7Days: number }[];
}

const FOOTBALL = /hawks|war room|seahawks|football|nfl|game sheet|scouting|pocket/i;
const ROLE_LABEL: Record<string, string> = {
  daily: 'Daily checkout',
  loops: 'Loops spine',
  weekly: 'Weekly rollup',
  monthly: 'Monthly wrap',
  yearly: 'Yearly rollup',
  os: 'Operating-system file',
  texts: 'Message export',
};

function loopItem(l: Pick<SlimLoop, 'title' | 'status' | 'who' | 'dueLabel' | 'due' | 'section'>): ReplyItem {
  const bits = [l.who ? `waiting on ${l.who}` : '', l.dueLabel ?? l.due ?? '', l.section].filter(Boolean);
  return { label: l.title, sub: bits.join(' · '), status: l.status };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function fmtWhen(iso: string, tz: string): string {
  try {
    const d = new Date(iso);
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(d);
    const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(d);
    return `${day} ${time}`;
  } catch {
    return iso;
  }
}

function tz(): string {
  return getState().session?.tz ?? 'America/Chicago';
}

const overview = () => api<Overview>('/api/hq/overview', { ttl: 120_000 });

function roomReply(): Reply {
  const room = getState().room;
  if (!room) return { lines: ['We’re between rooms. Try again in a second.'], fromRecords: false };
  return {
    lines: [`This is the ${room.name}. ${room.blurb}`],
    items: [...room.things.map((t) => ({ label: t })), ...room.exits.map((e) => ({ label: e, sub: 'Exit' }))],
    fromRecords: false,
  };
}

function failure(e: unknown): Reply {
  if (e instanceof ApiFailure) {
    const code = e.body.code;
    if (code === 'not_signed_in')
      return {
        lines: ['I can only read your records once you’re signed in with Google.'],
        actions: [{ label: 'Sign in with Google', href: '/api/auth/login?return=/', sameTab: true }],
        fromRecords: false,
      };
    if (code === 'not_configured')
      return {
        lines: ['Google sign-in isn’t set up on this deployment yet, so I can’t see your records. I won’t make anything up in the meantime.'],
        actions: [{ label: 'How to set it up', panel: 'setup' }],
        fromRecords: false,
      };
    if (code === 'offline') return { lines: ['I can’t reach the server right now. Check the connection and ask again.'], fromRecords: false };
    return { lines: [e.body.error, ...(e.body.detail ? [e.body.detail] : [])], fromRecords: false };
  }
  return { lines: ['Something went wrong pulling that. Ask me again in a moment.'], fromRecords: false };
}

async function meetings(): Promise<Reply> {
  const ov = await overview();
  if (!ov.calendar) {
    const err = ov.errors.find((x) => /calendar/i.test(x.part));
    return { lines: [err ? `Calendar didn’t load: ${err.message}` : 'Calendar isn’t connected.'], actions: [{ label: 'Open Google Calendar', href: 'https://calendar.google.com' }], fromRecords: false };
  }
  const now = Date.now();
  const today = ov.calendar.today.filter((e) => e.allDay || new Date(e.end ?? e.start).getTime() >= now);
  const later = ov.calendar.upcoming.filter((e) => !ov.calendar!.today.some((t) => t.id === e.id)).slice(0, 5);
  const t = tz();
  return {
    lines: [today.length ? `${plural(today.length, 'thing')} left on today’s calendar.` : 'Nothing else on today’s calendar.', later.length ? 'Coming up after that:' : ''].filter(Boolean),
    items: [...today, ...later].map((e) => ({ label: e.title, sub: `${e.allDay ? 'All day' : fmtWhen(e.start, t)} · ${e.calendar}`, href: e.meetUrl ?? e.url })),
    actions: [{ label: 'Open the calendar board', panel: 'calendar' }],
    sources: [{ name: 'Google Calendar', url: 'https://calendar.google.com' }],
    fromRecords: true,
  };
}

async function waiting(forComms: boolean): Promise<Reply> {
  const ov = await overview();
  if (!ov.loops) return { lines: ['The loops spine didn’t load, so I can’t say who you’re waiting on.'], fromRecords: false };
  const by = new Map<string, SlimLoop[]>();
  for (const it of ov.loops.waiting) by.set(it.who ?? 'Someone', [...(by.get(it.who ?? 'Someone') ?? []), it]);
  const people = [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  return {
    lines: [people.length ? `You’re waiting on ${plural(people.length, 'person', 'people')} across ${plural(ov.loops.waiting.length, 'item')}.` : 'Nobody owes you anything on the spine right now.'],
    items: people.slice(0, 10).map(([who, list]) => ({ label: who, sub: list.map((l) => l.title).slice(0, 2).join(' · ') + (list.length > 2 ? ` +${list.length - 2}` : '') })),
    actions: forComms ? [{ label: 'Open follow-ups', panel: 'comms', props: { tab: 'followups' } }] : [{ label: 'Open waiting loops', panel: 'loops', props: { tab: 'waiting' } }],
    sources: [ov.loops.source],
    fromRecords: true,
  };
}

async function archive(kind: string, what: string): Promise<Reply> {
  const a = await api<ArchiveResponse>(`/api/hq/archive?kind=${kind}`, { ttl: 300_000 });
  return {
    lines: [a.files.length ? `Here are your latest ${what}. Pick one and I’ll open it.` : `I don’t see any ${what} yet.`],
    items: a.files.slice(0, 7).map((f) => ({ label: f.date ?? f.name, sub: f.name, panel: { type: 'doc', props: { id: f.id, name: f.name } } })),
    actions: [{ label: 'Browse the whole shelf', panel: 'archive', props: { kind } }],
    sources: a.folder ? [{ name: a.folder.name, url: a.folder.url }] : undefined,
    fromRecords: true,
  };
}

async function ideas(): Promise<IdeasResponse> {
  return api<IdeasResponse>('/api/hq/ideas', { ttl: 600_000 });
}

function ideaItem(i: Idea): ReplyItem {
  return { label: i.title, sub: `${CATEGORY_LABEL[i.category]}${i.date ? ` · ${i.date}` : ''}`, panel: { type: 'think', props: { idea: i } } };
}

async function warroom(): Promise<WarRoomData> {
  return api<WarRoomData>('/api/hq/warroom', { ttl: 600_000 });
}

type Handler = (query?: string) => Promise<Reply> | Reply;

const HANDLERS: Record<string, Record<string, Handler>> = {
  chief: {
    briefing: async () => {
      const ov = await overview();
      const c = ov.checkout;
      const counts = ov.loops?.counts ?? {};
      const now = Date.now();
      const next = ov.calendar?.today.find((e) => !e.allDay && new Date(e.start).getTime() > now);
      const lines = [
        c?.aim ? `Today’s aim, from your ${c.date} checkout: ${c.aim}` : c ? `Your ${c.date} checkout has no aim written down.` : 'I couldn’t find a recent checkout.',
        ov.loops ? `${counts.owed ?? 0} on you, ${counts.waiting ?? 0} waiting on others, ${counts.decide ?? 0} to decide.` : '',
        next ? `Next on the calendar: ${next.title} at ${fmtWhen(next.start, ov.tz)}.` : ov.calendar ? 'Nothing else timed on today’s calendar.' : '',
        c?.nudge ? `Coaching nudge: ${c.nudge}` : '',
      ].filter(Boolean);
      return {
        lines,
        items: (c?.priorities ?? []).slice(0, 5).map((p) => ({ label: p, sub: 'Priority from the checkout' })),
        actions: [
          { label: 'Full briefing', panel: 'briefing' },
          { label: 'Open the checkout', panel: 'checkout' },
          { label: 'Open loops', panel: 'loops' },
        ],
        sources: ov.sources,
        fromRecords: true,
      };
    },
    deadlines: async () => {
      const ov = await overview();
      return {
        lines: [ov.deadlines.length ? `${plural(ov.deadlines.length, 'dated item')} coming up. Soonest first:` : 'Nothing with a date on it in the next while.'],
        items: ov.deadlines.slice(0, 8).map((d) => ({ label: d.title, sub: `${d.label} · from ${d.origin}`, status: d.status })),
        actions: [{ label: 'All deadlines', panel: 'deadlines' }],
        sources: ov.sources,
        fromRecords: true,
      };
    },
    decisions: async () => {
      const ov = await overview();
      const open = ov.loops?.decide ?? [];
      const made = ov.checkout?.decisions ?? [];
      return {
        lines: [open.length ? `${plural(open.length, 'decision')} waiting on you.` : 'No open decisions on the spine.', made.length ? `Your latest checkout also logged ${plural(made.length, 'decision')} you made.` : ''].filter(Boolean),
        items: [...open.slice(0, 6).map(loopItem), ...made.slice(0, 3).map((d) => ({ label: d.title, sub: `Decided · ${d.why}` }))],
        actions: [{ label: 'Open decisions', panel: 'decisions' }],
        sources: ov.sources,
        fromRecords: true,
      };
    },
    waiting: () => waiting(false),
    meetings,
    weekplan: async () => {
      const ov = await overview();
      const wp = ov.os?.weekPlan;
      if (!ov.os) return { lines: ['The operating-system file didn’t load.'], fromRecords: false };
      return {
        lines: [wp ? wp.title : 'Your current OS file has no week plan section.', ov.os.laneMap.length ? 'And the lane map:' : ''].filter(Boolean),
        items: [...(wp?.days ?? []).map((d) => ({ label: d })), ...ov.os.laneMap.map((d) => ({ label: d, sub: 'Lane map' }))],
        actions: [{ label: 'Open the OS file', panel: 'os' }],
        sources: [ov.os.source],
        fromRecords: true,
      };
    },
    room: roomReply,
  },
  archivist: {
    recent: () => archive('daily', 'daily checkouts'),
    weekly: () => archive('weekly', 'weekly rollups'),
    monthly: () => archive('monthly', 'monthly wraps'),
    closed: async () => {
      const ov = await overview();
      const groups = ov.loops?.recentlyClosed ?? [];
      return {
        lines: [groups.length ? 'Recently closed, as the spine records it:' : 'The spine has no recently closed section right now.'],
        items: groups.map((g) => ({ label: g.label, sub: g.items.slice(0, 4).join(' · ') + (g.items.length > 4 ? ` +${g.items.length - 4}` : '') })),
        actions: [{ label: 'Open closed loops', panel: 'loops', props: { tab: 'closed' } }],
        sources: ov.loops ? [ov.loops.source] : undefined,
        fromRecords: !!ov.loops,
      };
    },
    killed: async () => {
      const l = await api<LoopsResponse>('/api/hq/loops', { ttl: 120_000 });
      const killed = l.loops?.killed ?? [];
      return {
        lines: [killed.length ? `You’ve cut ${plural(killed.length, 'thing')} on purpose. Here are the latest:` : 'Nothing in the killed list.'],
        items: killed.slice(0, 10).map((k) => ({ label: k })),
        sources: l.loops ? [l.loops.source] : undefined,
        fromRecords: true,
      };
    },
    find: (q) =>
      q && q.trim().length > 1
        ? { lines: [`Searching the stacks for “${q.trim()}”.`], actions: [{ label: 'Show results', panel: 'search', props: { q: q.trim() } }], fromRecords: false }
        : { lines: ['Tell me what you’re after in the box below, or open search. I’ll check your Drive, loops and lanes.'], actions: [{ label: 'Open search', panel: 'search' }], fromRecords: false },
    room: roomReply,
  },
  comms: {
    inbox: async () => {
      const s = getState().session;
      if (s && !s.gmailPreview) return { lines: ['Gmail previews are turned off on this deployment, so I only open Gmail for you.'], actions: [{ label: 'Open Gmail', href: 'https://mail.google.com' }], fromRecords: false };
      const g = await api<GmailResponse>('/api/hq/gmail', { ttl: 60_000 });
      if (g.disabled) return { lines: ['Gmail previews are turned off.'], actions: [{ label: 'Open Gmail', href: 'https://mail.google.com' }], fromRecords: false };
      const sorted = [...g.threads].sort((a, b) => Number(b.unread) - Number(a.unread));
      return {
        lines: [g.unread ? `${plural(g.unread, 'unread thread')} in the last few days (promotions and social skipped).` : 'Nothing unread in the last few days.'],
        items: sorted.slice(0, 8).map((t) => ({ label: `${t.from}: ${t.subject}`, sub: `${t.unread ? 'Unread · ' : ''}${t.snippet}`, href: t.url })),
        actions: [
          { label: 'Open the inbox board', panel: 'comms', props: { tab: 'inbox' } },
          { label: 'Open Gmail', href: 'https://mail.google.com' },
        ],
        sources: [{ name: 'Gmail', url: 'https://mail.google.com' }],
        fromRecords: true,
      };
    },
    waiting: () => waiting(true),
    compose: () => ({ lines: ['Tell me who and what. Gmail opens with it filled in, and you press Send there yourself.'], actions: [{ label: 'Start an email', panel: 'compose' }], fromRecords: false }),
    slack: () => ({ lines: ['I’ll set up the words; you paste and send them in Slack.'], actions: [{ label: 'Open the Slack tools', panel: 'comms', props: { tab: 'slack' } }], fromRecords: false }),
    meetings,
    room: roomReply,
  },
  coordinator: {
    lanes: async () => {
      const ov = await overview();
      const active = ov.lanes.filter((l) => !l.personal && !l.closed);
      const closed = ov.lanes.filter((l) => !l.personal && l.closed);
      return {
        lines: [`${plural(active.length, 'lane')} active in your current OS file${closed.length ? `, ${closed.length} closed` : ''}.`],
        items: active.map((l) => ({ label: l.name, sub: `${l.openCount} open · ${l.waitingCount} waiting`, panel: { type: 'lane', props: { laneId: l.id } } })),
        actions: [{ label: 'All lanes', panel: 'lanes' }],
        sources: ov.os ? [ov.os.source] : undefined,
        fromRecords: true,
      };
    },
    pending: async () => {
      const ov = await overview();
      const names = new Map(ov.lanes.map((l) => [l.id, l.name]));
      const owed = ov.loops?.owed ?? [];
      return {
        lines: [owed.length ? `${plural(ov.loops?.counts.owed ?? owed.length, 'item')} are your move. The top of the list:` : 'Nothing is marked as your move.'],
        items: owed.slice(0, 8).map((l) => ({ ...loopItem(l), sub: [l.laneId ? names.get(l.laneId) : '', l.dueLabel ?? ''].filter(Boolean).join(' · ') })),
        actions: [{ label: 'Open loops', panel: 'loops', props: { tab: 'owed' } }],
        sources: ov.loops ? [ov.loops.source] : undefined,
        fromRecords: true,
      };
    },
    allocation: async () => {
      const ov = await overview();
      const a = ov.os?.allocation ?? [];
      return {
        lines: [a.length ? 'This month’s allocation, from your OS file:' : 'Your OS file has no allocation section.'],
        items: a.map((x) => ({ label: `${x.name}${x.value ? ` · ${x.value}` : ''}`, sub: x.text })),
        sources: ov.os ? [ov.os.source] : undefined,
        fromRecords: true,
      };
    },
    lanemap: async () => {
      const ov = await overview();
      const m = ov.os?.laneMap ?? [];
      return {
        lines: [m.length ? 'Which lane gets which day:' : 'No lane map in your OS file.'],
        items: m.map((x) => ({ label: x })),
        sources: ov.os ? [ov.os.source] : undefined,
        fromRecords: true,
      };
    },
    update: async () => {
      const ov = await overview();
      return {
        lines: ['Pick a lane. I’ll lay out the context for an email, a Slack note, a task or a Claude brief. You review and send it yourself.'],
        items: ov.lanes.filter((l) => !l.personal && !l.closed).map((l) => ({ label: l.name, sub: 'Prepare an update', panel: { type: 'handoff', props: { laneId: l.id } } })),
        fromRecords: true,
      };
    },
    room: roomReply,
  },
  scout: {
    week: async () => {
      const w = await warroom();
      const next = w.leaderboard?.nextGame;
      const sheet = w.pages.find((p) => p.kind === 'sheet');
      const recap = w.pages.find((p) => p.kind === 'recap');
      return {
        lines: [
          next ? `Next up: week ${next.week}${next.opponent ? ` vs ${next.opponent}` : ''}${next.date ? `, ${next.date}` : ''}.` : 'The site doesn’t list a next game right now.',
          sheet ? `Latest sheet on the site: ${sheet.label}.` : '',
        ].filter(Boolean),
        actions: [
          ...(sheet ? [{ label: sheet.label, href: sheet.url }] : []),
          ...(recap ? [{ label: recap.label, href: recap.url }] : []),
          { label: 'Open the war room board', panel: 'warroom', props: { tab: 'games' } },
        ],
        sources: [{ name: 'hawkswarroom.com', url: w.site }],
        fromRecords: true,
      };
    },
    sheets: async () => {
      const w = await warroom();
      const pages = w.pages.filter((p) => p.kind !== 'page');
      return {
        lines: [pages.length ? 'Game pages on the site, newest first:' : 'No game pages found on the site.'],
        items: pages.slice(0, 8).map((p) => ({ label: p.label, href: p.url })),
        sources: [{ name: 'hawkswarroom.com', url: w.site }],
        fromRecords: true,
      };
    },
    leaderboard: async () => {
      const w = await warroom();
      const lb = w.leaderboard;
      return {
        lines: [lb ? `${lb.season} picks leaderboard${lb.throughWeek ? `, through week ${lb.throughWeek}` : ''}:` : 'The site has no leaderboard file this season.'],
        items: (lb?.standings ?? []).slice(0, 6).map((s) => ({ label: `${s.rank}. ${s.name}`, sub: `${s.total} points` })),
        actions: [{ label: 'Full leaderboard', panel: 'warroom', props: { tab: 'leaderboard' } }],
        sources: [{ name: 'hawkswarroom.com', url: w.site }],
        fromRecords: !!lb,
      };
    },
    planning: async () => {
      const l = await api<LoopsResponse>('/api/hq/loops', { ttl: 120_000 });
      const items = (l.loops?.items ?? []).filter((i) => !i.sensitive && FOOTBALL.test(`${i.title} ${i.text} ${i.section}`));
      return {
        lines: [items.length ? 'Loops that mention the war room:' : 'None of your loops mention the war room right now.'],
        items: items.slice(0, 8).map(loopItem),
        actions: [{ label: 'Planning board', panel: 'warroom', props: { tab: 'planning' } }],
        sources: l.loops ? [l.loops.source] : undefined,
        fromRecords: true,
      };
    },
    dev: () => ({
      lines: ['The site’s code lives in your public repo. I can open the repo or hand you a brief for your coding agent.'],
      actions: [
        { label: 'Dev board', panel: 'warroom', props: { tab: 'dev' } },
        { label: 'Source on GitHub', href: 'https://github.com/jessedeanrivero/jessedeanrivero/tree/main/seahawks' },
      ],
      fromRecords: false,
    }),
    site: () => ({
      lines: ['Big screen’s right here.'],
      actions: [
        { label: 'Show it on the big screen', panel: 'warroom', props: { tab: 'site' } },
        { label: 'Open in a new tab', href: getState().session?.warroomUrl ?? 'https://www.hawkswarroom.com' },
      ],
      fromRecords: false,
    }),
  },
  inventor: {
    build: async () => {
      const d = await ideas();
      const list = d.ideas.filter((i) => i.category === 'build');
      return {
        lines: [list.length ? `You’ve written down ${plural(list.length, 'thing')} you want to build. A few:` : 'No build ideas written down yet. Want to start one?'],
        items: list.slice(0, 7).map(ideaItem),
        actions: [{ label: 'Open the Dream Board', panel: 'dreamboard' }],
        fromRecords: true,
      };
    },
    forgot: async () => {
      const d = await ideas();
      const dated = d.ideas.filter((i) => i.date).sort((a, b) => (a.date! < b.date! ? -1 : 1));
      const pick = dated.slice(0, 3);
      return {
        lines: [pick.length ? `The oldest ideas you wrote down. The first one is ${daysBetween(pick[0].date!, d.today)} days old.` : 'None of your ideas have dates on them, so I can’t tell which are oldest.'],
        items: pick.map(ideaItem),
        actions: [{ label: 'Surprise me instead', panel: 'surprise' }],
        fromRecords: true,
      };
    },
    fun: () => ({ lines: ['Let’s roll the dice. It’s simple rules, not a robot with opinions.'], actions: [{ label: 'Surprise me', panel: 'surprise' }], fromRecords: false }),
    parked: async () => {
      const d = await ideas();
      const parked = d.ideas.filter((i) => i.status === 'parked').sort((a, b) => ((a.date ?? '9') < (b.date ?? '9') ? -1 : 1));
      return {
        lines: [parked.length ? 'Parked items, oldest date first (when the item has one):' : 'Nothing is parked right now.'],
        items: parked.slice(0, 8).map(ideaItem),
        fromRecords: true,
      };
    },
    think: () => ({ lines: ['Bring me an idea, old or new. I’ve got a few questions that make ideas bigger.'], actions: [{ label: 'Think one through', panel: 'think' }, { label: 'Pick from the board', panel: 'dreamboard' }], fromRecords: false }),
    journal: () => ({ lines: ['The journal’s open. Talk it out with your dictation tool; it saves only when you say so.'], actions: [{ label: 'Open the journal', panel: 'journal' }], fromRecords: false }),
  },
  blip: {
    outputs: async () => {
      const a = await api<AutomationsResponse>('/api/hq/automations', { ttl: 120_000 });
      return {
        lines: ['BEEP. Newest file I can see in each output folder. Files, not proof of runs.'],
        items: a.outputs.map((o) => ({
          label: ROLE_LABEL[o.role] ?? o.folder.name,
          sub: o.newest ? `${o.newest.name} · ${o.newest.ageDays === undefined ? '' : o.newest.ageDays <= 0 ? 'today' : `${o.newest.ageDays}d ago`}` : 'No files',
          href: o.newest?.url ?? o.folder.url,
        })),
        actions: [{ label: 'Open the lab board', panel: 'automations' }],
        fromRecords: true,
      };
    },
    checkout: () => ({
      lines: ['BOOP. The checkout runs in Claude, not in this building. I can copy the phrase and open Claude. You start it there.'],
      actions: [{ label: 'Copy “run my checkout” and open Claude', copy: 'run my checkout', openAfterCopy: 'https://claude.ai/new' }],
      fromRecords: false,
    }),
    limits: () => ({
      lines: [
        'I can see: files in your numbered Drive folders and when they changed.',
        'I cannot see: scheduled-task logs, whether a run happened, anything that never reached Drive, or the contents of message exports.',
      ],
      fromRecords: false,
    }),
  },
};

export async function respond(npc: NpcDef, topicId: string, query?: string): Promise<Reply> {
  const h = HANDLERS[npc.id]?.[topicId];
  if (!h) return { lines: ['I don’t have an answer for that one yet.'], fromRecords: false };
  try {
    return await h(query);
  } catch (e) {
    return failure(e);
  }
}

export function greeting(npc: NpcDef): string {
  const s = getState().session;
  const name = s?.firstName ?? 'friend';
  const hello = greetingFor(hourIn(s?.tz ?? undefined));
  const signedOut = s && !s.signedIn ? ' Sign in with Google and I can pull your records.' : '';
  const lines: Record<string, string> = {
    chief: `${hello}, ${name}. Want the briefing?`,
    archivist: `Ah, ${name}. The shelves are in order. What are we looking for?`,
    comms: `Hey ${name}! Nothing leaves this room until you hit Send yourself.`,
    coordinator: `${name}! The district’s open. Which lane are we checking?`,
    scout: `Coach. Ready for this week?`,
    inventor: `Oh good, you’re here. No agenda. Want to poke at an idea?`,
    blip: `BEEP. HELLO ${name.toUpperCase()}. I REPORT FILES, NOT FEELINGS.`,
  };
  return (lines[npc.id] ?? `Hi ${name}.`) + signedOut;
}

/** Optional: ask a local Ollama model, grounded in the reply already on screen. Off by default. */
export async function askLocalModel(npc: NpcDef, question: string, context: Reply | null): Promise<string> {
  const lm = getState().settings.localModel;
  if (!lm.enabled) throw new Error('The local model is off. Turn it on in Settings.');
  const ctx = context
    ? [...context.lines, ...(context.items ?? []).map((i) => `- ${i.label}${i.sub ? ` (${i.sub})` : ''}${i.status ? ` [${STATUS_LABEL[i.status]}]` : ''}`)].join('\n')
    : '(no records on screen)';
  const prompt = [
    `You are ${npc.name}, ${npc.role}, a fictional coworker in a personal headquarters game. Be brief and friendly.`,
    'Answer only from the records below. If they do not contain the answer, say you do not know. Never invent emails, dates, people or tasks.',
    `Today is ${todayIn(tz())}.`,
    '',
    'Records:',
    ctx,
    '',
    `Question: ${question}`,
  ].join('\n');
  const r = await fetch(`${lm.url.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: lm.model, prompt, stream: false }),
  });
  if (!r.ok) throw new Error(`The local model answered with an error (${r.status}).`);
  const j = (await r.json()) as { response?: string };
  return (j.response ?? '').trim() || 'The local model returned nothing.';
}
