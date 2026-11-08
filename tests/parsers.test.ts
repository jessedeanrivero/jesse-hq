import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDailyCheckout, publicCheckout } from '@/lib/shared/daily';
import { extractDate, freshnessFor, dateFromName, daysBetween } from '@/lib/shared/dates';
import { classifyTag, parseLoopsSpine } from '@/lib/shared/loops';
import { normalizeMarkdown, parseFrontmatter, parseListItems, extractTrailingTag } from '@/lib/shared/markdown';
import { parseLaneList, parseOsDoc, publicOs } from '@/lib/shared/osdoc';
import { buildLaneRegistry, extractLinks, scoreTheme } from '@/lib/shared/lanes';
import { ideasFromLoops, ideasFromOs, pickSurprise } from '@/lib/shared/ideas';
import type { SourceRef } from '@/lib/shared/types';

const fx = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const src = (kind: SourceRef['kind'], name: string, date?: string): SourceRef => ({ kind, name, url: 'https://drive.google.com/x', date, freshness: 'fresh' });
const TODAY = '2030-03-15';

/** Mimic the CommonMark-escaped text some Drive readers return. */
function escapeLikeDrive(md: string): string {
  return md
    .split('\n')
    .map((l) => l.replace(/([#*[\]`>&_-])/g, '\\$1') + '  ')
    .join('\n');
}

describe('markdown', () => {
  it('normalizes escaped Drive markdown to the plain form', () => {
    const plain = fx('daily.md');
    expect(normalizeMarkdown(escapeLikeDrive(plain)).trim()).toBe(normalizeMarkdown(plain).trim());
  });

  it('reads frontmatter lists and folded values', () => {
    const { data } = parseFrontmatter(normalizeMarkdown(fx('daily.md')));
    expect(data.businesses).toEqual(['widgetco', 'publishing', 'community', 'personal']);
    expect(data.instrumentation_note).toContain('Synthetic fixture');
    expect(data.nudge).toBe('Send the pilot recap before lunch Friday.');
  });

  it('parses list items with bold labels and continuation lines', () => {
    const items = parseListItems('- **Alpha:** one\n  two\n- plain item\n 1. **Sub = 2.** nested');
    expect(items[0].bold).toBe('Alpha');
    expect(items[0].rest).toBe('one two');
    expect(items[1].bold).toBeUndefined();
    expect(items[2].depth).toBe(1);
  });

  it('pulls trailing tags', () => {
    expect(extractTrailingTag('Do the thing. `[owed · quick]`')).toEqual({ tag: 'owed · quick', before: 'Do the thing.' });
    expect(extractTrailingTag('No tag here').tag).toBeUndefined();
  });
});

describe('dates', () => {
  it('reads dates in several forms and infers the year', () => {
    expect(extractDate('due Mon 3/18', TODAY)?.iso).toBe('2030-03-18');
    expect(extractDate('announce Nov 23', TODAY)?.iso).toBe('2030-11-23');
    expect(extractDate('camp 1/26', '2030-11-08')?.iso).toBe('2031-01-26');
    expect(extractDate('$9.99/mo and 24/7 support', TODAY)).toBeNull();
    expect(extractDate('on 2030-04-02', TODAY)?.iso).toBe('2030-04-02');
  });

  it('rates freshness and reads dates from filenames', () => {
    expect(freshnessFor('daily', '2030-03-14', TODAY)).toBe('fresh');
    expect(freshnessFor('daily', '2030-03-10', TODAY)).toBe('stale');
    expect(dateFromName('loops-2030-03-14.md')).toBe('2030-03-14');
    expect(dateFromName('2030-02.md')).toBe('2030-02-01');
    expect(daysBetween('2030-03-14', TODAY)).toBe(1);
  });
});

describe('loop tags', () => {
  const owner = { ownerNames: ['sam'] };
  it.each([
    ['owed · the nudge', 'owed'],
    ['waiting on Robin', 'waiting'],
    ["Avery's", 'waiting'],
    ["Sam's", 'owed'],
    ['dated · Mon 3/18', 'scheduled'],
    ['decide · launch', 'decide'],
    ['DIRECTION SET', 'decided'],
    ['parked', 'parked'],
    ['idea · low', 'idea'],
    ['STANDING · his', 'standing'],
    ['his · live · signal', 'active'],
    ['closed · follow-up Nov 23', 'done'],
    ['booked · April', 'scheduled'],
    ['family', 'info'],
    ['warm / waiting as before', 'warm'],
    ['Planning Center owed', 'owed'],
    ['something new', 'open'],
  ])('%s → %s', (tag, status) => {
    expect(classifyTag(tag, owner).status).toBe(status);
  });

  it('names who holds a waiting item', () => {
    expect(classifyTag('waiting on Morgan · legal').who).toBe('Morgan');
    expect(classifyTag("Avery's build").who).toBe('Avery');
  });
});

describe('daily checkout', () => {
  const daily = parseDailyCheckout(escapeLikeDrive(fx('daily.md')), src('daily', '2030-03-14.md', '2030-03-14'), TODAY);
  it('reads the fixed sections', () => {
    expect(daily.date).toBe('2030-03-14');
    expect(daily.aim).toBe('Get the pilot recap out and keep the launch simple.');
    expect(daily.priorities).toHaveLength(3);
    expect(daily.decisions[0]).toEqual({ title: 'Pricing stays simple', why: 'One paid tier keeps the launch message clear.' });
    expect(daily.moved.map((g) => g.lane)).toEqual(['widgetco', 'publishing', 'personal']);
    expect(daily.openLoops.map((l) => l.status)).toEqual(['owed', 'waiting', 'scheduled', 'decide']);
    expect(daily.openLoops[2].due).toBe('2030-03-18');
  });
  it('keeps personal fields out of the public view', () => {
    expect(daily.personal.health).toBe('Walked twice.');
    expect(publicCheckout(daily).personal).toEqual({});
  });
});

describe('loops spine', () => {
  const spine = parseLoopsSpine(fx('loops.md'), src('loops', 'loops-2030-03-14.md', '2030-03-14'), TODAY, { ownerNames: ['sam'] });
  it('parses sections, statuses and special sections', () => {
    expect(spine.next).toHaveLength(2);
    expect(spine.killed).toEqual(['Old newsletter idea', 'Fax machine']);
    expect(spine.recentlyClosed[0].label).toBe('3/14');
    expect(spine.recentlyClosed[0].items).toHaveLength(3);
    const byTitle = Object.fromEntries(spine.items.map((i) => [i.title, i]));
    expect(byTitle['Split sheet with Robin'].status).toBe('waiting');
    expect(byTitle['Split sheet with Robin'].who).toBe('Robin');
    expect(byTitle['Card minimum due Thu 3/21'].due).toBe('2030-03-21');
    expect(byTitle['Stripe test mode'].status).toBe('waiting');
  });
});

describe('operating-system file', () => {
  const os = parseOsDoc(fx('os.md'), src('os', 'operating-system-2030-03-10.md', '2030-03-10'));
  it('reads the lane list with notes and closed lanes', () => {
    expect(os.lanes.map((l) => l.id)).toEqual(['widgetco', 'publishing', 'community', 'touring', 'personal', 'contract', 'freelance']);
    expect(os.lanes.find((l) => l.id === 'touring')?.closed).toBe(true);
    expect(os.lanes.find((l) => l.id === 'freelance')?.note).toBe('sessions and consulting, own');
  });
  it('reads businesses, allocation, week plan and goals', () => {
    expect(os.businesses[0].name).toBe('WidgetCo');
    expect(os.allocation).toEqual([
      { name: 'WidgetCo', value: '2', text: 'Pilot and launch.' },
      { name: 'Publishing', value: '1', text: 'Morning writes.' },
    ]);
    expect(os.weekPlan?.days).toHaveLength(2);
    expect(os.goals).toHaveLength(2);
  });
  it('drops personal sections from the public view', () => {
    const pub = publicOs(os);
    expect(pub.goals).toEqual([]);
    expect(pub.sections.some((s) => /health|goals|energy/i.test(s.heading))).toBe(false);
  });
  it('splits lane lists with commas inside parentheses', () => {
    expect(parseLaneList('a, b (x, y), c.').map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('lane registry', () => {
  const daily = parseDailyCheckout(fx('daily.md'), src('daily', '2030-03-14.md', '2030-03-14'), TODAY);
  const spine = parseLoopsSpine(fx('loops.md'), src('loops', 'loops-2030-03-14.md', '2030-03-14'), TODAY);
  const os = parseOsDoc(fx('os.md'), src('os', 'operating-system-2030-03-10.md', '2030-03-10'));
  const lanes = buildLaneRegistry({ os, loops: spine, daily });
  const byId = Object.fromEntries(lanes.map((l) => [l.id, l]));

  it('builds one lane per OS lane, named from the businesses section', () => {
    expect(lanes.map((l) => l.id)).toEqual(os.lanes.map((l) => l.id));
    expect(byId.widgetco.name).toBe('WidgetCo');
    expect(byId.touring.closed).toBe(true);
    expect(byId.personal.personal).toBe(true);
  });
  it('assigns loops sections and recent movement to lanes', () => {
    expect(byId.widgetco.sections).toContain('WidgetCo (product)');
    expect(byId.publishing.sections[0]).toMatch(/Publishing/);
    expect(byId.publishing.people).toEqual(['Robin']);
    expect(byId.widgetco.recent).toHaveLength(2);
    expect(byId.widgetco.allocation).toBe('2: Pilot and launch.');
  });
  it('picks room themes from the lane text', () => {
    expect(byId.widgetco.theme).toBe('devoffice');
    expect(byId.publishing.theme).toBe('writersroom');
    expect(byId.community.theme).toBe('workshop');
    expect(byId.touring.theme).toBe('backstage');
    expect(byId.contract.theme).toBe('office');
    expect(scoreTheme('podcast', 'Podcast', 'episodes on youtube')).toBe('broadcast');
  });
  it('finds links written in the lane text', () => {
    const links = extractLinks('see widgetco.app and https://docs.example.com/start, mail me@x.com');
    expect(links.map((l) => l.url)).toEqual(['https://docs.example.com/start', 'https://widgetco.app']);
  });
});

describe('ideas and surprise me', () => {
  const spine = parseLoopsSpine(fx('loops.md'), src('loops', 'loops-2030-03-14.md', '2030-03-14'), TODAY);
  const os = parseOsDoc(fx('os.md'), src('os', 'operating-system-2030-03-10.md', '2030-03-10'));
  const ideas = [...ideasFromLoops(spine, TODAY), ...ideasFromOs(os)];
  it('collects ideas from idea/parked loops, soft tags and aspirations, never money goals', () => {
    const titles = ideas.map((i) => i.title);
    expect(titles).toContain('Importer idea');
    expect(titles).toContain('Library workshop');
    expect(titles).toContain('Sync pitch list');
    expect(titles).toContain('Weekend kite build');
    expect(titles.some((t) => /debt|figures/i.test(t))).toBe(false);
    expect(titles.some((t) => /Coast trip/.test(t))).toBe(true);
  });
  it('avoids repeats and respects never', () => {
    let seq = 0;
    const rand = () => ((seq = (seq * 9301 + 49297) % 233280), seq / 233280);
    const history: { id: string; at: string; category: (typeof ideas)[number]['category'] }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const pick = pickSurprise(ideas, history, {}, TODAY, rand)!;
      expect(seen.has(pick.idea.id)).toBe(false);
      seen.add(pick.idea.id);
      history.push({ id: pick.idea.id, at: TODAY, category: pick.idea.category });
    }
    const never = Object.fromEntries(ideas.slice(1).map((i) => [i.id, 'never' as const]));
    expect(pickSurprise(ideas, [], never, TODAY, rand)?.idea.id).toBe(ideas[0].id);
  });
});
