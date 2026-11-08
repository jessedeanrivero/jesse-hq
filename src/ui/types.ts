import type { CalendarEvent, DailyCheckout, DeadlineItem, Lane, LoopItem, LoopStatus, MailThread, OsDoc, PartError, RoomTheme, SourceRef } from '@/lib/shared/types';

export type SlimLoop = Pick<LoopItem, 'id' | 'title' | 'text' | 'status' | 'tag' | 'who' | 'section' | 'laneId' | 'due' | 'dueLabel'>;

export interface Overview {
  now: string;
  today: string;
  tz: string;
  checkout: (Omit<DailyCheckout, 'openLoops'> & { openLoops: SlimLoop[] }) | null;
  loops: {
    source: SourceRef;
    updated?: string;
    counts: Partial<Record<LoopStatus, number>>;
    owed: SlimLoop[];
    waiting: SlimLoop[];
    scheduled: SlimLoop[];
    decide: SlimLoop[];
    next: SlimLoop[];
    recentlyClosed: { label: string; items: string[] }[];
  } | null;
  os: { source: SourceRef; updated?: string; changeSummary?: string; allocation: OsDoc['allocation']; weekPlan?: OsDoc['weekPlan']; laneMap: string[] } | null;
  calendar: { calendars: number; skipped: number; today: CalendarEvent[]; upcoming: CalendarEvent[] } | null;
  deadlines: DeadlineItem[];
  lanes: { id: string; name: string; theme: RoomTheme; closed: boolean; personal: boolean; openCount: number; waitingCount: number; recent: number }[];
  sources: SourceRef[];
  errors: PartError[];
}

export interface LoopsResponse {
  loops: {
    source: SourceRef;
    updated?: string;
    counts: Partial<Record<LoopStatus, number>>;
    items: (LoopItem & { sensitive: boolean })[];
    sections: { heading: string; laneId?: string; count: number }[];
    next: (LoopItem & { sensitive: boolean })[];
    recentlyClosed: { label: string; items: string[] }[];
    killed: string[];
  } | null;
  lanes: { id: string; name: string }[];
  errors: PartError[];
}

export interface LanesResponse {
  lanes: Lane[];
  sources: SourceRef[];
  errors: PartError[];
}

export interface CalendarResponse {
  events: CalendarEvent[];
  calendars: number;
  skipped: number;
  tz: string;
}

export interface GmailResponse {
  disabled?: boolean;
  threads: MailThread[];
  unread: number;
}
