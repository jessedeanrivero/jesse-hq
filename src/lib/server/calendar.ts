import 'server-only';
import { cached } from './cache';
import { GoogleClient } from './google';
import { ymdIn } from '@/lib/shared/dates';
import type { CalendarEvent } from '@/lib/shared/types';

const API = 'https://www.googleapis.com/calendar/v3';

interface CalItem {
  id: string;
  summary?: string;
  summaryOverride?: string;
  selected?: boolean;
  hidden?: boolean;
  accessRole?: string;
  primary?: boolean;
}
interface GEvent {
  id: string;
  summary?: string;
  status?: string;
  htmlLink?: string;
  hangoutLink?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
}

export async function upcomingEvents(g: GoogleClient, tz: string, days = 7): Promise<{ events: CalendarEvent[]; calendars: number; skipped: number }> {
  return cached(`${g.session.email}:cal:${days}`, 2 * 60_000, async () => {
    const list = await g.json<{ items?: CalItem[] }>(`${API}/users/me/calendarList?minAccessRole=freeBusyReader&fields=items(id,summary,summaryOverride,selected,hidden,accessRole,primary)`);
    const cals = (list.items ?? []).filter((c) => !c.hidden && (c.selected !== false || c.primary)).slice(0, 20);
    const now = Date.now();
    const timeMin = new Date(now - 6 * 3600_000).toISOString();
    const timeMax = new Date(now + days * 86400_000).toISOString();
    let skipped = 0;
    const results = await Promise.all(
      cals.map(async (c) => {
        try {
          const params = new URLSearchParams({
            singleEvents: 'true',
            orderBy: 'startTime',
            timeMin,
            timeMax,
            maxResults: '60',
            fields: 'items(id,summary,status,htmlLink,hangoutLink,location,start,end,attendees(self,responseStatus))',
          });
          const j = await g.json<{ items?: GEvent[] }>(`${API}/calendars/${encodeURIComponent(c.id)}/events?${params}`);
          return (j.items ?? []).map((e) => ({ e, cal: c }));
        } catch {
          skipped++;
          return [];
        }
      })
    );
    const seen = new Set<string>();
    const events: CalendarEvent[] = [];
    for (const { e, cal } of results.flat()) {
      if (e.status === 'cancelled') continue;
      if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue;
      const start = e.start?.dateTime ?? e.start?.date;
      if (!start) continue;
      const title = (e.summary ?? '').trim() || (cal.accessRole === 'freeBusyReader' ? 'Busy' : '(no title)');
      // Copies of the same event on two calendars count once.
      const key = `${title.toLowerCase()}|${start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        id: e.id,
        title,
        start,
        end: e.end?.dateTime ?? e.end?.date,
        allDay: !!e.start?.date,
        calendar: cal.summaryOverride ?? cal.summary ?? 'Calendar',
        location: e.location,
        url: e.htmlLink,
        meetUrl: e.hangoutLink,
      });
    }
    events.sort((a, b) => a.start.localeCompare(b.start));
    void tz;
    return { events, calendars: cals.length, skipped };
  });
}

export function eventDay(e: CalendarEvent, tz: string): string {
  return e.allDay ? e.start.slice(0, 10) : ymdIn(new Date(e.start), tz);
}
